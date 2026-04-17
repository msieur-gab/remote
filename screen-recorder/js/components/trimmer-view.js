import { $, cloneTemplate, mount } from '../utils/dom.js';
import { formatSeconds } from '../utils/time.js';
import { getRecording, saveRecording } from '../services/storage.js';
import { trimVideo } from '../services/trimmer.js';
import { downloadBlob, extensionForMime } from '../utils/download.js';

export async function renderTrimmerView(root, { id, onBack, onSaved } = {}) {
  const rec = await getRecording(id);
  if (!rec) {
    root.textContent = 'Recording not found.';
    return { destroy() {} };
  }

  const view = cloneTemplate('tpl-trimmer');
  mount(root, view);

  const title = $('#trim-title', view);
  const video = $('#trim-video', view);
  const startInput = $('#trim-start', view);
  const endInput = $('#trim-end', view);
  const startRead = $('#trim-start-read', view);
  const endRead = $('#trim-end-read', view);
  const durRead = $('#trim-duration-read', view);
  const btnBack = $('#btn-back', view);
  const btnPreview = $('#btn-preview', view);
  const btnExport = $('#btn-export', view);
  const btnDownloadOrig = $('#btn-download-original', view);
  const progress = $('#export-progress', view);

  title.textContent = rec.name;

  const blobUrl = URL.createObjectURL(rec.blob);
  video.src = blobUrl;

  let duration = rec.durationSec || 0;
  let previewStopAt = null;

  function syncReadout() {
    const s = Number(startInput.value);
    const e = Number(endInput.value);
    startRead.textContent = formatSeconds(s);
    endRead.textContent = formatSeconds(e);
    durRead.textContent = formatSeconds(Math.max(0, e - s));
  }

  video.addEventListener('loadedmetadata', () => {
    duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : duration;
    startInput.min = '0';
    startInput.max = String(duration);
    endInput.min = '0';
    endInput.max = String(duration);
    endInput.value = String(duration);
    syncReadout();
  });

  startInput.addEventListener('input', () => {
    if (Number(startInput.value) >= Number(endInput.value)) {
      startInput.value = String(Math.max(0, Number(endInput.value) - 0.1));
    }
    syncReadout();
    video.currentTime = Number(startInput.value);
  });
  endInput.addEventListener('input', () => {
    if (Number(endInput.value) <= Number(startInput.value)) {
      endInput.value = String(Math.min(duration, Number(startInput.value) + 0.1));
    }
    syncReadout();
  });

  video.addEventListener('timeupdate', () => {
    if (previewStopAt !== null && video.currentTime >= previewStopAt) {
      video.pause();
      previewStopAt = null;
    }
  });

  btnBack.addEventListener('click', () => onBack?.());

  btnPreview.addEventListener('click', () => {
    const s = Number(startInput.value);
    const e = Number(endInput.value);
    video.currentTime = s;
    previewStopAt = e;
    video.play();
  });

  btnDownloadOrig.addEventListener('click', () => {
    const ext = extensionForMime(rec.mimeType);
    downloadBlob(rec.blob, `${rec.name}.${ext}`);
  });

  btnExport.addEventListener('click', async () => {
    const s = Number(startInput.value);
    const e = Number(endInput.value);
    if (e <= s) {
      alert('Select a valid range.');
      return;
    }

    btnExport.disabled = true;
    progress.hidden = false;
    progress.value = 0;

    try {
      const result = await trimVideo(rec.blob, {
        start: s,
        end: e,
        onProgress: (p) => { progress.value = p; }
      });
      const saved = await saveRecording({
        blob: result.blob,
        mimeType: result.mimeType,
        durationSec: result.durationSec,
        name: `${rec.name} (trim)`
      });
      progress.value = 1;
      onSaved?.(saved);
    } catch (err) {
      console.error(err);
      alert(`Trim failed: ${err.message}`);
    } finally {
      btnExport.disabled = false;
      progress.hidden = true;
    }
  });

  return {
    destroy() {
      URL.revokeObjectURL(blobUrl);
    }
  };
}

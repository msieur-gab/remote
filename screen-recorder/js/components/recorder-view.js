import { $, cloneTemplate, mount } from '../utils/dom.js';
import { formatClock } from '../utils/time.js';
import { ScreenRecorder } from '../services/recorder.js';
import { saveRecording } from '../services/storage.js';

export function renderRecorderView(root, { autostart = false, onSaved, onOpenBookmarklet } = {}) {
  const view = cloneTemplate('tpl-recorder');
  mount(root, view);

  const preview = $('#preview', view);
  const previewEmpty = $('#preview-empty', view);
  const btnStart = $('#btn-start', view);
  const btnStop = $('#btn-stop', view);
  const timer = $('#timer', view);
  const optAudio = $('#opt-audio', view);
  const optMic = $('#opt-mic', view);
  const btnBookmarklet = $('#btn-get-bookmarklet', view);

  const recorder = new ScreenRecorder();

  recorder.addEventListener('tick', (e) => {
    timer.textContent = formatClock(e.detail);
  });

  async function start() {
    try {
      btnStart.disabled = true;
      const stream = await recorder.start({
        includeAudio: optAudio.checked,
        includeMic: optMic.checked
      });
      preview.srcObject = stream;
      previewEmpty.hidden = true;
      btnStop.disabled = false;
      timer.innerHTML = '<span class="recording-pulse"></span>00:00';
    } catch (err) {
      console.error(err);
      alert(`Could not start recording: ${err.message}`);
      btnStart.disabled = false;
    }
  }

  async function stop() {
    btnStop.disabled = true;
    const result = await recorder.stop();
    preview.srcObject = null;
    previewEmpty.hidden = false;
    btnStart.disabled = false;
    timer.textContent = '00:00';

    if (result?.blob && result.blob.size > 0) {
      const saved = await saveRecording(result);
      onSaved?.(saved);
    }
  }

  btnStart.addEventListener('click', start);
  btnStop.addEventListener('click', stop);
  btnBookmarklet.addEventListener('click', () => onOpenBookmarklet?.());

  if (autostart) {
    queueMicrotask(() => start());
  }

  return {
    destroy() {
      if (recorder.isRecording) recorder.stop();
    }
  };
}

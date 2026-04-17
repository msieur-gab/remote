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

  btnBookmarklet.addEventListener('click', () => onOpenBookmarklet?.());

  const support = checkSupport();
  if (!support.ok) {
    btnStart.disabled = true;
    btnStop.disabled = true;
    previewEmpty.innerHTML = '';
    const h = document.createElement('p');
    h.textContent = 'Screen recording is unavailable in this browser.';
    const why = document.createElement('p');
    why.className = 'hint';
    why.textContent = support.reason;
    previewEmpty.append(h, why);
    return { destroy() {} };
  }

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

  if (autostart) {
    queueMicrotask(() => start());
  }

  return {
    destroy() {
      if (recorder.isRecording) recorder.stop();
    }
  };
}

function checkSupport() {
  if (!window.isSecureContext) {
    return { ok: false, reason: 'Open the app over HTTPS (or http://localhost) — screen capture requires a secure context.' };
  }
  if (!navigator.mediaDevices?.getDisplayMedia) {
    const ua = navigator.userAgent;
    const isAndroid = /Android/i.test(ua);
    const isIOS = /iPhone|iPad|iPod/i.test(ua);
    if (isAndroid) {
      return { ok: false, reason: 'Chrome and Firefox on Android do not expose getDisplayMedia(). Android screen capture is gated behind the native MediaProjection API, so no web app can record the screen. Use a desktop browser to record.' };
    }
    if (isIOS) {
      return { ok: false, reason: 'Safari on iOS does not support getDisplayMedia(). Use iOS Control Center screen recording, or a desktop browser.' };
    }
    return { ok: false, reason: 'This browser does not expose getDisplayMedia(). Try Chrome, Edge, Firefox, or Safari on desktop.' };
  }
  return { ok: true };
}

export async function trimVideo(sourceBlob, { start, end, onProgress } = {}) {
  if (end <= start) throw new Error('End must be after start');

  const srcUrl = URL.createObjectURL(sourceBlob);
  const video = document.createElement('video');
  video.src = srcUrl;
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.crossOrigin = 'anonymous';

  try {
    await waitForMetadata(video);

    if (typeof video.captureStream !== 'function') {
      throw new Error('Video.captureStream is not supported in this browser.');
    }

    video.currentTime = start;
    await waitForSeek(video);

    const stream = video.captureStream();
    const mimeType = pickMime();
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    const chunks = [];
    recorder.addEventListener('dataavailable', (e) => {
      if (e.data?.size) chunks.push(e.data);
    });

    const stopped = new Promise((resolve) => {
      recorder.addEventListener('stop', resolve, { once: true });
    });

    recorder.start(200);
    await video.play();

    const duration = end - start;
    await new Promise((resolve) => {
      const tick = () => {
        const t = video.currentTime;
        if (onProgress) onProgress(Math.min(1, (t - start) / duration));
        if (t >= end || video.ended) {
          video.pause();
          resolve();
        } else {
          requestAnimationFrame(tick);
        }
      };
      requestAnimationFrame(tick);
    });

    if (recorder.state !== 'inactive') recorder.stop();
    await stopped;

    for (const track of stream.getTracks()) track.stop();
    const blob = new Blob(chunks, { type: recorder.mimeType || 'video/webm' });
    return { blob, mimeType: blob.type, durationSec: duration };
  } finally {
    URL.revokeObjectURL(srcUrl);
    video.remove();
  }
}

function waitForMetadata(video) {
  return new Promise((resolve, reject) => {
    if (video.readyState >= 1) return resolve();
    video.addEventListener('loadedmetadata', () => resolve(), { once: true });
    video.addEventListener('error', () => reject(video.error || new Error('Load failed')), { once: true });
  });
}

function waitForSeek(video) {
  return new Promise((resolve) => {
    video.addEventListener('seeked', () => resolve(), { once: true });
  });
}

function pickMime() {
  const mimes = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'];
  for (const m of mimes) {
    if (MediaRecorder.isTypeSupported(m)) return m;
  }
  return '';
}

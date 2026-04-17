const PREFERRED_MIMES = [
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
  'video/mp4'
];

function pickMimeType() {
  for (const m of PREFERRED_MIMES) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)) return m;
  }
  return '';
}

export class ScreenRecorder extends EventTarget {
  constructor() {
    super();
    this.stream = null;
    this.micStream = null;
    this.recorder = null;
    this.chunks = [];
    this.mimeType = '';
    this.startTs = 0;
    this.tickHandle = null;
  }

  get isRecording() {
    return !!this.recorder && this.recorder.state === 'recording';
  }

  async start({ includeAudio = true, includeMic = false } = {}) {
    if (this.isRecording) throw new Error('Already recording');
    if (!navigator.mediaDevices?.getDisplayMedia) {
      throw new Error('Screen capture is not supported in this browser.');
    }

    const display = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: 30 },
      audio: includeAudio
    });

    let combined = display;
    if (includeMic) {
      try {
        this.micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        combined = mergeStreams(display, this.micStream);
      } catch (err) {
        console.warn('Mic unavailable:', err);
      }
    }

    this.stream = combined;
    display.getVideoTracks()[0].addEventListener('ended', () => this.stop());

    this.mimeType = pickMimeType();
    this.recorder = new MediaRecorder(combined, this.mimeType ? { mimeType: this.mimeType } : undefined);
    this.chunks = [];

    this.recorder.addEventListener('dataavailable', (e) => {
      if (e.data && e.data.size > 0) this.chunks.push(e.data);
    });

    const stopped = new Promise((resolve) => {
      this.recorder.addEventListener('stop', () => resolve(), { once: true });
    });
    this._stopped = stopped;

    this.recorder.start(1000);
    this.startTs = performance.now();
    this.tickHandle = setInterval(() => {
      this.dispatchEvent(new CustomEvent('tick', { detail: this.elapsed() }));
    }, 250);
    this.dispatchEvent(new CustomEvent('start', { detail: { stream: combined } }));

    return combined;
  }

  elapsed() {
    return this.startTs ? (performance.now() - this.startTs) / 1000 : 0;
  }

  async stop() {
    if (!this.recorder) return null;
    const recorder = this.recorder;
    const stopped = this._stopped;
    if (recorder.state !== 'inactive') recorder.stop();
    await stopped;

    clearInterval(this.tickHandle);
    this.tickHandle = null;

    for (const track of this.stream?.getTracks() ?? []) track.stop();
    for (const track of this.micStream?.getTracks() ?? []) track.stop();

    const blob = new Blob(this.chunks, { type: this.mimeType || 'video/webm' });
    const durationSec = this.elapsed();

    this.recorder = null;
    this.stream = null;
    this.micStream = null;
    this.chunks = [];
    this.startTs = 0;

    this.dispatchEvent(new CustomEvent('stop', { detail: { blob, mimeType: blob.type, durationSec } }));
    return { blob, mimeType: blob.type, durationSec };
  }
}

function mergeStreams(displayStream, micStream) {
  const ac = new AudioContext();
  const dest = ac.createMediaStreamDestination();

  const displayAudio = displayStream.getAudioTracks();
  if (displayAudio.length > 0) {
    ac.createMediaStreamSource(new MediaStream([displayAudio[0]])).connect(dest);
  }
  const micAudio = micStream.getAudioTracks();
  if (micAudio.length > 0) {
    ac.createMediaStreamSource(new MediaStream([micAudio[0]])).connect(dest);
  }

  const out = new MediaStream();
  for (const t of displayStream.getVideoTracks()) out.addTrack(t);
  for (const t of dest.stream.getAudioTracks()) out.addTrack(t);
  return out;
}

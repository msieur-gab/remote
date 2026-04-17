# TODO

## Trimmer: replace real-time re-encode with WebCodecs

**Problem:** The current trimmer plays the source video back through `HTMLVideoElement` and captures it via `MediaRecorder` + `captureStream()`. This is a real-time pipeline, so any playback jitter (CPU spikes, tab throttling, buffer underruns) produces audible clicks/pops in the exported file and can let video/audio drift out of sync.

**Fix:** Rewrite `js/services/trimmer.js` on top of the WebCodecs API.
- Decode source with `VideoDecoder` + `AudioDecoder` offline (no real-time constraint).
- Re-encode selected range with `VideoEncoder` + `AudioEncoder`.
- Mux into a container with a lightweight library (`mp4-muxer` or `webm-muxer`, ~20KB ESM, no native deps).
- Progress based on frames processed, not wall time.

**Scope:**
- Replace `trimVideo()` implementation; keep the same `{ start, end, onProgress }` signature so `trimmer-view.js` does not change.
- Feature-detect WebCodecs and fall back to the current `MediaRecorder` path with a warning banner for older browsers.

**Compatibility:** Desktop Chrome / Edge, Firefox 130+, Safari 16.4+.

**Alternative considered:** `ffmpeg.wasm` gives frame-accurate stream-copy trim but adds ~30MB first-load cost and requires cross-origin isolation headers on the host. Revisit only if WebCodecs proves insufficient.

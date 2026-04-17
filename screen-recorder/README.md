# Screen Recorder

On-device screen recording, trimming, and download — delivered as a static PWA with an optional one-click launcher bookmarklet.

## Features

- Record any screen, window, or browser tab with `getDisplayMedia()`
- Optional system audio + microphone mix
- Saves recordings locally in IndexedDB (never leaves the device)
- Library view: rename, download, delete
- Trim view: scrub start/end, preview, export as a new recording
- Installable PWA with offline service worker
- Launcher bookmarklet opens the PWA with `?autostart=1`

## Run locally

Screen capture requires a secure context. Use any static server over HTTPS or `http://localhost`:

```
cd screen-recorder
python3 -m http.server 8080
# open http://localhost:8080
```

## Deploy

Serve the `screen-recorder/` folder as static files on any HTTPS host (GitHub Pages, Netlify, Cloudflare Pages, etc.).

## Structure

```
screen-recorder/
├── index.html
├── manifest.webmanifest
├── sw.js
├── css/styles.css
├── icons/icon.svg
├── js/
│   ├── app.js
│   ├── components/
│   │   ├── recorder-view.js
│   │   ├── library-view.js
│   │   └── trimmer-view.js
│   ├── services/
│   │   ├── recorder.js
│   │   ├── storage.js
│   │   └── trimmer.js
│   └── utils/
│       ├── dom.js
│       ├── time.js
│       └── download.js
└── bookmarklet/
    ├── bookmarklet.js
    └── README.md
```

## Notes

- Trimming uses `MediaRecorder` + `HTMLVideoElement.captureStream()` to re-encode the selected range. It is lossy and roughly real-time. A future pass could bundle `ffmpeg.wasm` behind a toggle for frame-accurate, stream-copy trimming.
- iOS Safari does not support `getDisplayMedia()`; recording there is not possible. Desktop Safari, Chrome, Edge, and Firefox are supported.

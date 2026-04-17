const CACHE = 'screen-recorder-v1';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/styles.css',
  './js/app.js',
  './js/components/recorder-view.js',
  './js/components/library-view.js',
  './js/components/trimmer-view.js',
  './js/services/recorder.js',
  './js/services/storage.js',
  './js/services/trimmer.js',
  './js/utils/dom.js',
  './js/utils/time.js',
  './js/utils/download.js',
  './icons/icon.svg'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      const copy = res.clone();
      if (res.ok && new URL(req.url).origin === location.origin) {
        caches.open(CACHE).then((c) => c.put(req, copy));
      }
      return res;
    }).catch(() => caches.match('./index.html')))
  );
});

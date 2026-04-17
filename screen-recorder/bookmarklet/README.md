# Launcher bookmarklet

This bookmarklet opens the Screen Recorder PWA in a new tab and starts a recording immediately.

## Easiest: generate it from the app

1. Host this project somewhere HTTPS (GitHub Pages, Netlify, Cloudflare Pages, local dev over HTTPS).
2. Open the PWA in the browser.
3. Click **Get launcher bookmarklet** on the Record tab.
4. Drag the "Record Screen" link onto your bookmarks bar.

The generated code uses the PWA's own origin, so it is always correct.

## Manual install

Replace `__PWA_URL__` in `bookmarklet.js` with the full URL to your `index.html` (e.g. `https://example.com/screen-recorder/index.html`), minify it, and create a new bookmark whose URL is:

```
javascript:(function(){window.open('https://example.com/screen-recorder/index.html?autostart=1','_blank','noopener');})();
```

## Why a launcher instead of in-page recording?

Many sites (banks, GitHub, social networks) ship a strict Content Security Policy that silently blocks bookmarklet scripts from running in their page. Opening the PWA in a new tab sidesteps CSP entirely — the recorder runs in its own trusted origin and still captures whatever screen, window, or tab you pick.

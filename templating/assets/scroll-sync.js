/**
 * Scroll-sync. Vanilla JS, no shadow DOM.
 *
 * Desktop: hides inline figures, shows the active one in a sticky aside.
 * Mobile: passes through — figures stay inline.
 *
 * Configurable via data-* attributes on the scroll container:
 *   data-media-position   "left" | "right"   default "right"
 *   data-split             "C:M" e.g. "2:3"  default "1:1"  (content : media)
 *   data-zone-down         0..1               default 0.30
 *   data-zone-up           0..1               default 0.45
 *   data-bottom-threshold  0..1               default 0.95
 *   data-sticky-headers    "h1,h2"            default ""
 */

export function initScrollSync(container, panel) {
  if (innerWidth < 768) return null;
  const article = container.querySelector('article') || container;
  const figs = [...article.querySelectorAll('figure[data-media]')];
  if (!figs.length) return null;

  const cfg = readConfig(container);
  applyLayout(container, cfg);

  const slot = panel.querySelector('figure') || panel;
  document.body.classList.add('sync-active');

  let idx = -1, dir = 'down', lastY = 0, raf = false;
  let stickyOffset = computeStickyOffset(container, cfg.stickyHeaders);

  function show(i) {
    if (i === idx || i < 0 || i >= figs.length) return;
    if (idx >= 0 && idx < figs.length) figs[idx].removeAttribute('data-active');
    figs[i].setAttribute('data-active', '');
    idx = i;
    slot.innerHTML = figs[i].innerHTML;
    panel.dispatchEvent(new CustomEvent('media-change', {
      bubbles: true,
      detail: { index: i, element: figs[i], isFirst: i === 0, isLast: i === figs.length - 1 }
    }));
  }

  function tick() {
    const y = container.scrollTop, h = container.clientHeight;
    const max = container.scrollHeight - h;
    const baseZone = (dir === 'down' ? cfg.zoneDown : cfg.zoneUp) * h;
    const line = y + baseZone + stickyOffset;
    const r = container.getBoundingClientRect();

    let active = 0;
    for (let i = 0; i < figs.length; i++) {
      if (figs[i].getBoundingClientRect().top - r.top + y <= line) active = i;
      else break;
    }
    if (max > 0 && y / max > cfg.bottomThreshold) active = figs.length - 1;
    show(active);
  }

  function onScroll() {
    const y = container.scrollTop;
    if (Math.abs(y - lastY) > 5) { dir = y > lastY ? 'down' : 'up'; lastY = y; }
    if (!raf) { requestAnimationFrame(() => { tick(); raf = false; }); raf = true; }
  }

  let resizeTimer;
  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      stickyOffset = computeStickyOffset(container, cfg.stickyHeaders);
      tick();
    }, 150);
  }

  function destroy() {
    container.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', onResize);
    clearTimeout(resizeTimer);
    document.body.classList.remove('sync-active');
    slot.innerHTML = '';
    container.style.removeProperty('--scroll-sync-columns');
    container.removeAttribute('data-position');
  }

  show(0);
  container.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onResize, { passive: true });
  return { destroy };
}

function readConfig(el) {
  const d = el.dataset;
  const split = parseSplit(d.split || '1:1');
  return {
    position: d.mediaPosition === 'left' ? 'left' : 'right',
    splitContent: split.content,
    splitMedia: split.media,
    zoneDown: numOr(d.zoneDown, 0.30),
    zoneUp: numOr(d.zoneUp, 0.45),
    bottomThreshold: numOr(d.bottomThreshold, 0.95),
    stickyHeaders: (d.stickyHeaders || '').split(',').map(s => s.trim()).filter(Boolean),
  };
}

function parseSplit(s) {
  const [a, b] = String(s).split(':').map(p => parseFloat(p));
  if (isFinite(a) && isFinite(b) && a > 0 && b > 0) return { content: a, media: b };
  return { content: 1, media: 1 };
}

function numOr(v, fallback) {
  const n = parseFloat(v);
  return isFinite(n) ? n : fallback;
}

function applyLayout(container, cfg) {
  const cols = cfg.position === 'left'
    ? `${cfg.splitMedia}fr ${cfg.splitContent}fr`
    : `${cfg.splitContent}fr ${cfg.splitMedia}fr`;
  container.style.setProperty('--scroll-sync-columns', cols);
  container.setAttribute('data-position', cfg.position);
}

function computeStickyOffset(container, headers) {
  if (!headers.length) return 0;
  let max = 0;
  for (const tag of headers) {
    for (const el of container.querySelectorAll(tag)) {
      if (getComputedStyle(el).position === 'sticky') {
        max = Math.max(max, el.offsetHeight);
      }
    }
  }
  return max;
}

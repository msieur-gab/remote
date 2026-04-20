// Scroll-sync hydration for case-study pages.
// Without this script, figures stay inline with the prose — the page is
// still readable. With it, figures are lifted into a sticky left stage and
// each one stays visible until the next anchor crosses a trigger line
// roughly a third from the top of the visible scroll area.
//
// The scroll area may be the window (standard layout) or the case-study
// content column itself (fullscreen layout, where only the right side
// scrolls). Both are handled here.

(function () {
  const MIN_WIDTH = 60 * 16; // matches the 60rem breakpoint in styles.css
  const TRIGGER_RATIO = 0.35;

  const articles = Array.from(document.querySelectorAll('[data-scroll-sync]'));
  if (!articles.length) return;

  // Walk up the ancestor chain until we find an element whose overflow-y
  // actually scrolls. Fall back to window when none does.
  const findScrollSource = (el) => {
    let node = el;
    while (node && node !== document.body && node !== document.documentElement) {
      const style = getComputedStyle(node);
      const oy = style.overflowY;
      if ((oy === 'auto' || oy === 'scroll') && node.scrollHeight > node.clientHeight) {
        return node;
      }
      node = node.parentElement;
    }
    return window;
  };

  const sourceRect = (source) => {
    if (source === window) {
      return { top: 0, height: window.innerHeight };
    }
    const r = source.getBoundingClientRect();
    return { top: r.top, height: r.height };
  };

  const hydrate = (article) => {
    if (article.dataset.hydrated === 'true') return;
    if (window.innerWidth < MIN_WIDTH) return;

    const body = article.querySelector('.case-study-body');
    const content = article.querySelector('.case-study-content');
    if (!body || !content) return;

    const figures = Array.from(content.querySelectorAll('figure[data-sync]'));
    if (figures.length < 2) return;

    const stage = document.createElement('aside');
    stage.className = 'sync-stage';
    stage.setAttribute('aria-hidden', 'true');

    const frame = document.createElement('div');
    frame.className = 'sync-frame';
    stage.appendChild(frame);

    figures.forEach((fig, index) => {
      const clone = fig.cloneNode(true);
      clone.removeAttribute('data-sync');
      clone.dataset.syncIndex = String(index);
      if (index === 0) clone.classList.add('is-active');
      frame.appendChild(clone);

      const anchor = document.createElement('span');
      anchor.className = 'sync-anchor';
      anchor.setAttribute('aria-hidden', 'true');
      anchor.dataset.syncIndex = String(index);
      fig.parentNode.insertBefore(anchor, fig);
    });

    body.appendChild(stage);
    article.dataset.hydrated = 'true';

    const anchors = Array.from(content.querySelectorAll('.sync-anchor'));
    const frames = Array.from(frame.querySelectorAll('figure'));
    // Determine scroll source after the layout settles — the .case-study-content
    // only becomes a scroll container once the fullscreen layout applies.
    const scrollSource = findScrollSource(content);

    let activeIndex = 0;
    let ticking = false;

    const setActive = (next) => {
      if (next === activeIndex) return;
      if (next < 0 || next >= frames.length) return;
      frames[activeIndex].classList.remove('is-active');
      frames[next].classList.add('is-active');
      activeIndex = next;
    };

    const recompute = () => {
      const { top, height } = sourceRect(scrollSource);
      const line = top + height * TRIGGER_RATIO;
      let next = 0;
      for (let i = 0; i < anchors.length; i++) {
        const anchorTop = anchors[i].getBoundingClientRect().top;
        if (anchorTop <= line) next = i;
        else break;
      }
      setActive(next);
    };

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        recompute();
        ticking = false;
      });
    };

    scrollSource.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    recompute();

    article._scrollSyncCleanup = () => {
      scrollSource.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  };

  const dehydrate = (article) => {
    if (article.dataset.hydrated !== 'true') return;
    if (article._scrollSyncCleanup) {
      article._scrollSyncCleanup();
      article._scrollSyncCleanup = null;
    }
    const stage = article.querySelector('.sync-stage');
    if (stage) stage.remove();
    article.querySelectorAll('.sync-anchor').forEach((a) => a.remove());
    delete article.dataset.hydrated;
  };

  const mql = matchMedia('(min-width: ' + (MIN_WIDTH / 16) + 'rem)');
  const onBreakpoint = () => {
    articles.forEach((article) => {
      if (mql.matches) hydrate(article);
      else dehydrate(article);
    });
  };
  onBreakpoint();
  if (mql.addEventListener) mql.addEventListener('change', onBreakpoint);
  else mql.addListener(onBreakpoint);
})();

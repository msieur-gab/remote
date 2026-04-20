// Scroll-sync hydration for case-study pages.
// Without this script, figures stay inline with the prose — the page is
// still readable. With it, figures are lifted into a sticky left stage and
// each one stays visible until the next anchor crosses a trigger line
// roughly a third from the top of the viewport.

(function () {
  const MIN_WIDTH = 60 * 16; // matches the 60rem breakpoint in styles.css
  const TRIGGER_RATIO = 0.35;

  const articles = Array.from(document.querySelectorAll('[data-scroll-sync]'));
  if (!articles.length) return;

  const hydrate = (article) => {
    if (article.dataset.hydrated === 'true') return;
    if (window.innerWidth < MIN_WIDTH) return;

    const body = article.querySelector('.case-study-body');
    const content = article.querySelector('.case-study-content');
    if (!body || !content) return;

    const figures = Array.from(content.querySelectorAll('figure[data-sync]'));
    if (figures.length < 2) return;

    // Build the sticky stage and insert it into the body. Placed via
    // grid-column in CSS so DOM order stays content-first for assistive tech.
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

      // Leave an anchor behind where the figure used to live so scroll
      // position keeps referencing the prose. The figure itself is hidden
      // via CSS when the article is hydrated.
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
      const line = window.innerHeight * TRIGGER_RATIO;
      // The active figure is the one whose anchor most recently crossed
      // the trigger line going down. "Pinned until the next enters":
      // once the next anchor's top is above the line, it takes over.
      let next = 0;
      for (let i = 0; i < anchors.length; i++) {
        const top = anchors[i].getBoundingClientRect().top;
        if (top <= line) next = i;
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

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    recompute();
  };

  const dehydrate = (article) => {
    if (article.dataset.hydrated !== 'true') return;
    const stage = article.querySelector('.sync-stage');
    if (stage) stage.remove();
    article.querySelectorAll('.sync-anchor').forEach((a) => a.remove());
    delete article.dataset.hydrated;
  };

  // Hydrate on load; react to viewport crossing the breakpoint so a narrow
  // window falls back to plain inline figures without a reload.
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

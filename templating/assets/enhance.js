// Progressive enhancement layer.
// The markup above must remain useful without this script.

(function () {
  // Mobile nav toggle — finds an existing button + nav, never injects markup.
  const toggle = document.querySelector('[data-toggle="nav"]');
  const nav = toggle && document.getElementById(toggle.getAttribute('aria-controls'));
  if (toggle && nav) {
    toggle.addEventListener('click', () => {
      const open = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!open));
      nav.dataset.open = String(!open);
    });
    nav.addEventListener('click', (event) => {
      if (event.target.tagName === 'A') {
        toggle.setAttribute('aria-expanded', 'false');
        nav.dataset.open = 'false';
      }
    });
  }

  // Nav dropdowns: close-on-outside-click, Escape, mutual exclusion, link-click.
  const dropdowns = Array.from(document.querySelectorAll('[data-dropdown]'));
  if (dropdowns.length) {
    const closeAll = (except) => {
      dropdowns.forEach((d) => { if (d !== except) d.open = false; });
    };
    dropdowns.forEach((d) => {
      d.addEventListener('toggle', () => { if (d.open) closeAll(d); });
      d.addEventListener('click', (e) => {
        if (e.target.closest('.dropdown-list a, .dropdown-footer a')) d.open = false;
      });
    });
    document.addEventListener('click', (e) => {
      if (!e.target.closest('[data-dropdown]')) closeAll(null);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const open = dropdowns.find((d) => d.open);
        if (open) {
          open.open = false;
          open.querySelector('summary').focus();
        }
      }
    });
  }

  // Highlight the current in-view section in the nav.
  const navLinks = Array.from(document.querySelectorAll('.site-nav a[href*="#"]'));
  const byId = new Map();
  navLinks.forEach((a) => {
    const id = a.getAttribute('href').split('#')[1];
    if (id) byId.set(id, a);
  });
  if (byId.size && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const link = byId.get(entry.target.id);
          if (!link) return;
          if (entry.isIntersecting) {
            navLinks.forEach((l) => l.removeAttribute('aria-current'));
            link.setAttribute('aria-current', 'page');
          }
        });
      },
      { rootMargin: '-40% 0px -55% 0px' }
    );
    byId.forEach((_, id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
  }
})();

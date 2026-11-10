(() => {
  // ----- Mobile menu -----
  const menuButton = document.querySelector('.menu-toggle');
  const nav = document.querySelector('#site-nav');
  if (menuButton && nav) {
    menuButton.hidden = false;
    const closeMenu = () => {
      menuButton.setAttribute('aria-expanded', 'false');
      nav.classList.remove('is-open');
    };
    menuButton.addEventListener('click', () => {
      const open = menuButton.getAttribute('aria-expanded') !== 'true';
      menuButton.setAttribute('aria-expanded', String(open));
      nav.classList.toggle('is-open', open);
    });
    nav.addEventListener('click', (e) => { if (e.target.closest('a')) closeMenu(); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && nav.classList.contains('is-open')) { closeMenu(); menuButton.focus(); }
    });
    document.addEventListener('click', (e) => { if (!e.target.closest('.site-header')) closeMenu(); });
    window.matchMedia('(max-width: 860px)').addEventListener('change', closeMenu);
  }

  // ----- Service timeline filters -----
  const filters = document.querySelector('.timeline-filters');
  if (filters) {
    filters.hidden = false;
    const tabs = [...filters.querySelectorAll('.filter-tab')];
    const items = [...document.querySelectorAll('.tl-item')];
    const years = [...document.querySelectorAll('.tl-year')];
    const apply = (filter) => {
      items.forEach((item) => { item.hidden = filter !== 'all' && item.dataset.type !== filter; });
      years.forEach((year) => { year.hidden = !year.querySelector('.tl-item:not([hidden])'); });
      tabs.forEach((tab) => {
        const active = tab.dataset.filter === filter;
        tab.classList.toggle('active', active);
        tab.setAttribute('aria-pressed', String(active));
      });
    };
    tabs.forEach((tab) => tab.addEventListener('click', () => apply(tab.dataset.filter)));
  }

  // ----- Gentle reveal on scroll -----
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!reduced && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08 });
    document.querySelectorAll('.focus-item, .pub, .news-grid, .post-card, .post-row, .tl-item, .service-row')
      .forEach((el) => {
        // Only animate things below the fold, so nothing visible on load flickers.
        if (el.getBoundingClientRect().top > window.innerHeight) {
          el.classList.add('reveal-pending');
          observer.observe(el);
        }
      });
  }
})();

// Startwell Education — site scripts
document.addEventListener('DOMContentLoaded', () => {
  // Mobile menu
  const nav = document.querySelector('.nav');
  document.querySelector('.menu-toggle')?.addEventListener('click', () => nav.classList.add('open'));
  document.querySelector('.nav-close')?.addEventListener('click', () => nav.classList.remove('open'));
  nav?.querySelectorAll('a').forEach(a => a.addEventListener('click', () => nav.classList.remove('open')));

  // Sticky header shadow + back to top
  const header = document.querySelector('.header');
  const toTop = document.querySelector('.to-top');
  const onScroll = () => {
    header?.classList.toggle('scrolled', window.scrollY > 20);
    toTop?.classList.toggle('show', window.scrollY > 500);
  };
  window.addEventListener('scroll', onScroll); onScroll();
  toTop?.addEventListener('click', () => window.scrollTo({ top: 0 }));

  // Reveal on scroll
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); } });
  }, { threshold: 0.12 });
  document.querySelectorAll('.reveal').forEach(el => io.observe(el));

  // Animated counters
  const co = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      const el = e.target, target = +el.dataset.count, dur = 1600, start = performance.now();
      const tick = now => {
        const p = Math.min((now - start) / dur, 1);
        el.textContent = Math.floor(target * (1 - Math.pow(1 - p, 3)));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick); co.unobserve(el);
    });
  }, { threshold: 0.5 });
  document.querySelectorAll('[data-count]').forEach(el => co.observe(el));

  // Tabs (academics)
  document.querySelectorAll('.tab-btn').forEach(btn => btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab)?.classList.add('active');
  }));

  // Gallery filters
  const items = [...document.querySelectorAll('.g-item')];
  document.querySelectorAll('.filters .tab-btn').forEach(btn => btn.addEventListener('click', () => {
    const f = btn.dataset.filter;
    items.forEach(i => i.classList.toggle('hide', f !== 'all' && i.dataset.cat !== f));
  }));

  // Lightbox
  const lb = document.querySelector('.lightbox');
  if (lb) {
    const img = lb.querySelector('img'), cap = lb.querySelector('.lb-cap');
    let idx = 0;
    const visible = () => items.filter(i => !i.classList.contains('hide'));
    const show = i => {
      const list = visible(); idx = (i + list.length) % list.length;
      const it = list[idx];
      img.src = it.querySelector('img').src;
      cap.textContent = it.querySelector('.cap')?.childNodes[0]?.textContent.trim() || '';
      lb.classList.add('open');
    };
    items.forEach(it => it.addEventListener('click', () => show(visible().indexOf(it))));
    lb.querySelector('.lb-close').onclick = () => lb.classList.remove('open');
    lb.querySelector('.lb-prev').onclick = () => show(idx - 1);
    lb.querySelector('.lb-next').onclick = () => show(idx + 1);
    lb.addEventListener('click', e => { if (e.target === lb) lb.classList.remove('open'); });
    document.addEventListener('keydown', e => {
      if (!lb.classList.contains('open')) return;
      if (e.key === 'Escape') lb.classList.remove('open');
      if (e.key === 'ArrowLeft') show(idx - 1);
      if (e.key === 'ArrowRight') show(idx + 1);
    });
  }

  // Contact form (front-end only — connect to a backend/form service to receive messages)
  const form = document.querySelector('#contactForm');
  form?.addEventListener('submit', e => {
    e.preventDefault();
    form.querySelector('.form-success').classList.add('show');
    form.reset();
  });

  // Footer year
  document.querySelectorAll('.year-now').forEach(el => el.textContent = new Date().getFullYear());
});

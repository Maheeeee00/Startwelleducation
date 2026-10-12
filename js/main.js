// Startwell Education — site scripts
// Preloader: hide once the page has loaded (or after 2.5s at most)
(() => {
  const hide = () => document.querySelector('.preloader')?.classList.add('done');
  window.addEventListener('load', () => setTimeout(hide, 300));
  setTimeout(hide, 2500);
})();

document.addEventListener('DOMContentLoaded', () => {
  // Scroll progress bar
  const bar = document.querySelector('.scroll-progress');
  const updateBar = () => {
    const h = document.documentElement.scrollHeight - window.innerHeight;
    if (bar) bar.style.width = (h > 0 ? (window.scrollY / h) * 100 : 0) + '%';
  };
  window.addEventListener('scroll', updateBar, { passive: true }); updateBar();

  // Subtle parallax on the hero photo
  const heroBg = document.querySelector('.hero-bg');
  if (heroBg && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    window.addEventListener('scroll', () => {
      if (window.scrollY < window.innerHeight) heroBg.style.backgroundPositionY = `calc(40% + ${window.scrollY * 0.25}px)`;
    }, { passive: true });
  }

  // Mark gallery items for reveal animation
  document.querySelectorAll('.g-item').forEach(g => g.classList.add('reveal'));

  // Mobile menu
  const nav = document.querySelector('.nav');
  document.querySelector('.menu-toggle:not(.nav-close)')?.addEventListener('click', () => nav.classList.add('open'));
  document.querySelector('.nav-close')?.addEventListener('click', () => nav.classList.remove('open'));
  nav?.querySelectorAll('a').forEach(a => a.addEventListener('click', () => nav.classList.remove('open')));
  // Mobile dropdown toggles
  document.querySelectorAll('.sub-toggle').forEach(btn => btn.addEventListener('click', e => {
    e.preventDefault();
    btn.closest('.nav-item').classList.toggle('open');
  }));

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

  // Forms -> Google Sheets (via Google Apps Script web app, URL set in js/config.js)
  document.querySelectorAll('form[data-sheet]').forEach(form => {
    const ok = form.querySelector('.form-success');
    const err = form.querySelector('.form-error');
    const btn = form.querySelector('button[type="submit"]');
    const btnHTML = btn.innerHTML;
    const cfg = window.SW_CONFIG || {};
    const showError = msg => { err.innerHTML = '<i class="fa-solid fa-circle-exclamation"></i> ' + msg; err.classList.add('show'); };

    form.addEventListener('submit', async e => {
      e.preventDefault();
      ok.classList.remove('show'); err.classList.remove('show');
      if (!form.reportValidity()) return;
      if (!cfg.SHEETS_URL) {
        showError(`Online form is not connected yet. Please call us on <a href="tel:${(cfg.PHONE || '').replace(/\s/g, '')}">${cfg.PHONE || ''}</a>.`);
        return;
      }
      const data = new URLSearchParams(new FormData(form));
      data.set('form_type', form.dataset.sheet);
      data.set('page', location.href);
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Sending…';
      try {
        const res = await fetch(cfg.SHEETS_URL, { method: 'POST', body: data });
        const out = await res.json();
        if (!out.ok) throw new Error(out.error || 'Could not save');
        ok.querySelector('.ref').textContent = out.ref || '';
        ok.classList.add('show');
        form.reset();
        ok.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } catch (ex) {
        const msg = ex && ex.message && !/fetch|network|JSON/i.test(ex.message) ? ex.message : 'Could not send right now';
        showError(`${msg}. Please try again, or call us on <a href="tel:${(cfg.PHONE || '').replace(/\s/g, '')}">${cfg.PHONE || ''}</a>.`);
      } finally {
        btn.disabled = false;
        btn.innerHTML = btnHTML;
      }
    });
  });

  // Holiday list: grey out past holidays and highlight the next one
  const today = new Date(); today.setHours(0, 0, 0, 0);
  let nextMarked = false;
  document.querySelectorAll('.hol[data-end]').forEach(h => {
    const end = new Date(h.dataset.end + 'T00:00:00');
    if (end < today) { h.classList.add('past'); h.querySelector('.htag').textContent = 'Passed'; }
    else if (!nextMarked) { h.classList.add('next'); h.querySelector('.htag').textContent = 'Next Holiday'; nextMarked = true; }
  });

  // Footer year
  document.querySelectorAll('.year-now').forEach(el => el.textContent = new Date().getFullYear());
});

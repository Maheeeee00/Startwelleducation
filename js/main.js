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
  document.querySelectorAll('.tab-btn[data-tab]').forEach(btn => btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn[data-tab]').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab)?.classList.add('active');
  }));

  // Gallery filters (event delegation, so photos loaded from the Sheet work too)
  const filterBar = document.querySelector('.filters');
  let currentFilter = 'all';
  const applyFilter = () => document.querySelectorAll('.g-item').forEach(i =>
    i.classList.toggle('hide', currentFilter !== 'all' && i.dataset.cat !== currentFilter));
  filterBar?.addEventListener('click', e => {
    const b = e.target.closest('[data-filter]'); if (!b) return;
    filterBar.querySelectorAll('[data-filter]').forEach(x => x.classList.toggle('active', x === b));
    currentFilter = b.dataset.filter; applyFilter();
  });

  // Lightbox
  const lb = document.querySelector('.lightbox');
  const galleryEl = document.querySelector('.gallery');
  if (lb && galleryEl) {
    const img = lb.querySelector('img'), cap = lb.querySelector('.lb-cap');
    let idx = 0;
    const visible = () => [...document.querySelectorAll('.g-item')].filter(i => !i.classList.contains('hide'));
    const show = i => {
      const list = visible(); if (!list.length) return;
      idx = (i + list.length) % list.length;
      const it = list[idx];
      img.src = it.querySelector('img').src;
      cap.textContent = it.querySelector('.cap')?.childNodes[0]?.textContent.trim() || '';
      lb.classList.add('open');
    };
    galleryEl.addEventListener('click', e => { const it = e.target.closest('.g-item'); if (it) show(visible().indexOf(it)); });
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

  // File uploads (admission photo / B-Form): images are resized in the browser before sending
  const readAsDataURL = blob => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(blob); });
  const loadImage = file => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(file); });
  const resize = (image, max, quality) => {
    const k = Math.min(1, max / Math.max(image.naturalWidth, image.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(image.naturalWidth * k); c.height = Math.round(image.naturalHeight * k);
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
    g.drawImage(image, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', quality);
  };
  document.querySelectorAll('input[type="file"][data-upload]').forEach(input => {
    const box = input.closest('.upload');
    const info = box.querySelector('.upload-info');
    const preview = box.querySelector('.upload-preview');
    const defaultInfo = info.innerHTML;
    input.addEventListener('change', () => {
      const file = input.files[0];
      input._payload = null; box.classList.remove('has-file', 'bad');
      preview.innerHTML = ''; info.innerHTML = defaultInfo;
      if (!file) { input._ready = null; return; }
      input._ready = (async () => {
        const isImg = /^image\/(jpeg|png|webp|heic|heif)$/i.test(file.type) || /\.(jpe?g|png|webp)$/i.test(file.name);
        const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
        if (isPdf && input.dataset.upload === 'doc') {
          if (file.size > 5 * 1024 * 1024) throw new Error('PDF is larger than 5 MB');
          const url = await readAsDataURL(file);
          input._payload = { data: url.split(',')[1], type: 'application/pdf' };
          preview.innerHTML = '<i class="fa-solid fa-file-pdf"></i>';
        } else if (isImg) {
          const image = await loadImage(file);
          const big = resize(image, 1400, 0.82);
          input._payload = { data: big.split(',')[1], type: 'image/jpeg', thumb: resize(image, 160, 0.7) };
          preview.innerHTML = `<img src="${big}" alt="">`;
        } else {
          throw new Error(input.dataset.upload === 'doc' ? 'Please choose a photo or a PDF' : 'Please choose a photo (JPG or PNG)');
        }
        box.classList.add('has-file');
        info.innerHTML = `<strong>${file.name.replace(/[<>&"]/g, '')}</strong><small>Ready to upload · <u>change</u></small>`;
      })().catch(ex => {
        input.value = ''; input._payload = null; box.classList.add('bad');
        info.innerHTML = `<strong>${ex.message || 'Could not read this file'}</strong><small>Try another file</small>`;
      });
    });
  });

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
      const data = new URLSearchParams();
      for (const [k, v] of new FormData(form)) if (typeof v === 'string') data.append(k, v);
      const uploads = [...form.querySelectorAll('input[type="file"][data-upload]')];
      await Promise.all(uploads.map(u => u._ready).filter(Boolean));
      uploads.forEach(u => {
        if (!u._payload) return;
        data.set('file_' + u.name, u._payload.data);
        data.set('file_' + u.name + '_type', u._payload.type);
        if (u._payload.thumb) data.set('thumb_' + u.name, u._payload.thumb);
      });
      data.set('form_type', form.dataset.sheet);
      data.set('page', location.href);
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> ' + (uploads.some(u => u._payload) ? 'Uploading…' : 'Sending…');
      try {
        const res = await fetch(cfg.SHEETS_URL, { method: 'POST', body: data });
        const out = await res.json();
        if (!out.ok) throw new Error(out.error || 'Could not save');
        ok.querySelector('.ref').textContent = out.ref || '';
        ok.classList.add('show');
        form.reset();
        uploads.forEach(u => u.dispatchEvent(new Event('change')));
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
  const markHolidays = () => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    let nextMarked = false;
    document.querySelectorAll('.hol[data-end]').forEach(h => {
      const end = new Date(h.dataset.end + 'T00:00:00');
      if (isNaN(end)) return;
      if (end < today) { h.classList.add('past'); h.querySelector('.htag').textContent = 'Passed'; }
      else if (!nextMarked) { h.classList.add('next'); h.querySelector('.htag').textContent = 'Next Holiday'; nextMarked = true; }
    });
  };
  markHolidays();

  // ---------- Live content from the Google Sheet (gallery, news ticker, holidays) ----------
  // The built-in content shows first; the Sheet's version replaces it when it arrives.
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const safeSrc = u => { u = String(u || '').trim(); return /^https:\/\//i.test(u) || /^[\w\-./ %]+$/.test(u) ? u : ''; };
  const safeLink = u => { u = String(u || '').trim(); return /^https?:\/\//i.test(u) || /^[\w\-./]+(#[\w-]*)?$/.test(u) ? u : ''; };
  const slug = s => String(s || 'events').toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const renderContent = d => {
    const move = document.querySelector('.ticker-move');
    if (move && d.news && d.news.length) {
      const icons = ['fa-bullhorn', 'fa-star', 'fa-calendar-check', 'fa-graduation-cap'];
      const g = d.news.map((n, i) => { const l = safeLink(n.link);
        return `<a href="${l || '#'}"><i class="fa-solid ${icons[i % icons.length]}"></i>${esc(n.text)}</a>`; }).join('');
      move.innerHTML = `<div class="ticker-group">${g}</div><div class="ticker-group" aria-hidden="true">${g}</div>`;
    }
    if (galleryEl && d.gallery && d.gallery.length) {
      galleryEl.innerHTML = d.gallery.filter(p => safeSrc(p.src)).map(p =>
        `<div class="g-item reveal visible" data-cat="${slug(p.category)}"><img src="${esc(safeSrc(p.src))}" alt="${esc(p.title)}" loading="lazy" referrerpolicy="no-referrer"><div class="cap">${esc(p.title)}<small>${esc(p.category)}</small></div></div>`).join('');
      if (filterBar) {
        const cats = [...new Set(d.gallery.map(p => p.category || 'Events'))];
        if (!cats.some(c => slug(c) === currentFilter)) currentFilter = 'all';
        filterBar.innerHTML = [['all', 'All'], ...cats.map(c => [slug(c), c])].map(([k, label]) =>
          `<button class="tab-btn${k === currentFilter ? ' active' : ''}" data-filter="${esc(k)}">${esc(label)}</button>`).join('');
        applyFilter();
      }
    }
    const holList = document.querySelector('.hol-list');
    if (holList && d.holidays && d.holidays.length) {
      holList.innerHTML = d.holidays.map(h =>
        `<div class="hol" data-end="${esc(h.end)}"><span class="dot"></span><strong>${esc(h.name)}</strong><span class="when">${esc(h.when)}</span><span class="htag">Holiday</span></div>`).join('');
      markHolidays();
    }
  };
  const cfgUrl = (window.SW_CONFIG || {}).SHEETS_URL;
  if (cfgUrl && document.querySelector('.ticker-move, .gallery, .hol-list')) {
    const KEY = 'sw_content_v1';
    let last = '';
    try { const c = JSON.parse(localStorage.getItem(KEY) || 'null'); if (c && Date.now() - c.t < 864e5) { last = JSON.stringify(c.d); renderContent(c.d); } } catch (x) {}
    const ctrl = new AbortController(); setTimeout(() => ctrl.abort(), 10000);
    fetch(cfgUrl + (cfgUrl.includes('?') ? '&' : '?') + 'action=content', { signal: ctrl.signal })
      .then(r => r.json())
      .then(d => {
        if (!d || !d.ok) return;
        const str = JSON.stringify({ gallery: d.gallery, news: d.news, holidays: d.holidays });
        if (str !== last) renderContent(d);
        try { localStorage.setItem(KEY, JSON.stringify({ t: Date.now(), d: JSON.parse(str) })); } catch (x) {}
      })
      .catch(() => { /* keep the built-in content */ });
  }

  // Footer year
  document.querySelectorAll('.year-now').forEach(el => el.textContent = new Date().getFullYear());
});

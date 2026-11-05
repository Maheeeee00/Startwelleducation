/*
 * Edit PDF — Start Well Education "SWE Tools"
 * Change existing text, add text, draw, highlight, white-out, boxes, images/signatures.
 * Runs entirely in the browser: pdf.js shows the pages, pdf-lib writes the edited file.
 * Nothing is uploaded.
 */
(function () {
  var root = document.querySelector('[data-ed]');
  if (!root) return;
  var L = window.PDFLib, PJ = window.pdfjsLib;
  if (PJ) PJ.GlobalWorkerOptions.workerSrc = 'js/vendor/pdfjs/pdf.worker.min.js';

  function q(s) { return document.querySelector(s); }
  var input = q('[data-ed-input]'), drop = q('[data-ed-drop]'), pagesEl = q('[data-ed-pages]'),
      statusEl = q('[data-ed-status]'), hintEl = q('[data-ed-hint]'), nameEl = q('[data-ed-name]'),
      colorIn = q('[data-ed-color]'), sizeIn = q('[data-ed-size]'), widthIn = q('[data-ed-width]'),
      boldBtn = q('[data-ed-bold]'), saveBtn = q('[data-ed-save]'), imgIn = q('[data-ed-img]'),
      undoBtn = q('[data-ed-undo]'), delBtn = q('[data-ed-del]'), zoomLabel = q('[data-ed-zoomlabel]');

  var LINE = 1.2, BASE = 0.95;              // line height and baseline (× font size)
  var HINTS = {
    select: 'Click anything you added to select it. Drag to move it. Press Delete to remove it.',
    edittext: 'Click any text in the PDF to change it. Type your new words, then click outside.',
    text: 'Click where you want new text, then type.',
    draw: 'Draw with your mouse or finger — great for signatures and ticks.',
    highlight: 'Drag across text to highlight it.',
    whiteout: 'Drag over anything you want to hide. It will be covered with white.',
    rect: 'Drag to draw a box.',
    image: 'Choose a picture or a photo of your signature. Then drag it into place.'
  };
  var toolColor = { text: '#111111', edittext: '#111111', draw: '#1a3ec8', highlight: '#ffeb3b', rect: '#e53935', select: '#111111', whiteout: '#ffffff', image: '#111111' };

  var S = { file: null, bytes: null, pdf: null, pages: [], objs: [], tool: 'select', sel: null, zoom: 1, scale: 1, hist: [], nextId: 1, token: 0 };

  function status(msg, kind) { statusEl.textContent = msg || ''; statusEl.className = 'status' + (kind ? ' ' + kind : ''); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function byId(id) { for (var i = 0; i < S.objs.length; i++) if (S.objs[i].id === id) return S.objs[i]; return null; }
  function snapshot() { S.hist.push(JSON.stringify(S.objs)); if (S.hist.length > 80) S.hist.shift(); syncButtons(); }
  function syncButtons() {
    undoBtn.disabled = !S.hist.length;
    delBtn.disabled = !S.sel;
    saveBtn.disabled = !S.pdf;
    var o = S.sel && byId(S.sel);
    boldBtn.setAttribute('aria-pressed', String(!!(o && o.bold)));
  }

  // ---------------- loading ----------------
  function pick(fl) {
    var f = Array.prototype.find.call(fl, function (x) { return x.type === 'application/pdf' || /\.pdf$/i.test(x.name); });
    if (!f) { status('Please choose a PDF file.', 'err'); return; }
    load(f);
  }
  input.addEventListener('change', function () { if (input.files.length) pick(input.files); input.value = ''; });
  ['dragenter', 'dragover'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('over'); }); });
  ['dragleave', 'drop'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('over'); }); });
  drop.addEventListener('drop', function (e) { pick(e.dataTransfer.files); });
  q('[data-ed-change]').addEventListener('click', function () {
    if (S.objs.length && !window.confirm('Open a different PDF? Your unsaved changes will be lost.')) return;
    input.click();
  });

  function load(file) {
    if (!PJ || !L) { status('The PDF libraries did not load. Refresh the page and try again.', 'err'); return; }
    var my = ++S.token;
    status('Opening “' + file.name + '”…');
    file.arrayBuffer().then(function (buf) {
      var bytes = new Uint8Array(buf);
      return L.PDFDocument.load(bytes.slice()).then(function () { return bytes; }, function (e) {
        throw new Error(/encrypt/i.test(String(e && e.message)) ? '“' + file.name + '” is password-protected. Unlock it first, then try again.' : '“' + file.name + '” could not be opened. Is it a real PDF file?');
      });
    }).then(function (bytes) {
      return PJ.getDocument({ data: bytes.slice() }).promise.then(function (pdf) { return { pdf: pdf, bytes: bytes }; });
    }).then(function (r) {
      if (my !== S.token) { r.pdf.destroy(); return; }
      if (S.pdf) S.pdf.destroy();
      S.file = file; S.bytes = r.bytes; S.pdf = r.pdf; S.objs = []; S.hist = []; S.sel = null; S.zoom = 1;
      nameEl.textContent = file.name;
      drop.hidden = true; root.hidden = false;
      return buildPages();
    }).then(function () {
      if (my !== S.token) return;
      setTool('edittext');
      status('“' + file.name + '” opened (' + S.pdf.numPages + ' page' + (S.pdf.numPages === 1 ? '' : 's') + '). Choose a tool above and start editing.');
      syncButtons();
    }).catch(function (e) { console.error(e); status(e.message || 'Could not open this PDF.', 'err'); });
  }

  // ---------------- pages ----------------
  var io = 'IntersectionObserver' in window ? new IntersectionObserver(function (ents) {
    ents.forEach(function (en) { if (en.isIntersecting) renderPage(+en.target.dataset.n); });
  }, { root: pagesEl, rootMargin: '600px 0px' }) : null;

  function buildPages() {
    pagesEl.innerHTML = ''; S.pages = [];
    var jobs = [];
    for (var n = 1; n <= S.pdf.numPages; n++) jobs.push(S.pdf.getPage(n));
    return Promise.all(jobs).then(function (pgs) {
      pgs.forEach(function (page, i) {
        var vp = page.getViewport({ scale: 1 });
        var el = document.createElement('div');
        el.className = 'ed-page'; el.dataset.n = i;
        el.innerHTML = '<canvas></canvas><div class="ed-hots"></div><svg class="ed-svg" xmlns="http://www.w3.org/2000/svg"></svg><div class="ed-layer"></div><span class="ed-pno">Page ' + (i + 1) + '</span>';
        pagesEl.appendChild(el);
        S.pages.push({ n: i, page: page, w: vp.width, h: vp.height, el: el, canvas: el.querySelector('canvas'),
          svg: el.querySelector('svg'), layer: el.querySelector('.ed-layer'), hots: el.querySelector('.ed-hots'),
          rendered: -1, items: null });
      });
      layout();
    });
  }

  function fitScale() {
    var avail = Math.max(260, pagesEl.clientWidth - 28);
    var ws = S.pages.map(function (p) { return p.w; }).sort(function (a, b) { return a - b; });
    var typical = ws[Math.floor((ws.length - 1) / 2)] || 1;   // most pages fit the width; a wider odd page scrolls sideways
    return Math.min(1.6, avail / typical);
  }
  function layout() {
    S.scale = fitScale() * S.zoom;
    zoomLabel.textContent = Math.round(S.zoom * 100) + '%';
    S.pages.forEach(function (p) {
      var w = p.w * S.scale, h = p.h * S.scale;
      p.el.style.width = w + 'px'; p.el.style.height = h + 'px';
      p.svg.setAttribute('width', w); p.svg.setAttribute('height', h); p.svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
      p.rendered = -1;
      if (io) { io.unobserve(p.el); io.observe(p.el); } else renderPage(p.n);
      drawObjs(p.n); drawHots(p);
    });
  }

  function renderPage(n) {
    var p = S.pages[n];
    if (!p || p.rendered === S.scale) return;
    var sc = S.scale; p.rendered = sc;
    var vp = p.page.getViewport({ scale: sc }), dpr = Math.min(2, window.devicePixelRatio || 1);
    var c = p.canvas;
    c.width = Math.floor(vp.width * dpr); c.height = Math.floor(vp.height * dpr);
    c.style.width = vp.width + 'px'; c.style.height = vp.height + 'px';
    if (p.task) p.task.cancel();
    p.task = p.page.render({ canvasContext: c.getContext('2d'), viewport: vp, transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : null });
    p.task.promise.then(function () { p.task = null; }, function () {});
    if (!p.items) {
      p.page.getTextContent().then(function (tc) { p.items = lines(tc, p); drawHots(p); });
    }
  }

  // Group pdf.js text pieces into editable lines (in page points, top-left origin, as the reader sees it)
  function lines(tc, p) {
    var vp = p.page.getViewport({ scale: 1 }), out = [];
    tc.items.forEach(function (it) {
      if (!it.str || !it.str.trim()) return;
      var t = PJ.Util.transform(vp.transform, it.transform);
      var size = Math.hypot(t[2], t[3]);
      if (size < 2) return;
      var horiz = Math.abs(t[1]) < 0.01 * size && Math.abs(t[2]) < 0.01 * size; // skip rotated text
      if (!horiz) return;
      var st = tc.styles[it.fontName] || {};
      out.push({ x: t[4], base: t[5], w: it.width * (vp.scale || 1), size: size, str: it.str,
                 family: /serif/i.test(st.fontFamily || '') && !/sans/i.test(st.fontFamily || '') ? 'serif' : /mono/i.test(st.fontFamily || '') ? 'mono' : 'sans' });
    });
    out.sort(function (a, b) { return Math.abs(a.base - b.base) < a.size * 0.3 ? a.x - b.x : a.base - b.base; });
    var merged = [];
    out.forEach(function (it) {
      var last = merged[merged.length - 1];
      if (last && Math.abs(last.base - it.base) < it.size * 0.3 && Math.abs(last.size - it.size) < it.size * 0.25 &&
          it.x - (last.x + last.w) < it.size * 0.6 && it.x >= last.x) {
        var gap = it.x - (last.x + last.w);
        last.str += (gap > it.size * 0.15 && !/\s$/.test(last.str) && !/^\s/.test(it.str) ? ' ' : '') + it.str;
        last.w = it.x + it.w - last.x;
      } else merged.push(Object.assign({}, it));
    });
    return merged.map(function (m, i) { m.i = i; return m; });
  }

  function drawHots(p) {
    if (!p.items) return;
    var sc = S.scale;
    p.hots.innerHTML = p.items.map(function (m) {
      if (m.used) return '';
      return '<div class="ed-hot" data-i="' + m.i + '" title="Click to edit" style="left:' + (m.x - 1) * sc + 'px;top:' + (m.base - m.size * 0.95) * sc +
        'px;width:' + (m.w + 2) * sc + 'px;height:' + m.size * 1.2 * sc + 'px"></div>';
    }).join('');
  }

  // ---------------- drawing objects on screen ----------------
  function drawObjs(n) {
    var p = S.pages[n]; if (!p) return;
    var sc = S.scale, svg = '', html = '';
    S.objs.forEach(function (o) {
      if (o.page !== n) return;
      var sel = o.id === S.sel ? ' sel' : '';
      if (o.type === 'rect') {
        var fill = o.mode === 'whiteout' ? '#ffffff' : o.mode === 'highlight' ? o.color : 'none';
        var op = o.mode === 'highlight' ? ' fill-opacity="0.38"' : '';
        var stroke = o.mode === 'box' ? ' stroke="' + o.color + '" stroke-width="' + o.width * sc + '"' : (o.mode === 'whiteout' ? ' stroke="#cfd6e4" stroke-dasharray="4 3" stroke-width="1" class="wo-edge"' : '');
        svg += '<rect data-id="' + o.id + '" class="ed-o' + sel + '" x="' + o.x * sc + '" y="' + o.y * sc + '" width="' + o.w * sc + '" height="' + o.h * sc + '" fill="' + fill + '"' + op + stroke + '/>';
      } else if (o.type === 'path') {
        svg += '<polyline data-id="' + o.id + '" class="ed-o' + sel + '" fill="none" stroke="' + o.color + '" stroke-width="' + o.width * sc +
          '" stroke-linecap="round" stroke-linejoin="round" points="' + o.pts.map(function (pt) { return (pt[0] * sc).toFixed(1) + ',' + (pt[1] * sc).toFixed(1); }).join(' ') + '"/>';
      } else if (o.type === 'image') {
        html += '<div data-id="' + o.id + '" class="ed-o ed-img' + sel + '" style="left:' + o.x * sc + 'px;top:' + o.y * sc + 'px;width:' + o.w * sc + 'px;height:' + o.h * sc + 'px"><img src="' + o.src + '" alt="" draggable="false"><span class="ed-handle"></span></div>';
      } else if (o.type === 'text') {
        if (o.cover) html += '<div class="ed-cover" style="left:' + o.cover.x * sc + 'px;top:' + o.cover.y * sc + 'px;width:' + o.cover.w * sc + 'px;height:' + o.cover.h * sc + 'px;background:' + o.cover.color + '"></div>';
        html += '<div data-id="' + o.id + '" class="ed-o ed-text' + sel + '" style="left:' + o.x * sc + 'px;top:' + o.y * sc + 'px;font-size:' + o.size * sc + 'px;color:' + o.color +
          ';font-weight:' + (o.bold ? 700 : 400) + ';font-family:' + cssFamily(o.family) + '">' + esc(o.text) + '</div>';
      }
    });
    p.svg.innerHTML = svg;
    p.layer.innerHTML = html;
  }
  function redrawAll() { S.pages.forEach(function (p) { drawObjs(p.n); }); syncButtons(); }
  function cssFamily(f) { return f === 'serif' ? "'Times New Roman',Times,serif" : f === 'mono' ? "'Courier New',Courier,monospace" : 'Helvetica,Arial,sans-serif'; }

  // ---------------- tools ----------------
  function setTool(t) {
    S.tool = t;
    root.className = root.className.replace(/\btool-\S+/g, '').trim() + ' tool-' + t;
    document.querySelectorAll('[data-tool]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.tool === t)); });
    hintEl.textContent = HINTS[t] || '';
    colorIn.value = toolColor[t] || '#111111';
    if (t !== 'select' && t !== 'text' && t !== 'edittext') select(null);
    if (t === 'image') imgIn.click();
  }
  document.querySelectorAll('[data-tool]').forEach(function (b) { b.addEventListener('click', function () { setTool(b.dataset.tool); }); });

  function select(id, focusText) {
    if (S.sel && S.sel !== id) finishText(S.sel);
    S.sel = id;
    S.pages.forEach(function (p) { p.el.querySelectorAll('.ed-o').forEach(function (e) { e.classList.toggle('sel', e.dataset.id == id); }); });
    var o = id && byId(id);
    if (o) {
      if (o.color && o.type !== 'image') colorIn.value = o.color;
      if (o.type === 'text') sizeIn.value = String(nearestSize(o.size));
      if (o.width) widthIn.value = String(o.width);
    }
    if (o && o.type === 'text' && focusText) editText(o);
    syncButtons();
  }
  function nearestSize(s) {
    var best = 12, opts = Array.prototype.map.call(sizeIn.options, function (x) { return +x.value; });
    opts.forEach(function (v) { if (Math.abs(v - s) < Math.abs(best - s)) best = v; });
    if (Math.abs(best - s) > 0.6) { // add the exact size so it shows correctly
      var r = Math.round(s * 10) / 10, op = document.createElement('option'); op.value = r; op.textContent = r;
      sizeIn.appendChild(op); return r;
    }
    return best;
  }
  function elFor(id) { return pagesEl.querySelector('[data-id="' + id + '"]'); }

  function editText(o) {
    var el = elFor(o.id); if (!el) return;
    el.contentEditable = 'true'; el.spellcheck = true; el.classList.add('editing');
    el.focus();
    var r = document.createRange(); r.selectNodeContents(el);
    var s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
  }
  function finishText(id) {
    var o = byId(id), el = elFor(id);
    if (!o || o.type !== 'text' || !el || el.contentEditable !== 'true') return;
    el.contentEditable = 'false'; el.classList.remove('editing');
    var t = el.innerText.replace(/ /g, ' ').replace(/\n$/, '');
    if (t !== o.text) { snapshot(); o.text = t; }
    if (!o.text.trim() && !o.cover) { S.objs = S.objs.filter(function (x) { return x !== o; }); drawObjs(o.page); }
  }

  // ---------------- pointer interaction ----------------
  var drag = null;
  function pt(e, p) { var r = p.el.getBoundingClientRect(); return [(e.clientX - r.left) / S.scale, (e.clientY - r.top) / S.scale]; }
  function clampPt(v, p) { return [Math.max(0, Math.min(p.w, v[0])), Math.max(0, Math.min(p.h, v[1]))]; }

  pagesEl.addEventListener('pointerdown', function (e) {
    var pageEl = e.target.closest('.ed-page'); if (!pageEl || e.button > 0) return;
    var p = S.pages[+pageEl.dataset.n], at = pt(e, p);
    var objEl = e.target.closest('.ed-o'), hot = e.target.closest('.ed-hot');

    if (objEl && objEl.classList.contains('editing')) return;          // typing / selecting text inside
    if (objEl && (S.tool === 'select' || S.tool === 'text' || S.tool === 'edittext' || S.tool === 'image')) {
      var o = byId(+objEl.dataset.id); if (!o) return;
      e.preventDefault();
      var resizing = e.target.classList.contains('ed-handle');
      select(o.id);
      drag = { kind: resizing ? 'resize' : 'move', o: o, p: p, start: at, orig: JSON.parse(JSON.stringify(o)), moved: false, id: e.pointerId };
      pageEl.setPointerCapture(e.pointerId);
      return;
    }
    if (S.tool === 'edittext' && hot) { e.preventDefault(); editExisting(p, p.items[+hot.dataset.i]); return; }
    if (S.sel) { finishText(S.sel); select(null); if (S.tool === 'select' || S.tool === 'edittext' || S.tool === 'text') return; }

    if (S.tool === 'text') {
      e.preventDefault(); snapshot();
      var size = +sizeIn.value;
      var t = { id: S.nextId++, type: 'text', page: p.n, x: at[0], y: at[1] - size * LINE / 2, text: 'Type here', size: size, color: colorIn.value, bold: boldBtn.getAttribute('aria-pressed') === 'true', family: 'sans' };
      S.objs.push(t); drawObjs(p.n); select(t.id, true);
      return;
    }
    if (S.tool === 'draw') {
      e.preventDefault(); snapshot();
      var path = { id: S.nextId++, type: 'path', page: p.n, pts: [at], color: colorIn.value, width: +widthIn.value };
      S.objs.push(path);
      drag = { kind: 'draw', o: path, p: p, id: e.pointerId };
      pageEl.setPointerCapture(e.pointerId); drawObjs(p.n);
      return;
    }
    if (S.tool === 'highlight' || S.tool === 'whiteout' || S.tool === 'rect') {
      e.preventDefault(); snapshot();
      var rc = { id: S.nextId++, type: 'rect', page: p.n, x: at[0], y: at[1], w: 0, h: 0, mode: S.tool === 'rect' ? 'box' : S.tool, color: colorIn.value, width: +widthIn.value };
      S.objs.push(rc);
      drag = { kind: 'box', o: rc, p: p, start: at, id: e.pointerId };
      pageEl.setPointerCapture(e.pointerId);
    }
  });

  pagesEl.addEventListener('pointermove', function (e) {
    if (!drag || e.pointerId !== drag.id) return;
    var p = drag.p, at = clampPt(pt(e, p), p), o = drag.o;
    if (drag.kind === 'draw') {
      var last = o.pts[o.pts.length - 1];
      if (Math.hypot(at[0] - last[0], at[1] - last[1]) * S.scale < 1.5) return;
      o.pts.push([Math.round(at[0] * 100) / 100, Math.round(at[1] * 100) / 100]);
    } else if (drag.kind === 'box') {
      o.x = Math.min(drag.start[0], at[0]); o.y = Math.min(drag.start[1], at[1]);
      o.w = Math.abs(at[0] - drag.start[0]); o.h = Math.abs(at[1] - drag.start[1]);
    } else {
      var dx = at[0] - drag.start[0], dy = at[1] - drag.start[1];
      if (!drag.moved && Math.hypot(dx, dy) * S.scale < 3) return;
      if (!drag.moved) { drag.moved = true; snapshot(); }
      var a = drag.orig;
      if (drag.kind === 'resize') {
        o.w = Math.max(8, a.w + dx); o.h = o.type === 'image' ? o.w * a.h / a.w : Math.max(6, a.h + dy);
      } else if (o.type === 'path') {
        o.pts = a.pts.map(function (q2) { return [q2[0] + dx, q2[1] + dy]; });
      } else {
        o.x = a.x + dx; o.y = a.y + dy;
        if (o.cover) { o.cover = a.cover; } // the white cover stays over the old text
      }
    }
    drawObjs(p.n);
  });

  function endDrag(e) {
    if (!drag || (e && e.pointerId !== drag.id)) return;
    var d = drag; drag = null;
    var o = d.o;
    if (d.kind === 'draw' && o.pts.length < 2) o.pts.push([o.pts[0][0] + 0.5, o.pts[0][1] + 0.5]); // a dot
    if (d.kind === 'box' && (o.w < 3 || o.h < 3)) { S.objs = S.objs.filter(function (x) { return x !== o; }); S.hist.pop(); }
    if ((d.kind === 'move') && !d.moved && o.type === 'text') { drawObjs(d.p.n); select(o.id, true); return; }
    drawObjs(d.p.n);
    if (d.kind === 'move' || d.kind === 'resize') select(o.id);
    syncButtons();
  }
  pagesEl.addEventListener('pointerup', endDrag);
  pagesEl.addEventListener('pointercancel', endDrag);

  pagesEl.addEventListener('input', function (e) {
    var el = e.target.closest('.ed-text.editing'); if (!el) return;
    var o = byId(+el.dataset.id); if (o && o.cover) { // grow the cover if the new text is wider than the old
      var wpx = el.getBoundingClientRect().width / S.scale;
      if (o.x + wpx > o.cover.x + o.cover.w) { o.cover.w = o.x + wpx - o.cover.x + 1; var cv = el.previousElementSibling; if (cv && cv.classList.contains('ed-cover')) cv.style.width = o.cover.w * S.scale + 'px'; }
    }
  });
  pagesEl.addEventListener('focusout', function (e) {
    var el = e.target.closest && e.target.closest('.ed-text.editing'); if (!el) return;
    setTimeout(function () { if (document.activeElement !== el) finishText(+el.dataset.id); }, 0);
  });

  // Edit text that is already in the PDF: cover it and put an editable copy on top
  function editExisting(p, m) {
    if (!m) return;
    var px = sample(p, m);
    snapshot();
    m.used = true; drawHots(p);
    var size = Math.round(m.size * 10) / 10;
    var o = { id: S.nextId++, type: 'text', page: p.n, x: m.x, y: m.base - size * BASE, text: m.str, size: size,
              color: px.ink, bold: false, family: m.family, source: m.i,
              cover: { x: m.x - 1, y: m.base - size * 1.0, w: m.w + 2, h: size * 1.28, color: px.paper } };
    S.objs.push(o); drawObjs(p.n); select(o.id, true);
  }
  // Guess the text colour (darkest pixel) and background colour (most common edge pixel) from the page image
  function sample(p, m) {
    var res = { ink: '#111111', paper: '#ffffff' };
    try {
      var c = p.canvas, k = c.width / (p.w * S.scale) * S.scale;
      var x = Math.max(0, Math.floor((m.x - 1) * k)), y = Math.max(0, Math.floor((m.base - m.size) * k));
      var w = Math.min(c.width - x, Math.ceil((m.w + 2) * k)), h = Math.min(c.height - y, Math.ceil(m.size * 1.3 * k));
      if (w < 1 || h < 1) return res;
      var d = c.getContext('2d').getImageData(x, y, w, h).data, darkest = 765, ink = null, counts = {};
      for (var i = 0; i < d.length; i += 4) {
        var s = d[i] + d[i + 1] + d[i + 2];
        if (s < darkest) { darkest = s; ink = [d[i], d[i + 1], d[i + 2]]; }
        var col = (i / 4) % w, row = Math.floor(i / 4 / w);
        if (row === 0 || row === h - 1 || col === 0 || col === w - 1) { var key = (d[i] >> 3) + ',' + (d[i + 1] >> 3) + ',' + (d[i + 2] >> 3); counts[key] = (counts[key] || 0) + 1; }
      }
      var hex = function (a) { return '#' + a.map(function (v) { return ('0' + v.toString(16)).slice(-2); }).join(''); };
      if (ink && darkest < 600) res.ink = hex(ink);
      var top = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; })[0];
      if (top) res.paper = hex(top.split(',').map(function (v) { return Math.min(255, (+v << 3) + 4); }));
      if (/^#f[89a-f]f[89a-f]f[89a-f]$/i.test(res.paper)) res.paper = '#ffffff';
    } catch (e) { /* canvas not ready */ }
    return res;
  }

  // ---------------- toolbar controls ----------------
  function changeSel(fn) { var o = S.sel && byId(S.sel); if (!o) return; snapshot(); fn(o); drawObjs(o.page); select(o.id, o.type === 'text' && false); }
  colorIn.addEventListener('input', function () {
    toolColor[S.tool] = colorIn.value;
    var o = S.sel && byId(S.sel);
    if (o && o.type !== 'image' && !(o.type === 'rect' && o.mode === 'whiteout')) { changeSel(function (x) { x.color = colorIn.value; }); }
  });
  sizeIn.addEventListener('change', function () { var o = S.sel && byId(S.sel); if (o && o.type === 'text') changeSel(function (x) { x.size = +sizeIn.value; }); });
  widthIn.addEventListener('change', function () { var o = S.sel && byId(S.sel); if (o && (o.type === 'path' || (o.type === 'rect' && o.mode === 'box'))) changeSel(function (x) { x.width = +widthIn.value; }); });
  boldBtn.addEventListener('click', function () {
    var o = S.sel && byId(S.sel);
    if (o && o.type === 'text') { changeSel(function (x) { x.bold = !x.bold; }); }
    else boldBtn.setAttribute('aria-pressed', String(boldBtn.getAttribute('aria-pressed') !== 'true'));
  });
  function del() {
    var o = S.sel && byId(S.sel); if (!o) return;
    snapshot();
    S.objs = S.objs.filter(function (x) { return x !== o; });
    if (o.source != null) { var p = S.pages[o.page]; if (p.items && p.items[o.source]) { p.items[o.source].used = false; drawHots(p); } }
    S.sel = null; drawObjs(o.page); syncButtons();
  }
  delBtn.addEventListener('click', del);
  function undo() {
    if (!S.hist.length) return;
    S.objs = JSON.parse(S.hist.pop()); S.sel = null;
    var used = {}; S.objs.forEach(function (o) { if (o.source != null) used[o.page + ':' + o.source] = true; });
    S.pages.forEach(function (p) { if (p.items) { p.items.forEach(function (m) { m.used = !!used[p.n + ':' + m.i]; }); drawHots(p); } });
    redrawAll();
  }
  undoBtn.addEventListener('click', undo);
  document.addEventListener('keydown', function (e) {
    if (root.hidden || !S.pdf) return;
    var typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) || document.activeElement.isContentEditable;
    if (typing) { if (e.key === 'Escape' && document.activeElement.isContentEditable) document.activeElement.blur(); return; }
    if ((e.key === 'Delete' || e.key === 'Backspace') && S.sel) { e.preventDefault(); del(); }
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); }
  });
  document.querySelectorAll('[data-ed-zoom]').forEach(function (b) {
    b.addEventListener('click', function () {
      if (S.sel) finishText(S.sel);
      S.zoom = Math.max(0.5, Math.min(3, Math.round((S.zoom + +b.dataset.edZoom) * 100) / 100));
      layout();
    });
  });
  var rt; window.addEventListener('resize', function () { if (!S.pdf || root.hidden) return; clearTimeout(rt); rt = setTimeout(layout, 250); });

  // Insert picture / signature into the page that is in view
  imgIn.addEventListener('change', function () {
    var f = imgIn.files[0]; imgIn.value = '';
    if (!f) { setTool('select'); return; }
    if (!/^image\//.test(f.type)) { status('Please choose a picture (JPG or PNG).', 'err'); return; }
    var url = URL.createObjectURL(f), im = new Image();
    im.onload = function () {
      var max = 1600, k = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight));
      var c = document.createElement('canvas'); c.width = Math.round(im.naturalWidth * k); c.height = Math.round(im.naturalHeight * k);
      c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      var png = /png|gif|webp/i.test(f.type), src = png ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', 0.9);
      var p = pageInView(), w = Math.min(p.w * 0.4, c.width), h = w * c.height / c.width;
      var top = Math.max(0, (pagesEl.scrollTop - p.el.offsetTop) / S.scale + 40);
      snapshot();
      var o = { id: S.nextId++, type: 'image', page: p.n, x: (p.w - w) / 2, y: Math.min(top, p.h - h), w: w, h: h, src: src };
      S.objs.push(o); drawObjs(p.n); setTool('select'); select(o.id);
      status('Picture added. Drag it into place; drag the corner to resize.');
    };
    im.onerror = function () { URL.revokeObjectURL(url); status('That picture could not be opened. Try a JPG or PNG.', 'err'); };
    im.src = url;
  });
  function pageInView() {
    var mid = pagesEl.scrollTop + pagesEl.clientHeight / 3, best = S.pages[0];
    S.pages.forEach(function (p) { if (p.el.offsetTop <= mid) best = p; });
    return best;
  }

  // ---------------- saving with pdf-lib ----------------
  function visibleBox(pg) {
    var c = pg.getCropBox(), r = ((pg.getRotation().angle % 360) + 360) % 360;
    var b = { r: r, pw: c.width, ph: c.height, ox: c.x, oy: c.y };
    if (r === 90 || r === 270) { b.w = c.height; b.h = c.width; } else { b.w = c.width; b.h = c.height; }
    return b;
  }
  function toPdf(box, x, y) { // x,y from bottom-left of the page as seen
    var r = box.r, X = x, Y = y;
    if (r === 90) { X = box.pw - y; Y = x; }
    else if (r === 180) { X = box.pw - x; Y = box.ph - y; }
    else if (r === 270) { X = y; Y = box.ph - x; }
    return { x: X + box.ox, y: Y + box.oy, rotate: r };
  }
  function rgb(hex) { var n = parseInt(String(hex).replace('#', ''), 16) || 0; return L.rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255); }
  function canWrite(font, s) { try { font.widthOfTextAtSize(s, 10); return true; } catch (e) { return false; } }
  function lineImage(doc, s, size, color, bold, family) {
    var c = document.createElement('canvas'), g = c.getContext('2d'), SH = 4;
    var css = (bold ? '700 ' : '') + size + 'px ' + cssFamily(family) + ",'Segoe UI Emoji','Noto Color Emoji','Noto Nastaliq Urdu',sans-serif";
    g.font = css; var w = g.measureText(s).width + size * 0.2, h = size * LINE;
    c.width = Math.ceil(w * SH); c.height = Math.ceil(h * SH);
    g = c.getContext('2d'); g.scale(SH, SH); g.font = css; g.fillStyle = color; g.textBaseline = 'alphabetic'; g.fillText(s, 0, size * BASE);
    return new Promise(function (res) { c.toBlob(res, 'image/png'); })
      .then(function (b) { return b.arrayBuffer(); })
      .then(function (buf) { return doc.embedPng(buf); })
      .then(function (im) { return { image: im, w: c.width / SH, h: c.height / SH }; });
  }
  function dataBytes(src) { var b = atob(src.split(',')[1]), u = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }
  var FONT = { sans: ['Helvetica', 'HelveticaBold'], serif: ['TimesRoman', 'TimesRomanBold'], mono: ['Courier', 'CourierBold'] };

  saveBtn.addEventListener('click', function () {
    if (S.sel) finishText(S.sel);
    if (!S.objs.length) { status('You haven’t changed anything yet. Pick a tool and edit the PDF first.', 'err'); return; }
    saveBtn.disabled = true; status('Saving… please wait.');
    var doc, fonts = {};
    function font(o) {
      var key = FONT[o.family || 'sans'][o.bold ? 1 : 0];
      if (!fonts[key]) fonts[key] = doc.embedFont(L.StandardFonts[key]);
      return fonts[key];
    }
    L.PDFDocument.load(S.bytes.slice()).then(function (d) {
      doc = d;
      return S.objs.reduce(function (chain, o) {
        return chain.then(function () {
          var pg = doc.getPage(o.page), box = visibleBox(pg);
          if (o.type === 'rect') {
            var opt = { width: o.w, height: o.h };
            if (o.mode === 'whiteout') opt.color = L.rgb(1, 1, 1);
            else if (o.mode === 'highlight') { opt.color = rgb(o.color); opt.opacity = 0.38; }
            else { opt.borderColor = rgb(o.color); opt.borderWidth = o.width; }
            var p0 = toPdf(box, o.x, box.h - o.y - o.h);
            pg.drawRectangle(Object.assign(opt, { x: p0.x, y: p0.y, rotate: L.degrees(p0.rotate) }));
            return;
          }
          if (o.type === 'path') {
            var col = rgb(o.color);
            for (var i = 1; i < o.pts.length; i++) {
              var a = toPdf(box, o.pts[i - 1][0], box.h - o.pts[i - 1][1]), b = toPdf(box, o.pts[i][0], box.h - o.pts[i][1]);
              pg.drawLine({ start: { x: a.x, y: a.y }, end: { x: b.x, y: b.y }, thickness: o.width, color: col, lineCap: L.LineCapStyle.Round });
            }
            return;
          }
          if (o.type === 'image') {
            var bytes = dataBytes(o.src);
            return (/^data:image\/png/.test(o.src) ? doc.embedPng(bytes) : doc.embedJpg(bytes)).then(function (im) {
              var p1 = toPdf(box, o.x, box.h - o.y - o.h);
              pg.drawImage(im, { x: p1.x, y: p1.y, width: o.w, height: o.h, rotate: L.degrees(p1.rotate) });
            });
          }
          if (o.type === 'text') {
            if (o.cover) {
              var cv = o.cover, p2 = toPdf(box, cv.x, box.h - cv.y - cv.h);
              pg.drawRectangle({ x: p2.x, y: p2.y, width: cv.w, height: cv.h, color: rgb(cv.color), rotate: L.degrees(p2.rotate) });
            }
            return font(o).then(function (f) {
              var lines = o.text.split('\n'), lh = o.size * LINE;
              return lines.reduce(function (c2, ln, k) {
                return c2.then(function () {
                  if (!ln) return;
                  var topY = o.y + k * lh;
                  if (canWrite(f, ln)) {
                    var p3 = toPdf(box, o.x, box.h - (topY + o.size * BASE));
                    pg.drawText(ln, { x: p3.x, y: p3.y, size: o.size, font: f, color: rgb(o.color), rotate: L.degrees(p3.rotate) });
                    return;
                  }
                  return lineImage(doc, ln, o.size, o.color, o.bold, o.family).then(function (im) {
                    var p4 = toPdf(box, o.x, box.h - topY - im.h);
                    pg.drawImage(im.image, { x: p4.x, y: p4.y, width: im.w, height: im.h, rotate: L.degrees(p4.rotate) });
                  });
                });
              }, Promise.resolve());
            });
          }
        });
      }, Promise.resolve());
    }).then(function () { return doc.save(); }).then(function (out) {
      var name = S.file.name.replace(/\.pdf$/i, '') + '-edited.pdf';
      var url = URL.createObjectURL(new Blob([out], { type: 'application/pdf' }));
      var a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
      status('Done! Saved ' + name + ' with ' + S.objs.length + ' change' + (S.objs.length === 1 ? '' : 's') + '. You can keep editing and save again.', 'ok');
    }).catch(function (e) {
      console.error(e); status((e && e.message) || 'Something went wrong while saving.', 'err');
    }).then(function () { syncButtons(); });
  });

  syncButtons();
})();

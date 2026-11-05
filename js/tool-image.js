/* Image Resizer & Compressor — SWE Tools (runs in the browser, nothing uploaded) */
(function () {
  var input = document.getElementById('imgInput');
  if (!input) return;
  var drop = document.getElementById('imgDrop');
  var runBtn = document.getElementById('imgRun');
  var allBtn = document.getElementById('imgAll');
  var statusEl = document.getElementById('imgStatus');
  var list = document.getElementById('imgResults');
  var dimSel = document.getElementById('imgDim');
  var targetSel = document.getElementById('imgTarget');
  var files = [], outputs = [];

  function size(n) { return n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB'; }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function status(msg, kind) { statusEl.textContent = msg || ''; statusEl.className = 'status' + (kind ? ' ' + kind : ''); }
  function baseName(n) { return n.replace(/\.[^.]+$/, ''); }

  function clearOutputs() { outputs.forEach(function (o) { URL.revokeObjectURL(o.url); }); outputs = []; allBtn.hidden = true; }

  function showPicked() {
    clearOutputs();
    list.innerHTML = files.map(function (f, i) {
      return '<li><img alt="" data-prev="' + i + '"><div class="meta"><strong>' + esc(f.name) + '</strong><small>' + size(f.size) + ' · ready</small></div>' +
        '<button type="button" class="btn btn-ghost" data-rm="' + i + '" aria-label="Remove ' + esc(f.name) + '">✕</button></li>';
    }).join('');
    files.forEach(function (f, i) { var u = URL.createObjectURL(f); var im = list.querySelector('[data-prev="' + i + '"]'); im.onload = function () { URL.revokeObjectURL(u); }; im.src = u; });
    runBtn.disabled = !files.length;
    status(files.length ? files.length + ' photo' + (files.length === 1 ? '' : 's') + ' chosen. Pick a size, then press “Resize photos”.' : '');
  }

  function add(fl) {
    var picked = Array.prototype.filter.call(fl, function (f) { return /^image\//.test(f.type) || /\.(jpe?g|png|webp|gif|bmp)$/i.test(f.name); });
    if (!picked.length) { status('Please choose photo files (JPG, PNG or WebP).', 'err'); return; }
    files = files.concat(picked).slice(0, 30);
    showPicked();
  }
  input.addEventListener('change', function () { add(input.files); input.value = ''; });
  ['dragenter', 'dragover'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('over'); }); });
  ['dragleave', 'drop'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('over'); }); });
  drop.addEventListener('drop', function (e) { add(e.dataTransfer.files); });
  list.addEventListener('click', function (e) {
    var b = e.target.closest('[data-rm]'); if (!b || outputs.length) return;
    files.splice(+b.getAttribute('data-rm'), 1); showPicked();
  });

  function loadImage(file) {
    return new Promise(function (res, rej) {
      var u = URL.createObjectURL(file), im = new Image();
      im.onload = function () { URL.revokeObjectURL(u); res(im); };
      im.onerror = function () { URL.revokeObjectURL(u); rej(new Error('“' + file.name + '” could not be opened. Try a JPG or PNG.')); };
      im.src = u;
    });
  }
  function toBlob(canvas, q) { return new Promise(function (res) { canvas.toBlob(res, 'image/jpeg', q); }); }

  function draw(img, w, h, crop) {
    var c = document.createElement('canvas'); c.width = w; c.height = h;
    var g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, w, h);
    g.imageSmoothingQuality = 'high';
    if (crop) { // cover-crop to passport ratio, centred slightly high (faces)
      var sw = img.naturalWidth, sh = img.naturalHeight, r = w / h, cw = sw, ch = sw / r;
      if (ch > sh) { ch = sh; cw = sh * r; }
      var sx = (sw - cw) / 2, sy = Math.max(0, (sh - ch) * 0.35);
      g.drawImage(img, sx, sy, cw, ch, 0, 0, w, h);
    } else g.drawImage(img, 0, 0, w, h);
    return c;
  }

  // Resize to the chosen dimensions, then lower JPEG quality (and size if needed) to fit the KB target.
  function process(file) {
    var dim = dimSel.value, target = +targetSel.value * 1024;
    return loadImage(file).then(function (img) {
      var W = img.naturalWidth, H = img.naturalHeight, w = W, h = H, crop = false;
      if (dim === 'passport') { w = 413; h = 531; crop = true; }
      else if (+dim > 0) { var k = Math.min(1, +dim / Math.max(W, H)); w = Math.round(W * k); h = Math.round(H * k); }
      var tries = 0;
      function attempt(cw, ch) {
        var canvas = draw(img, cw, ch, crop);
        if (!target) return toBlob(canvas, 0.9).then(function (b) { return { blob: b, w: cw, h: ch }; });
        var lo = 0.35, hi = 0.92, best = null;
        function step(i) {
          if (i > 6) return Promise.resolve(best);
          var q = (lo + hi) / 2;
          return toBlob(canvas, q).then(function (b) {
            if (b.size <= target) { best = b; lo = q; } else hi = q;
            return step(i + 1);
          });
        }
        return toBlob(canvas, 0.92).then(function (b) {
          if (b.size <= target) return { blob: b, w: cw, h: ch };
          return step(0).then(function (b2) {
            if (b2) return { blob: b2, w: cw, h: ch };
            if (++tries > 8 || cw < 120) return toBlob(canvas, 0.35).then(function (b3) { return { blob: b3, w: cw, h: ch, missed: true }; });
            return attempt(Math.round(cw * 0.82), Math.round(ch * 0.82)); // still too big: shrink dimensions
          });
        });
      }
      return attempt(w, h);
    });
  }

  runBtn.addEventListener('click', function () {
    if (!files.length) return;
    clearOutputs();
    runBtn.disabled = true;
    status('Working… please wait.');
    var lis = list.querySelectorAll('li'), missed = 0;
    files.reduce(function (p, f, i) {
      return p.then(function () { return process(f); }).then(function (r) {
        var url = URL.createObjectURL(r.blob), name = baseName(f.name) + '-small.jpg';
        outputs.push({ url: url, name: name });
        if (r.missed) missed++;
        var saved = Math.min(99, Math.round((1 - r.blob.size / f.size) * 100));
        lis[i].innerHTML = '<img alt="" src="' + url + '"><div class="meta"><strong>' + esc(name) + '</strong><small>' +
          size(f.size) + ' → <b>' + size(r.blob.size) + '</b> · ' + r.w + '×' + r.h + ' px ' +
          (saved > 0 ? '<span class="saved">(' + saved + '% smaller)</span>' : '') + '</small></div>' +
          '<a class="btn btn-primary" href="' + url + '" download="' + esc(name) + '"><i class="fa-solid fa-download"></i> Download</a>';
      }).catch(function (e) {
        lis[i].querySelector('small').textContent = e.message;
      });
    }, Promise.resolve()).then(function () {
      runBtn.disabled = false;
      allBtn.hidden = outputs.length < 2;
      status(outputs.length ? 'Done! ' + outputs.length + ' photo' + (outputs.length === 1 ? '' : 's') + ' ready to download.' +
        (missed ? ' ' + missed + ' couldn’t reach the size limit without getting too small — try a bigger limit.' : '') : 'Nothing could be resized.', outputs.length ? 'ok' : 'err');
    });
  });

  allBtn.addEventListener('click', function () {
    outputs.forEach(function (o, i) {
      setTimeout(function () { var a = document.createElement('a'); a.href = o.url; a.download = o.name; document.body.appendChild(a); a.click(); a.remove(); }, i * 300);
    });
  });
  [dimSel, targetSel].forEach(function (s) { s.addEventListener('change', function () { if (outputs.length) { showPicked(); } }); });
})();

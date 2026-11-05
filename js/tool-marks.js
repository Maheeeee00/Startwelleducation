/* Marks & Percentage Calculator — SWE Tools (runs in the browser) */
(function () {
  var rowsEl = document.getElementById('marksRows');
  if (!rowsEl) return;
  var KEY = 'swe_marks_v1';
  var DEFAULT = ['English', 'Urdu', 'Mathematics', 'Science', 'Islamiat', 'Social Studies']
    .map(function (n) { return { name: n, obt: '', tot: 100 }; });
  var passEl = document.getElementById('passMark');
  var $ = function (id) { return document.getElementById(id); };

  function load() {
    try { var d = JSON.parse(localStorage.getItem(KEY) || 'null'); if (d && d.rows && d.rows.length) { passEl.value = d.pass || 33; return d.rows; } } catch (e) {}
    return DEFAULT.map(function (r) { return Object.assign({}, r); });
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify({ rows: rows, pass: passEl.value })); } catch (e) {} }
  var rows = load();

  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function num(v) { var n = parseFloat(v); return isFinite(n) ? n : NaN; }

  function grade(p) {
    if (p >= 80) return ['A+', 'Exceptional'];
    if (p >= 70) return ['A', 'Excellent'];
    if (p >= 60) return ['B', 'Very Good'];
    if (p >= 50) return ['C', 'Good'];
    if (p >= 40) return ['D', 'Fair'];
    if (p >= 33) return ['E', 'Satisfactory'];
    return ['F', 'Needs improvement'];
  }

  function render() {
    rowsEl.innerHTML = rows.map(function (r, i) {
      return '<div class="mark-row" data-i="' + i + '">' +
        '<input type="text" data-k="name" value="' + esc(r.name) + '" placeholder="Subject" aria-label="Subject name">' +
        '<input type="number" inputmode="decimal" min="0" step="any" data-k="obt" value="' + esc(r.obt) + '" placeholder="0" aria-label="Marks obtained in ' + esc(r.name || 'subject') + '">' +
        '<input type="number" inputmode="decimal" min="1" step="any" data-k="tot" value="' + esc(r.tot) + '" placeholder="100" aria-label="Total marks for ' + esc(r.name || 'subject') + '">' +
        '<button type="button" class="rm" aria-label="Remove ' + esc(r.name || 'subject') + '">✕</button>' +
        '<div class="sub-pct"></div></div>';
    }).join('');
    calc();
  }

  function calc() {
    var pass = Math.min(100, Math.max(1, num(passEl.value) || 33));
    var obt = 0, tot = 0, counted = 0, passed = 0, bad = false;
    rowsEl.querySelectorAll('.mark-row').forEach(function (rowEl) {
      var r = rows[+rowEl.dataset.i];
      var o = num(r.obt), t = num(r.tot);
      var oIn = rowEl.querySelector('[data-k="obt"]'), tIn = rowEl.querySelector('[data-k="tot"]');
      var info = rowEl.querySelector('.sub-pct');
      var err = '';
      if (r.obt !== '' && (isNaN(o) || o < 0)) err = 'Marks can’t be negative.';
      else if (!(t > 0)) err = r.obt !== '' ? 'Enter the total marks.' : '';
      else if (o > t) err = 'Obtained marks are more than the total.';
      oIn.classList.toggle('bad', r.obt !== '' && (isNaN(o) || o < 0 || (t > 0 && o > t)));
      tIn.classList.toggle('bad', r.obt !== '' && !(t > 0));
      info.className = 'sub-pct';
      if (err) { info.textContent = err; info.classList.add('fail'); bad = true; return; }
      if (r.obt === '') { info.textContent = ''; return; }
      var p = o / t * 100;
      obt += o; tot += t; counted++;
      var ok = p >= pass; if (ok) passed++;
      info.textContent = p.toFixed(1).replace(/\.0$/, '') + '% · ' + grade(p)[0] + (ok ? '' : ' · Fail');
      if (!ok) info.classList.add('fail');
    });
    var pct = tot ? obt / tot * 100 : 0;
    $('resPct').textContent = counted ? (Math.round(pct * 100) / 100).toString() : '0';
    $('resObt').textContent = fmt(obt);
    $('resTot').textContent = fmt(tot);
    $('resPass').textContent = passed + ' / ' + counted;
    var g = $('resGrade'), msg = $('resMsg');
    if (!counted) { g.textContent = '—'; g.className = 'result-grade'; msg.textContent = bad ? 'Please fix the marks shown in red.' : 'Enter your marks to see the result.'; }
    else {
      var gr = grade(pct);
      g.textContent = 'Grade ' + gr[0]; g.className = 'result-grade' + (gr[0] === 'F' ? ' f' : '');
      var failed = counted - passed;
      msg.textContent = bad ? 'Some marks need fixing (shown in red).' :
        failed ? 'Failed in ' + failed + ' subject' + (failed === 1 ? '' : 's') + ' (below ' + pass + '%).' :
        gr[1] + '! Passed in all subjects.';
    }
    save();
  }
  function fmt(n) { return (Math.round(n * 100) / 100).toString(); }

  rowsEl.addEventListener('input', function (e) {
    var row = e.target.closest('.mark-row'); if (!row) return;
    rows[+row.dataset.i][e.target.dataset.k] = e.target.value;
    calc();
  });
  rowsEl.addEventListener('click', function (e) {
    var b = e.target.closest('.rm'); if (!b) return;
    rows.splice(+b.closest('.mark-row').dataset.i, 1);
    if (!rows.length) rows.push({ name: '', obt: '', tot: 100 });
    render();
  });
  $('addSubject').addEventListener('click', function () {
    rows.push({ name: '', obt: '', tot: 100 }); render();
    var last = rowsEl.querySelector('.mark-row:last-child input'); if (last) last.focus();
  });
  $('resetMarks').addEventListener('click', function () {
    rows = DEFAULT.map(function (r) { return Object.assign({}, r); }); passEl.value = 33; render();
  });
  passEl.addEventListener('input', calc);

  // Print just the result
  $('printMarks').addEventListener('click', function () {
    var list = rows.filter(function (r) { return r.obt !== '' && num(r.tot) > 0; });
    var html = '<div id="printArea" style="font-family:Arial,sans-serif;padding:24px;color:#111">' +
      '<h2 style="margin:0 0 4px">Start Well Education — Marks Summary</h2>' +
      '<p style="margin:0 0 16px;color:#555">Calculated with SWE Tools · ' + new Date().toLocaleDateString() + '</p>' +
      '<table style="border-collapse:collapse;width:100%;font-size:14px"><tr>' +
      ['Subject', 'Obtained', 'Total', '%', 'Grade'].map(function (h) { return '<th style="border:1px solid #999;padding:8px;text-align:left;background:#f2f2f2">' + h + '</th>'; }).join('') + '</tr>' +
      list.map(function (r) {
        var p = num(r.obt) / num(r.tot) * 100;
        return '<tr>' + [esc(r.name || '—'), fmt(num(r.obt)), fmt(num(r.tot)), p.toFixed(1), grade(p)[0]].map(function (c) { return '<td style="border:1px solid #999;padding:8px">' + c + '</td>'; }).join('') + '</tr>';
      }).join('') +
      '</table><p style="font-size:16px;margin-top:16px"><b>Total:</b> ' + $('resObt').textContent + ' / ' + $('resTot').textContent +
      ' &nbsp; <b>Percentage:</b> ' + $('resPct').textContent + '% &nbsp; <b>' + esc($('resGrade').textContent) + '</b></p></div>';
    var box = document.createElement('div'); box.innerHTML = html; document.body.appendChild(box);
    document.body.classList.add('printing-marks');
    var done = function () { document.body.classList.remove('printing-marks'); box.remove(); window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    window.print();
    setTimeout(done, 1500);
  });

  render();
})();

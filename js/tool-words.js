/* Word Counter — SWE Tools (runs in the browser; text kept only on this device) */
(function () {
  var ta = document.getElementById('wcText');
  if (!ta) return;
  var KEY = 'swe_words_v1';
  var $ = function (id) { return document.getElementById(id); };
  var limitIn = $('wcLimit'), box = $('wcLimitBox'), bar = $('wcBar'), msg = $('wcLimitMsg');
  var seg = (window.Intl && Intl.Segmenter) ? new Intl.Segmenter(undefined, { granularity: 'word' }) : null;

  function countWords(t) {
    if (!t.trim()) return 0;
    if (seg) { var n = 0; for (var s of seg.segment(t)) if (s.isWordLike) n++; return n; }
    return t.trim().split(/\s+/).length;
  }
  function mins(words, wpm) {
    if (!words) return '0 min';
    var m = words / wpm;
    return m < 1 ? Math.max(1, Math.round(m * 60)) + ' sec' : Math.round(m) + ' min';
  }
  function update() {
    var t = ta.value;
    var w = countWords(t);
    $('wcWords').textContent = w.toLocaleString();
    $('wcChars').textContent = Array.from(t).length.toLocaleString();
    $('wcCharsNs').textContent = Array.from(t.replace(/\s/g, '')).length.toLocaleString();
    $('wcSent').textContent = (t.trim() ? (t.match(/[^.!?؟۔\n]+[.!?؟۔]+|[^.!?؟۔\n]+$/gm) || []).filter(function (s) { return s.trim(); }).length : 0).toLocaleString();
    $('wcPara').textContent = (t.trim() ? t.split(/\n\s*\n|\n/).filter(function (p) { return p.trim(); }).length : 0).toLocaleString();
    $('wcRead').textContent = mins(w, 200);
    $('wcSpeak').textContent = mins(w, 130);
    var lim = parseInt(limitIn.value, 10);
    if (lim > 0) {
      box.hidden = false;
      bar.style.width = Math.min(100, w / lim * 100) + '%';
      var over = w > lim;
      box.classList.toggle('over', over);
      msg.textContent = over ? (w - lim) + ' word' + (w - lim === 1 ? '' : 's') + ' over the limit of ' + lim + '.' : (lim - w) + ' word' + (lim - w === 1 ? '' : 's') + ' left (limit ' + lim + ').';
    } else box.hidden = true;
    try { localStorage.setItem(KEY, JSON.stringify({ t: t, l: limitIn.value })); } catch (e) {}
  }
  try { var d = JSON.parse(localStorage.getItem(KEY) || 'null'); if (d) { ta.value = d.t || ''; limitIn.value = d.l || ''; } } catch (e) {}
  ta.addEventListener('input', update);
  limitIn.addEventListener('input', update);
  $('wcClear').addEventListener('click', function () { ta.value = ''; update(); ta.focus(); });
  $('wcCopy').addEventListener('click', function () {
    var b = this, old = b.innerHTML;
    var ok = function () { b.innerHTML = '<i class="fa-solid fa-check"></i> Copied'; setTimeout(function () { b.innerHTML = old; }, 1500); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(ta.value).then(ok, function () { ta.select(); document.execCommand('copy'); ok(); });
    else { ta.select(); document.execCommand('copy'); ok(); }
  });
  update();
})();

/* Start Well Education — Online C++ compiler page */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var code = $('cmpCode'), lines = $('cmpLines'), input = $('cmpIn'), out = $('cmpOut'),
      status = $('cmpStatus'), runBtn = $('cmpRun'), pick = $('cmpEx'), nameEl = $('cmpName');
  if (!code) return;

  var PROGRAMS = window.SW_OOP_PROGRAMS || [];
  var KEY = 'swe-compiler-v1';
  var API = (window.SW_CONFIG && window.SW_CONFIG.COMPILER_URL) || '/api/run';
  var STARTER = '#include <iostream>\nusing namespace std;\n\nint main() {\n    cout << "Assalam o Alaikum, Start Well!" << endl;\n    return 0;\n}\n';

  function store(get, val) {
    try {
      if (get) return JSON.parse(localStorage.getItem(KEY) || 'null');
      localStorage.setItem(KEY, JSON.stringify(val));
    } catch (e) { return null; }
  }

  // ---- example list ----
  var groups = {};
  PROGRAMS.forEach(function (p) {
    if (!groups[p.group]) {
      groups[p.group] = document.createElement('optgroup');
      groups[p.group].label = p.group;
      pick.appendChild(groups[p.group]);
    }
    var o = document.createElement('option');
    o.value = p.id; o.textContent = p.title;
    groups[p.group].appendChild(o);
  });
  function find(id) { for (var i = 0; i < PROGRAMS.length; i++) if (PROGRAMS[i].id === id) return PROGRAMS[i]; return null; }

  // ---- editor ----
  var current = '';
  function renderLines() {
    var n = code.value.split('\n').length, s = '';
    for (var i = 1; i <= n; i++) s += i + '\n';
    lines.textContent = s;
    lines.scrollTop = code.scrollTop;
  }
  var saveTimer;
  function changed() {
    renderLines();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () { store(false, { code: code.value, stdin: input.value, ex: current }); }, 300);
  }
  function setCode(src, ex, stdin) {
    code.value = src;
    current = ex || '';
    pick.value = current;
    input.value = stdin || '';
    var p = find(current);
    nameEl.textContent = p ? p.id + '.cpp' : 'main.cpp';
    code.scrollTop = 0; code.scrollLeft = 0;
    changed();
  }
  code.addEventListener('input', changed);
  input.addEventListener('input', changed);
  code.addEventListener('scroll', function () { lines.scrollTop = code.scrollTop; });

  function insert(text) {
    var s = code.selectionStart, e = code.selectionEnd;
    code.focus();
    // execCommand keeps undo (Ctrl+Z) working where it is supported
    if (!(document.execCommand && document.execCommand('insertText', false, text))) {
      code.value = code.value.slice(0, s) + text + code.value.slice(e);
      code.selectionStart = code.selectionEnd = s + text.length;
      changed();
    }
  }
  code.addEventListener('keydown', function (ev) {
    if ((ev.ctrlKey || ev.metaKey) && ev.key === 'Enter') { ev.preventDefault(); run(); return; }
    if (ev.key === 'Tab' && !ev.ctrlKey && !ev.altKey && !ev.metaKey) {
      var s = code.selectionStart, e = code.selectionEnd, v = code.value;
      if (s !== e && v.slice(s, e).indexOf('\n') >= 0) {
        // indent / unindent selected lines
        ev.preventDefault();
        var ls = v.lastIndexOf('\n', s - 1) + 1, block = v.slice(ls, e);
        var nb = ev.shiftKey ? block.replace(/^ {1,4}/gm, '') : block.replace(/^/gm, '    ');
        code.setSelectionRange(ls, e);
        insert(nb);
        code.setSelectionRange(ls, ls + nb.length);
        return;
      }
      if (ev.shiftKey) return;
      ev.preventDefault(); insert('    '); return;
    }
    if (ev.key === 'Enter' && !ev.shiftKey) {
      var st = code.selectionStart, val = code.value;
      var lineStart = val.lastIndexOf('\n', st - 1) + 1;
      var indent = (val.slice(lineStart, st).match(/^[ \t]*/) || [''])[0];
      var before = val.slice(0, st).replace(/\s+$/, ''), after = val.slice(code.selectionEnd);
      ev.preventDefault();
      if (/\{$/.test(before) && /^\s*\}/.test(after)) {
        insert('\n' + indent + '    \n' + indent);
        code.selectionStart = code.selectionEnd = st + 1 + indent.length + 4;
      } else {
        insert('\n' + indent + (/\{$/.test(before) ? '    ' : ''));
      }
      return;
    }
    if (ev.key === '}') {
      var p = code.selectionStart, v2 = code.value, ls2 = v2.lastIndexOf('\n', p - 1) + 1;
      var lead = v2.slice(ls2, p);
      if (/^ {4,}$/.test(lead) && p === code.selectionEnd) {
        ev.preventDefault();
        code.setSelectionRange(p - 4, p);
        insert('}');
      }
    }
  });

  // ---- run ----
  function show(text, cls) {
    out.className = 'cmp-out' + (cls ? ' ' + cls : '');
    out.textContent = text;
  }
  function setStatus(text, cls) { status.textContent = text; status.className = 'cmp-status' + (cls ? ' ' + cls : ''); }

  var busy = false;
  function run() {
    if (busy) return;
    if (!code.value.trim()) { show('Write some C++ code first.', 'err'); return; }
    busy = true;
    runBtn.disabled = true;
    runBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>Running…';
    setStatus('Compiling…', 'busy');
    show('Compiling and running your program…', 'muted');
    var ctrl = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 45000);
    fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: code.value, stdin: input.value }),
      signal: ctrl ? ctrl.signal : undefined
    }).then(function (r) {
      return r.text().then(function (t) {
        try { return JSON.parse(t); } catch (e) { return { ok: false, error: r.status === 404 ? 'The compiler service is not available on this copy of the site.' : 'Unexpected reply from the compiler (HTTP ' + r.status + ').' }; }
      });
    }).then(function (d) {
      if (!d.ok) { setStatus('Error', 'bad'); show(d.error || 'Something went wrong. Please try again.', 'err'); return; }
      if (d.compile_error) {
        setStatus('Compile error', 'bad');
        show('Your code has a mistake — the compiler says:\n\n' + tidy(d.compile_error), 'err');
        return;
      }
      var text = d.stdout || '';
      if (d.stderr) text += (text && !/\n$/.test(text) ? '\n' : '') + d.stderr;
      var note = [];
      if (d.signal) note.push(d.signal);
      if (d.exit_code != null && d.exit_code !== 0) note.push('exit code ' + d.exit_code);
      if (!text) text = '(The program ran but printed nothing.)';
      if (note.length) text += '\n\n— Program stopped: ' + note.join(', ');
      if (!d.stdout && /cin\s*>>/.test(code.value) && !input.value.trim()) text += '\n\nTip: your program reads input with cin — type it in the Input box first.';
      setStatus((note.length ? 'Finished with problem' : 'Done') + (d.time_ms ? ' · ' + (d.time_ms / 1000).toFixed(1) + 's' : ''), note.length ? 'warn' : 'good');
      show(text, note.length ? 'warn' : '');
    }).catch(function (e) {
      setStatus('Error', 'bad');
      show(e && e.name === 'AbortError' ? 'The compiler took too long to answer. Please try again.' : 'Could not reach the compiler. Check your internet connection and try again.', 'err');
    }).then(function () {
      clearTimeout(timer);
      busy = false;
      runBtn.disabled = false;
      runBtn.innerHTML = '<i class="fa-solid fa-play"></i>Run';
    });
  }
  function tidy(msg) {
    // "prog.cc:12:5: error: ..." -> "Line 12:5: error: ..." (Wandbox uses prog.cc, Compiler Explorer uses <source>)
    return String(msg)
      .replace(/(?:[^\s:]*\/)?(?:prog\.cc|<source>|example\.cpp|main\.cpp):(\d+):(\d+):/g, 'Line $1:$2:')
      .replace(/(?:[^\s:]*\/)?(?:prog\.cc|<source>|example\.cpp|main\.cpp):(\d+):/g, 'Line $1:')
      .replace(/(?:[^\s:]*\/)?(?:prog\.cc|<source>|example\.cpp|main\.cpp): /g, '');
  }
  runBtn.addEventListener('click', run);

  // ---- toolbar ----
  pick.addEventListener('change', function () {
    var p = find(pick.value);
    if (!p) return;
    if (code.value.trim() && code.value !== (find(current) || {}).code && code.value !== STARTER &&
        !confirmReplace()) { pick.value = current; return; }
    setCode(p.code, p.id, p.stdin || '');
    try { history.replaceState(null, '', '#ex=' + p.id); } catch (e) {}
    show('Loaded “' + p.title + '”. Press ▶ Run to see the output.', 'muted');
    setStatus('Ready');
  });
  var pendingReplace = false;
  function confirmReplace() {
    // inline confirmation instead of a blocking dialog: first choice warns, second choice loads
    if (pendingReplace) { pendingReplace = false; return true; }
    pendingReplace = true;
    setTimeout(function () { pendingReplace = false; }, 6000);
    show('You have changed the code. Choose the program again within a few seconds to replace your code (or Copy / download it first).', 'warn');
    setStatus('Not loaded', 'warn');
    return false;
  }
  $('cmpReset').addEventListener('click', function () {
    setCode(STARTER, '', '');
    try { history.replaceState(null, '', location.pathname); } catch (e) {}
    show('New program started.', 'muted'); setStatus('Ready');
    code.focus();
  });
  $('cmpCopy').addEventListener('click', function () {
    var done = function () { setStatus('Code copied', 'good'); };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(code.value).then(done, fallback);
    else fallback();
    function fallback() { code.select(); try { document.execCommand('copy'); done(); } catch (e) {} }
  });
  $('cmpSave').addEventListener('click', function () {
    var blob = new Blob([code.value], { type: 'text/x-c++src' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nameEl.textContent || 'main.cpp';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  });

  // ---- start ----
  function fromHash() {
    var m = /ex=([\w-]+)/.exec(location.hash);
    var p = m && find(m[1]);
    if (p) { setCode(p.code, p.id, p.stdin || ''); show('Loaded “' + p.title + '”. Press ▶ Run to see the output.', 'muted'); return true; }
    return false;
  }
  window.addEventListener('hashchange', fromHash);
  if (!fromHash()) {
    var saved = store(true);
    if (saved && typeof saved.code === 'string' && saved.code.trim()) setCode(saved.code, saved.ex, saved.stdin);
    else setCode(STARTER, '', '');
  }
})();

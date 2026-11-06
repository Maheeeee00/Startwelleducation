/* Start Well Education — Online C++ compiler page */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var code = $('cmpCode'), lines = $('cmpLines'), input = $('cmpIn'), out = $('cmpOut'),
      status = $('cmpStatus'), runBtn = $('cmpRun'), pick = $('cmpEx'), nameEl = $('cmpName'),
      solBtn = $('cmpSol'), solBox = $('cmpSolBox');
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
    if (typeof hideSolution === 'function' && solBtn) { hideSolution(); if (undoBtn) undoBtn.hidden = true; }
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
    hideSolution();
    var sent = { code: code.value, stdin: input.value };
    runBtn.disabled = true;
    runBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>Running…';
    setStatus('Compiling…', 'busy');
    show('Compiling and running your program…', 'muted');
    var ctrl = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 45000);
    fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sent),
      signal: ctrl ? ctrl.signal : undefined
    }).then(function (r) {
      return r.text().then(function (t) {
        try { return JSON.parse(t); } catch (e) { return { ok: false, error: r.status === 404 ? 'The compiler service is not available on this copy of the site.' : 'Unexpected reply from the compiler (HTTP ' + r.status + ').' }; }
      });
    }).then(function (d) {
      norm(d);
      if (!d.ok) { setStatus('Error', 'bad'); show(d.error || 'Something went wrong. Please try again.', 'err'); return; }
      if (d.compile_error) {
        setStatus('Compile error', 'bad');
        show('Your code has a mistake — the compiler says:\n\n' + tidy(d.compile_error), 'err');
        offerSolution(d, sent);
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
      if (note.length || (!d.stdout && /\bcin\b/.test(sent.code) && !sent.stdin.trim())) offerSolution(d, sent);
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
    msg = String(msg).split('\n').filter(function (l) {
      return !/^fix-it:/.test(l) && !/^\s*\+\+\+ \|\+/.test(l) && !/^In file included from|^\s+from \S+:\d+[,:]$/.test(l);
    }).join('\n')
      // drop notes that point inside the compiler's own library files (long and confusing for students)
      .replace(/^\/\S+:\d+:\d+: note:.*\n(?:\s*\d+ \|.*\n)?(?:\s*\|.*\n)*/gm, '');
    return String(msg)
      .replace(/(?:[^\s:]*\/)?(?:prog\.cc|<source>|example\.cpp|main\.cpp):(\d+):(\d+):/g, 'Line $1:$2:')
      .replace(/(?:[^\s:]*\/)?(?:prog\.cc|<source>|example\.cpp|main\.cpp):(\d+):/g, 'Line $1:')
      .replace(/(?:[^\s:]*\/)?(?:prog\.cc|<source>|example\.cpp|main\.cpp): /g, '');
  }
  runBtn.addEventListener('click', run);

  // ---- Solution helper ----
  // A compile error must never be shown as "program ran" (safety net for any backend)
  function norm(d) {
    var ERR = /:\d+:\d+: (?:fatal )?error:|collect2: error|undefined reference to/;
    if (d && d.ok && !d.compile_error && !d.stdout && ERR.test((d.warnings || '') + '\n' + (d.stderr || ''))) {
      d.compile_error = (d.warnings || '') + '\n' + (d.stderr || '');
      d.stderr = ''; d.exit_code = null;
    }
    return d;
  }
  function callRun(src, stdin) {
    return fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: src, stdin: stdin }) })
      .then(function (r) { return r.json(); }).then(norm);
  }
  var aiReady = null;
  function aiAvailable() {
    if (aiReady === null) aiReady = fetch('/api/fix').then(function (r) { return r.ok ? r.json() : { ai: false }; })
      .then(function (j) { return !!j.ai; }, function () { return false; });
    return aiReady;
  }
  function problemText(d) {
    if (d.compile_error) return d.compile_error;
    var t = [];
    if (d.signal) t.push('Program crashed: ' + d.signal);
    if (d.exit_code != null && d.exit_code !== 0) t.push('Exit code ' + d.exit_code);
    if (d.stderr) t.push('stderr: ' + d.stderr);
    t.push('Output was: ' + (d.stdout || '(nothing)'));
    return t.join('\n');
  }
  function works(d) { return d && d.ok && !d.compile_error && !d.signal && (d.exit_code == null || d.exit_code === 0); }

  var lastSolution = null, undoCode = null, solToken = 0;
  function hideSolution() {
    solBtn.hidden = true; solBox.hidden = true; out.hidden = false;
    solBtn.classList.remove('open');
    solToken++;
  }
  function offerSolution(d, sent) {
    if (!window.SWSolution) return;
    var res = window.SWSolution.analyze({ code: sent.code, stdin: sent.stdin, compile_error: d.compile_error,
      stderr: d.stderr, stdout: d.stdout, signal: d.signal, exit_code: d.exit_code });
    var ex = find(current);
    res.original = ex && ex.code !== sent.code ? ex : null;
    res.code = sent.code; res.stdin = sent.stdin; res.first = d;
    res.realError = !!(d.compile_error || d.signal || (d.exit_code != null && d.exit_code !== 0));
    res.state = 'new';
    lastSolution = res;
    solBtn.hidden = false;
    solBtn.classList.remove('pulse'); void solBtn.offsetWidth; solBtn.classList.add('pulse');
  }

  // Build a complete, TESTED corrected program: apply sure fixes, compile, repeat; then ask the AI helper if needed.
  function solve(r) {
    var my = solToken, cur = r.code, d = r.first, round = 0;
    var titles = {}; r.items.forEach(function (it) { titles[it.title] = 1; });
    function stale() { return my !== solToken || lastSolution !== r; }
    function step() {
      if (stale()) return;
      var a = round === 0 ? r : window.SWSolution.analyze({ code: cur, stdin: r.stdin, compile_error: d.compile_error,
        stderr: d.stderr, stdout: d.stdout, signal: d.signal, exit_code: d.exit_code });
      if (round > 0) a.items.forEach(function (it) { if (!titles[it.title]) { titles[it.title] = 1; it.later = true; r.items.push(it); } });
      if (!a.fixed || round >= 6) return tryAI();
      cur = a.fixed; round++;
      return callRun(cur, r.stdin).then(function (res) {
        if (stale()) return;
        d = res;
        if (!res.ok) return finish(null);
        if (works(res)) return finish({ code: cur, result: res, by: 'rules' });
        if (!res.compile_error) return tryAI(res);
        return step();
      }, function () { finish(null); });
    }
    function tryAI() {
      if (!r.realError) return finish(null);
      return aiAvailable().then(function (ok) {
        if (!ok || stale()) return finish(null);
        r.state = 'ai'; paint();
        return fetch('/api/fix', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: r.code, error: problemText(r.first), stdin: r.stdin }) })
          .then(function (x) { return x.json(); })
          .then(function (j) {
            if (stale()) return;
            if (!j.ok || !j.code) return finish(null);
            return callRun(j.code, r.stdin).then(function (res) {
              if (stale()) return;
              if (works(res)) finish({ code: j.code, result: res, by: 'ai', note: j.explanation });
              else finish(null);
            });
          });
      }).catch(function () { finish(null); });
    }
    function finish(sol) {
      if (stale()) return;
      r.solution = sol; r.state = 'done'; paint();
    }
    r.state = 'working'; paint();
    step();
  }

  function paint() { if (!solBox.hidden && lastSolution) renderSolution(); }
  function renderSolution() {
    var S = window.SWSolution, r = lastSolution, h = '', esc = S.esc, sol = r.solution;
    var n = r.items.length;
    h += '<div class="sol-head"><i class="fa-solid fa-lightbulb"></i><div><b>Solution</b><span>' +
      (n ? n + (n > 1 ? ' problems' : ' problem') + ' found' : 'Here is what you can do') + '</span></div>' +
      '<button type="button" class="sol-x" data-act="back" title="Back to the output">&times;</button></div>';

    if (r.state === 'working' || r.state === 'ai') {
      h += '<div class="sol-wait"><span class="sol-spin"></span>' + (r.state === 'ai' ? 'Checking with the AI helper and testing its answer…' : 'Finding the fix and testing the corrected program…') + '</div>';
    } else if (sol) {
      var df = S.diff(r.code, sol.code) || [], added = {};
      df.forEach(function (x) { if (x[0] === '+') added[x[2]] = 1; });
      var lines = sol.code.replace(/\n$/, '').split('\n');
      h += '<div class="sol-ok"><i class="fa-solid fa-circle-check"></i><div><b>Corrected full program — tested ✓</b><span>It compiles and runs. Changed lines are green.</span></div></div>';
      if (sol.note) h += '<p class="sol-ai"><b>AI helper:</b> ' + esc(sol.note) + '</p>';
      h += '<pre class="sol-full">' + lines.map(function (l, i) {
        return '<span class="' + (added[i + 1] ? 'fa' : '') + '"><i>' + (i + 1) + '</i>' + (esc(l) || ' ') + '</span>';
      }).join('') + '</pre>';
      var outp = (sol.result.stdout || '').replace(/\s+$/, '');
      h += '<div class="sol-out-h">Output of the corrected program</div><pre class="sol-out">' + esc(outp ? outp.split('\n').slice(0, 12).join('\n') + (outp.split('\n').length > 12 ? '\n…' : '') : '(prints nothing)') + '</pre>';
      h += '<div class="sol-acts"><button type="button" class="sol-go" data-act="apply"><i class="fa-solid fa-wand-magic-sparkles"></i>Use this code &amp; Run</button>' +
        '<button type="button" class="sol-b" data-act="copyfix"><i class="fa-regular fa-copy"></i>Copy full code</button></div>';
    } else if (r.state === 'done' && r.realError) {
      h += '<p class="sol-note sol-manual">This mistake needs your own decision, so read the steps below, change the line, and press <b>Run</b> again.</p>';
    }

    if (n) h += '<div class="sol-why-h">' + (sol ? 'What was wrong' : 'What is wrong') + '</div>';
    r.items.forEach(function (it, i) {
      h += '<div class="sol-item"><div class="sol-t"><span class="sol-n">' + (i + 1) + '</span><b>' + esc(it.title) + '</b>' +
        (it.line && !it.later ? '<span class="sol-line">Line ' + it.line + '</span>' : '') +
        (sol && sol.by === 'rules' && it.auto ? '<span class="sol-auto">Fixed</span>' : '') + '</div>' +
        (it.src != null && it.src.trim() && !it.later ? '<pre class="sol-src">' + esc(it.src.replace(/^\s+/, '')) + '</pre>' : '') +
        '<p><em>Kyun?</em> ' + it.why + '</p><p><em>Kya karein?</em> ' + it.how + '</p></div>';
    });

    var acts = '';
    if (r.original) acts += '<button type="button" class="sol-b" data-act="orig"><i class="fa-solid fa-rotate-left"></i>Load original lesson code</button>';
    acts += '<button type="button" class="sol-b" data-act="back"><i class="fa-solid fa-terminal"></i>Show error</button>';
    h += '<div class="sol-acts">' + acts + '</div>';
    solBox.innerHTML = h;
  }
  solBtn.addEventListener('click', function () {
    var r = lastSolution;
    if (!r) return;
    if (!solBox.hidden) { solBox.hidden = true; out.hidden = false; solBtn.classList.remove('open'); return; }
    solBox.hidden = false; out.hidden = true; solBtn.classList.add('open'); solBtn.classList.remove('pulse');
    if (r.state === 'new') solve(r); else renderSolution();
    solBox.scrollTop = 0;
    if (window.innerWidth < 900) solBox.scrollIntoView({ block: 'nearest' });
  });
  solBox.addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-act]'); if (!b) return;
    var act = b.getAttribute('data-act'), r = lastSolution, sol = r && r.solution;
    if (act === 'back') { solBox.hidden = true; out.hidden = false; solBtn.classList.remove('open'); }
    else if (act === 'apply' && sol) { undoCode = code.value; replaceCode(sol.code); showUndo(); run(); }
    else if (act === 'orig' && r && r.original) { undoCode = code.value; replaceCode(r.original.code); showUndo(); run(); }
    else if (act === 'copyfix' && sol) {
      var ok = function () { b.innerHTML = '<i class="fa-solid fa-check"></i>Copied'; };
      if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(sol.code).then(ok, fallback);
      else fallback();
      function fallback() {
        var t = document.createElement('textarea'); t.value = sol.code; t.style.position = 'fixed'; t.style.opacity = '0';
        document.body.appendChild(t); t.select(); try { document.execCommand('copy'); ok(); } catch (e) {} t.remove();
      }
    }
  });
  function replaceCode(text) {
    var top = code.scrollTop;
    code.focus(); code.select();
    if (!(document.execCommand && document.execCommand('insertText', false, text))) code.value = text;
    if (code.value !== text) code.value = text;
    changed(); code.scrollTop = top;
  }
  var undoBtn = null;
  function showUndo() {
    if (!undoBtn) {
      undoBtn = document.createElement('button');
      undoBtn.type = 'button'; undoBtn.className = 'cmp-undo'; undoBtn.title = 'Put back the code from before the fix';
      undoBtn.innerHTML = '<i class="fa-solid fa-rotate-left"></i>Undo fix';
      solBtn.parentNode.insertBefore(undoBtn, solBtn);
      undoBtn.addEventListener('click', function () {
        if (undoCode == null) return;
        replaceCode(undoCode); undoCode = null; undoBtn.hidden = true;
        hideSolution(); show('Your code before the fix is back.', 'muted'); setStatus('Ready');
      });
    }
    undoBtn.hidden = false;
  }

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

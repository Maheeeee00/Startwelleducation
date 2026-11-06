/* Start Well Education — "Solution" helper for the online C++ compiler.
   Reads the compiler's error messages (GCC) or the program's crash details,
   explains each problem in simple Roman Urdu + English, and builds a corrected
   version of the code when the fix is certain (GCC fix-it hints + safe rules). */
(function () {
  'use strict';

  var USER_FILE = /^(?:prog\.cc|<source>|example\.cpp|main\.cpp|source\.cpp)$/;
  var STD_NAMES = ['cout', 'cin', 'endl', 'string', 'getline', 'vector', 'cerr', 'swap', 'max', 'min', 'to_string',
    'stoi', 'sort', 'map', 'pair', 'array', 'fixed', 'setw', 'setprecision', 'sqrt', 'pow', 'abs', 'unique_ptr',
    'make_unique', 'shared_ptr', 'make_shared', 'list', 'set', 'queue', 'stack', 'ostream', 'istream', 'exception',
    'runtime_error', 'out_of_range', 'boolalpha', 'ws', 'size_t', 'nullptr_t'];
  var HEADERS = { sqrt: 'cmath', pow: 'cmath', abs: 'cmath', ceil: 'cmath', floor: 'cmath', round: 'cmath',
    setw: 'iomanip', setprecision: 'iomanip', fixed: 'iomanip', vector: 'vector', sort: 'algorithm', reverse: 'algorithm',
    map: 'map', set: 'set', queue: 'queue', stack: 'stack', list: 'list', unique_ptr: 'memory', make_unique: 'memory',
    shared_ptr: 'memory', make_shared: 'memory', runtime_error: 'stdexcept', out_of_range: 'stdexcept',
    string: 'string', getline: 'string', to_string: 'string', stoi: 'string', rand: 'cstdlib', srand: 'cstdlib',
    time: 'ctime', strlen: 'cstring', strcpy: 'cstring' };
  var WORDS = ['int', 'double', 'float', 'char', 'bool', 'void', 'long', 'short', 'unsigned', 'return', 'class', 'struct',
    'public', 'private', 'protected', 'virtual', 'override', 'const', 'static', 'true', 'false', 'while', 'for', 'if',
    'else', 'switch', 'case', 'break', 'continue', 'new', 'delete', 'this', 'nullptr', 'using', 'namespace', 'main',
    'include', 'friend', 'operator', 'auto'].concat(STD_NAMES);

  // ---------- helpers ----------
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function q(s) { return s.replace(/[\u2018\u2019`]/g, "'"); }            // GCC uses ‘ ’ quotes in some locales
  function unq(s) { return s.replace(/^'|'$/g, ''); }
  function lev(a, b) {
    if (Math.abs(a.length - b.length) > 2) return 9;
    a = a.toLowerCase(); b = b.toLowerCase();
    var d = [], i, j;
    for (i = 0; i <= a.length; i++) { d[i] = [i]; }
    for (j = 0; j <= b.length; j++) d[0][j] = j;
    for (i = 1; i <= a.length; i++) for (j = 1; j <= b.length; j++) {
      var c = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + c);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
    return d[a.length][b.length];
  }
  // GCC columns count UTF-8 bytes; convert to a JS string index inside the line
  function colToIdx(line, col) {
    var bytes = 0, i = 0;
    while (i < line.length && bytes < col - 1) {
      var c = line.charCodeAt(i);
      if (c >= 0xD800 && c <= 0xDBFF) { bytes += 4; i += 2; continue; }
      bytes += c < 0x80 ? 1 : c < 0x800 ? 2 : 3; i++;
    }
    return i;
  }
  function lineStarts(code) { var s = [0]; for (var i = 0; i < code.length; i++) if (code[i] === '\n') s.push(i + 1); return s; }
  function absPos(code, starts, line, col) {
    if (line < 1) return 0;
    if (line > starts.length) return code.length;
    var st = starts[line - 1], end = line < starts.length ? starts[line] - 1 : code.length;
    return st + colToIdx(code.slice(st, end), col);
  }
  function unescapeFixit(s) {
    return s.replace(/\\([0-7]{3})/g, function (m, o) { return String.fromCharCode(parseInt(o, 8)); })
            .replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  }
  function bytesToStr(s) { // octal escapes give raw UTF-8 bytes; turn them back into text
    try { return decodeURIComponent(escape(s)); } catch (e) { return s; }
  }

  // ---------- parse GCC output ----------
  function parse(raw) {
    var diags = [], cur = null, out = String(raw || '').split('\n');
    for (var i = 0; i < out.length; i++) {
      var l = out[i];
      var m = /^([^\s:][^:]*):(\d+):(\d+): (fatal error|error|warning|note): (.*)$/.exec(l);
      if (m) {
        if (!USER_FILE.test(m[1])) { cur = null; continue; }
        cur = { kind: m[4] === 'fatal error' ? 'error' : m[4], line: +m[2], col: +m[3], msg: q(m[5]), fixits: [] };
        diags.push(cur);
        continue;
      }
      var f = /^fix-it:"([^"]*)":\{(\d+):(\d+)-(\d+):(\d+)\}:"(.*)"$/.exec(l);
      if (f && cur && USER_FILE.test(f[1])) {
        cur.fixits.push({ sl: +f[2], sc: +f[3], el: +f[4], ec: +f[5], text: bytesToStr(unescapeFixit(f[6])) });
      }
    }
    return diags;
  }

  // ---------- edits ----------
  function applyEdits(code, edits) {
    var starts = lineStarts(code);
    var abs = edits.map(function (e) {
      return { s: absPos(code, starts, e.sl, e.sc), e: absPos(code, starts, e.el, e.ec), text: e.text };
    }).sort(function (a, b) { return b.s - a.s || b.e - a.e; });
    var last = Infinity, outCode = code;
    abs.forEach(function (e) {
      if (e.e > last) return;              // overlapping edit — skip
      outCode = outCode.slice(0, e.s) + e.text + outCode.slice(e.e);
      last = e.s;
    });
    return outCode;
  }
  function insertAfterIncludes(code, text) {
    var lines = code.split('\n'), at = -1;
    for (var i = 0; i < lines.length; i++) if (/^\s*#\s*include\b/.test(lines[i])) at = i;
    lines.splice(at + 1, 0, text);
    return lines.join('\n');
  }
  function hasInclude(code, h) { return new RegExp('#\\s*include\\s*<' + h + '>').test(code); }
  function identifiers(code) {
    var seen = {}, re = /\b[A-Za-z_]\w*\b/g, m;
    var clean = code.replace(/"(?:\\.|[^"\\])*"/g, '""').replace(/\/\/.*$/gm, '');
    while ((m = re.exec(clean))) seen[m[0]] = (seen[m[0]] || 0) + 1;
    return seen;
  }

  // ---------- main ----------
  function analyze(o) {
    var code = o.code || '';
    var items = [], edits = [], post = [];      // post = whole-code fixes applied after the position edits
    var lines = code.split('\n');
    var raw = String(o.compile_error || '');
    var diags = parse(raw);
    var errors = diags.filter(function (d) { return d.kind === 'error'; });
    var noStd = !/using\s+namespace\s+std\s*;/.test(code);
    var needStd = false, needHeaders = {}, seenKey = {};
    var ids = identifiers(code);

    var curD = null;
    function add(it, d) {
      d = d || curD;
      var key = it.title + '|' + (it.key || '');
      if (seenKey[key]) return;
      seenKey[key] = 1;
      if (d && !it.line) it.line = d.line;
      if (it.line && lines[it.line - 1] != null && it.showLine !== false) it.src = lines[it.line - 1];
      items.push(it);
    }

    errors.forEach(function (d, k) {
      curD = d;
      var m, msg = d.msg, nameM = /^'([^']+)' was not declared in this scope/.exec(msg);
      var fixitsUsed = false;
      function useFixits() { d.fixits.forEach(function (f) { edits.push(f); }); fixitsUsed = d.fixits.length > 0; }

      if ((m = /^expected '([;,)\]}>])' before (.*)/.exec(msg)) || (m = /^expected '([;)\]])' at end of (?:input|member declaration)/.exec(msg))) {
        var ch = m[1];
        useFixits();
        add({ title: ch === ';' ? 'Semicolon (;) missing hai' : 'Bracket "' + ch + '" missing hai', key: d.line,
          why: ch === ';' ? 'C++ me har statement ke end par <b>;</b> lagana zaroori hai. Compiler ko is line ke aas paas <code>;</code> nahi mila.'
                          : 'Jo bracket khola tha woh band nahi hua. Har <code>(</code> ka <code>)</code>, <code>[</code> ka <code>]</code> hona chahiye.',
          how: ch === ';' ? 'Line ' + d.line + ' (ya us se pehli line) ke end par <code>;</code> lagao.' : 'Line ' + d.line + ' par <code>' + esc(ch) + '</code> lagao.',
          auto: fixitsUsed });
        return;
      }
      if (/^expected ';' after class definition/.test(msg) || /^expected ';' after struct definition/.test(msg)) {
        useFixits();
        add({ title: 'Class ke end par ; missing hai', why: 'Class ka closing bracket <code>}</code> ke baad <b>;</b> lagta hai: <code>class Player { ... };</code>', how: 'Class ke <code>}</code> ke baad <code>;</code> lagao.', auto: true });
        return;
      }
      if (/^expected '}' at end of input/.test(msg)) {
        var opens = (code.replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\/\/.*$/gm, '').match(/\{/g) || []).length;
        var closes = (code.replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\/\/.*$/gm, '').match(/\}/g) || []).length;
        var unterminated = errors.some(function (e) { return /missing terminating/.test(e.msg); });
        if (opens > closes && !unterminated) post.push(function (c) { return c.replace(/\s*$/, '') + new Array(opens - closes + 1).join('\n}') + '\n'; });
        add({ title: 'Closing bracket } missing hai', showLine: false,
          why: 'Jitne <code>{</code> khole, utne <code>}</code> band nahi hue (' + opens + ' khole, ' + closes + ' band). Aksar function, class, if ya loop ka } bhool jaate hain.',
          how: 'Program ke end par (ya jahan block khatam hota hai) <code>}</code> lagao. Class ho to <code>};</code>', auto: opens > closes && !unterminated });
        return;
      }
      if (/^missing terminating (["']) character/.test(msg)) {
        var L = lines[d.line - 1] || '', qi = colToIdx(L, d.col), semi = L.indexOf(';', qi + 1);
        var ins = semi > 0 ? semi : L.replace(/\s+$/, '').length;
        edits.push({ sl: d.line, sc: byteCol(L, ins), el: d.line, ec: byteCol(L, ins), text: L[qi] === "'" ? "'" : '"' });
        add({ title: 'String ka closing " missing hai', why: 'Text ko dono taraf <code>"</code> se band karna hota hai, jaise <code>"Hello"</code>. Yahan text shuru to hua lekin band nahi hua.', how: 'Text ke end par <code>"</code> lagao.', auto: true });
        return;
      }
      if (/extended character [“”‘’]|stray '\\(342|200|235|234|230|231)'|'\\U0000201[89cd]/.test(msg)) {
        post.push(function (c) { return c.replace(/[“”]/g, '"').replace(/[‘’]/g, "'"); });
        add({ title: 'Galat quotes “ ” lage hain', key: 'quotes', why: 'Code WhatsApp/Word se copy hua hai, is me tirchhe quotes <code>“ ”</code> hain. C++ sirf seedhe quotes <code>"</code> samajhta hai.', how: 'Saare <code>“ ”</code> ko <code>"</code> se badlo.', auto: true });
        return;
      }
      if (/^'::main' must return 'int'/.test(msg)) {
        post.push(function (c) { return c.replace(/\bvoid\s+main\s*\(/, 'int main('); });
        add({ title: 'main() hamesha int return karta hai', why: 'C++ me <code>void main()</code> nahi chalta. Sahi tareeqa <code>int main()</code> hai aur end me <code>return 0;</code>.', how: '<code>void main()</code> ko <code>int main()</code> karo.', auto: true });
        return;
      }
      if (nameM) {
        var name = nameM[1], base = name.replace(/^std::/, '');
        if (/[^\w:]/.test(name)) return;              // e.g. smart-quote garbage — handled by the quotes rule
        if (STD_NAMES.indexOf(base) >= 0 || /did you mean 'std::/.test(msg)) {
          if (noStd) {
            needStd = true;
            add({ title: '"using namespace std;" missing hai', key: 'std', showLine: false, why: '<code>cout</code>, <code>cin</code>, <code>endl</code>, <code>string</code> waghera <b>std</b> me rehte hain. Ya to har jagah <code>std::cout</code> likho, ya upar ek dafa <code>using namespace std;</code> likh do.', how: '<code>#include</code> lines ke neeche <code>using namespace std;</code> likho.', auto: true });
          }
          if (HEADERS[base] && !hasInclude(code, HEADERS[base]) && HEADERS[base] !== 'string') needHeaders[HEADERS[base]] = base;
          if (!noStd && HEADERS[base]) needHeaders[HEADERS[base]] = base;
          return;
        }
        if (HEADERS[base] && !hasInclude(code, HEADERS[base])) {
          needHeaders[HEADERS[base]] = base;
          return;
        }
        var dm = /did you mean '([^']+)'/.exec(msg);
        var best = dm ? dm[1] : null;
        if (!best && name.length >= 3) {
          var bd = 3;
          Object.keys(ids).concat(WORDS).forEach(function (w) {
            if (w === name || w.length < 2) return;
            var dd = lev(name, w);
            if (dd < bd && dd <= (name.length > 4 ? 2 : 1)) { bd = dd; best = w; }
          });
        }
        if (best && best !== name) {
          if (d.fixits.length) useFixits();
          else edits.push({ sl: d.line, sc: d.col, el: d.line, ec: d.col + name.length, text: best });
          add({ title: 'Spelling ki ghalti: "' + name + '"', key: name, why: 'Compiler <code>' + esc(name) + '</code> ko nahi pehchanta. Shayad aap <code>' + esc(best) + '</code> likhna chahte the. C++ me capital/small letters ka bhi farq hota hai.', how: '<code>' + esc(name) + '</code> ko <code>' + esc(best) + '</code> karo.', auto: true });
        } else if ((m = new RegExp('^(\\s*)' + name + '\\s*=\\s*([^;=]+);').exec(lines[d.line - 1] || '')) && !/\bfor\s*\(/.test(lines[d.line - 1])) {
          var val = m[2].trim(), ty = /^".*"$/.test(val) ? 'string' : /^'.'$/.test(val) ? 'char' : /^-?\d+\.\d*$/.test(val) ? 'double' : /^(true|false)$/.test(val) ? 'bool' : 'int';
          if (ty === 'string' && noStd) ty = 'std::string';
          var L3 = lines[d.line - 1], at = m[1].length;
          edits.push({ sl: d.line, sc: byteCol(L3, at), el: d.line, ec: byteCol(L3, at), text: ty + ' ' });
          add({ title: '"' + name + '" declare nahi hua', key: name, why: 'Variable ko pehli dafa use karne se pehle us ki <b>type</b> batani hoti hai (int, double, string…). <code>' + esc(name) + '</code> ki type nahi likhi.', how: 'Pehli dafa likhte waqt type lagao: <code>' + esc(ty + ' ' + name + ' = ' + val + ';') + '</code>', auto: true });
        } else {
          add({ cascade: true, title: '"' + name + '" declare nahi hua', key: name, why: 'Kisi variable, function ya class ko use karne se <b>pehle</b> banana (declare karna) zaroori hai. <code>' + esc(name) + '</code> kahin pehle bana hi nahi, ya kisi doosre <code>{ }</code> block ke andar bana hai.', how: 'Use karne se pehle declare karo, jaise <code>int ' + esc(name) + ' = 0;</code> — ya agar class hai to use <code>main()</code> se upar likho.', auto: false });
        }
        return;
      }
      if ((m = /^'(?:class|struct) ([^']+)' has no member named '([^']+)'(?:; did you mean '([^']+)')?/.exec(msg))) {
        if (m[3]) useFixits();
        add({ title: m[1] + ' me "' + m[2] + '" naam ka member nahi hai', key: m[2], why: 'Object ke saath dot (.) ke baad sirf wahi cheez likh sakte ho jo class ke andar banayi gayi ho.' + (m[3] ? ' Sahi naam <code>' + esc(m[3]) + '</code> hai.' : ''), how: m[3] ? '<code>' + esc(m[2]) + '</code> ko <code>' + esc(m[3]) + '</code> karo.' : 'Class ke andar <code>' + esc(m[2]) + '</code> banao, ya spelling check karo.', auto: !!m[3] });
        return;
      }
      if ((m = /^'([^']+)' is (private|protected) within this context/.exec(msg))) {
        var mem = m[1].replace(/^.*::/, '').replace(/\(.*$/, '');
        var pf = privateFix(code, lines, d, m[1]);
        if (pf) {
          pf.edits.forEach(function (e) { edits.push(e); });
          add({ title: '"' + mem + '" ' + m[2] + ' hai — bahar se use nahi ho sakta', key: mem + pf.call, why: 'Yeh <b>Encapsulation</b> hai: <code>' + m[2] + '</code> data sirf class ke apne functions use kar sakte hain. <code>main()</code> se direct access mana hai.', how: 'Data ko private hi rakho aur class me ek <code>public</code> ' + (/^void set/.test(pf.getter.replace('public: ', '')) ? 'setter' : 'getter') + ' function banao:<br><code>' + esc(pf.getter) + '</code><br>phir bahar <code>' + esc(pf.call) + '</code> likho. (Auto-fix yahi karega.)', auto: true });
          return;
        }
        add({ title: '"' + mem + '" ' + m[2] + ' hai — bahar se use nahi ho sakta', key: mem, why: 'Yeh <b>Encapsulation</b> hai: <code>' + m[2] + '</code> data sirf class ke apne functions use kar sakte hain. <code>main()</code> se direct access mana hai.', how: 'Class me ek <code>public</code> function banao aur us ke zariye use karo, jaise:<br><code>int get' + cap(mem) + '() const { return ' + esc(mem) + '; }</code><br>phir <code>obj.get' + cap(mem) + '()</code> likho. (Ya agar zaroori ho to member ko <code>public:</code> ke neeche le aao.)', auto: false });
        return;
      }
      if ((m = /abstract type '([^']+)'/.exec(msg)) || (m = /invalid new-expression of abstract class type '([^']+)'/.exec(msg))) {
        add({ title: m[1] + ' abstract class hai — is ka object nahi ban sakta', key: m[1], why: 'Jis class me <code>virtual ... = 0;</code> (pure virtual function) ho, woh sirf ek <b>blueprint</b> hoti hai (Abstraction). Us ka object direct nahi banta.', how: 'Ek child class banao jo woh function likhe (override kare), aur object child class ka banao:<br><code>class Circle : public ' + esc(m[1]) + ' { public: double area() override { ... } };</code>', auto: false });
        return;
      }
      if ((m = /^no matching function for call to '([^']+)'/.exec(msg))) {
        var exp = null; diags.forEach(function (n) { var mm = /candidate expects (\d+) arguments?, (\d+) provided/.exec(n.msg); if (mm && !exp) exp = mm; });
        add({ title: 'Function/constructor ko galat arguments diye', key: m[1], why: '<code>' + esc(m[1]) + '</code> ko jitni values chahiye thin, utni nahi di gayin' + (exp ? ' (chahiye ' + exp[1] + ', di ' + exp[2] + ')' : '') + ', ya un ki type alag hai.', how: 'Function/constructor ki definition dekho aur utni hi values usi order me do. Agar khali object banana hai (<code>Player p;</code>) to class me default constructor banao: <code>Player() { }</code>', auto: false });
        return;
      }
      if (/^assignment of (?:member|read-only)/.test(msg) || /read-only object/.test(msg) || /discards qualifiers/.test(msg) || /passing 'const/.test(msg)) {
        add({ title: 'const cheez ko badla ja raha hai', key: 'const', why: '<code>const</code> ka matlab hai "sirf parhne ke liye". <code>const</code> function ke andar member ki value nahi badal sakte, aur const object par non-const function nahi chal sakta.', how: 'Agar value badalni hai to function se <code>const</code> hata do. Agar sirf parhna hai to assignment (=) wali line hata do.', auto: false });
        return;
      }
      if ((m = /^no match for 'operator(<<|>>)' \(operand types are 'std::(istream|ostream)'/.exec(msg))) {
        var L2 = lines[d.line - 1] || '';
        if (m[2] === 'istream' && m[1] === '<<') {
          post.push(lineFix(d.line, function (s) { return s.replace(/(\bcin\b[^;]*)/, function (x) { return x.replace(/<</g, '>>'); }); }));
          add({ title: 'cin ke saath >> lagta hai', why: '<code>cin</code> input <b>leta</b> hai, is liye arrow andar ki taraf: <code>cin &gt;&gt; x;</code>', how: '<code>cin &lt;&lt;</code> ko <code>cin &gt;&gt;</code> karo.', auto: true });
        } else if (m[2] === 'ostream' && m[1] === '>>') {
          post.push(lineFix(d.line, function (s) { return s.replace(/(\bcout\b[^;]*)/, function (x) { return x.replace(/>>/g, '<<'); }); }));
          add({ title: 'cout ke saath << lagta hai', why: '<code>cout</code> output <b>deta</b> hai, is liye: <code>cout &lt;&lt; x;</code>', how: '<code>cout &gt;&gt;</code> ko <code>cout &lt;&lt;</code> karo.', auto: true });
        } else {
          add({ title: 'Yeh cheez cout/cin se seedha print nahi hoti', key: L2, why: 'Poora object <code>cout</code> se print nahi hota — us ke andar ka data print karo.', how: 'Object ke function se value lo, jaise <code>cout &lt;&lt; p.getName();</code>', auto: false });
        }
        return;
      }
      if ((m = /^invalid conversion from '([^']+)' to '([^']+)'/.exec(msg)) || (m = /^cannot convert '([^']+)' to '([^']+)'/.exec(msg))) {
        add({ title: 'Type match nahi ho rahi', key: d.line, why: '<code>' + esc(m[1]) + '</code> ki value <code>' + esc(m[2]) + '</code> me nahi rakh sakte. Misaal: text <code>"5"</code> ko <code>int</code> me nahi daal sakte.', how: 'Sahi type ki value do (number ke liye bina quotes: <code>5</code>), ya variable ki type badlo (text ke liye <code>string</code>).', auto: false });
        return;
      }
      if ((m = /^'([^']+)' does not name a type/.exec(msg))) {
        var t = m[1], hb = null, bd2 = 3;
        if (HEADERS[t] && !hasInclude(code, HEADERS[t])) { needHeaders[HEADERS[t]] = t; if (noStd && STD_NAMES.indexOf(t) >= 0) needStd = true; return; }
        if (STD_NAMES.indexOf(t) >= 0 && noStd) { needStd = true; add({ title: '"using namespace std;" missing hai', key: 'std', showLine: false, why: '<code>' + esc(t) + '</code> std me hai.', how: '<code>using namespace std;</code> likho.', auto: true }); return; }
        if (t.length >= 3) Object.keys(ids).concat(WORDS).forEach(function (w) { var dd = lev(t, w); if (w !== t && w.length > 1 && dd < bd2 && dd <= (t.length > 4 ? 2 : 1)) { bd2 = dd; hb = w; } });
        if (hb) { edits.push({ sl: d.line, sc: d.col, el: d.line, ec: d.col + t.length, text: hb }); }
        add({ title: '"' + t + '" koi type nahi hai', key: t, why: hb ? 'Shayad spelling ghalat hai — <code>' + esc(hb) + '</code> likhna tha.' : 'Compiler <code>' + esc(t) + '</code> naam ki class/type nahi jaanta. Ya spelling ghalat hai, ya class neeche likhi hai aur use pehle ho rahi hai.', how: hb ? '<code>' + esc(t) + '</code> ko <code>' + esc(hb) + '</code> karo.' : 'Class ko use karne se <b>pehle</b> (upar) likho, ya spelling theek karo.', auto: !!hb });
        return;
      }
      if (/^'else' without a previous 'if'/.test(msg)) {
        add({ title: '"else" se pehle "if" nahi mila', why: 'Ya to <code>if (...)</code> ke foran baad ghalti se <code>;</code> laga hai, ya <code>if</code> ke andar ek se zyada lines hain aur <code>{ }</code> nahi lagaye.', how: 'Aisa likho: <code>if (x &gt; 0) { ... } else { ... }</code> — <code>if(...)</code> ke baad <code>;</code> mat lagao.', auto: false });
        return;
      }
      if (/^expected primary-expression before/.test(msg) || /^expected unqualified-id before/.test(msg) || /^expected initializer before/.test(msg) || /^expected '\(' before/.test(msg)) {
        useFixits();
        add({ cascade: !fixitsUsed, title: 'Is line ka structure ghalat hai', key: d.line, why: 'Compiler ko yahan kuch aur expect tha. Aam wajah: pichli line par <code>;</code> missing, koi bracket zyada/kam, function ke bahar code likha, ya type ka naam ghalat jagah.', how: 'Line ' + d.line + ' aur us se pichli line ko dhyan se dekho — brackets <code>( ) { }</code> aur <code>;</code> check karo. Code hamesha kisi function (jaise <code>main</code>) ke andar likho.', auto: fixitsUsed });
        return;
      }
      if ((m = /^redefinition of '([^']+)'/.exec(msg)) || (m = /^redeclaration of '([^']+)'/.exec(msg)) || (m = /^conflicting declaration '([^']+)'/.exec(msg))) {
        add({ title: '"' + m[1].replace(/^.*\s/, '') + '" do dafa bana diya', key: m[1], why: 'Ek hi naam ka variable/function/class ek hi jagah do dafa nahi ban sakta.', how: 'Ek ko hata do, ya doosre ka naam badal do.', auto: false });
        return;
      }
      if (/^return-statement with a value, in function returning 'void'/.test(msg) || /^return-statement with no value/.test(msg)) {
        add({ title: 'return ki type match nahi karti', why: '<code>void</code> function koi value return nahi karta; <code>int</code>/<code>double</code> function ko value return karni hoti hai.', how: 'Function ki type badlo ya <code>return</code> theek karo.', auto: false });
        return;
      }
      if (/^too many arguments|^too few arguments/.test(msg)) {
        add({ title: 'Function ko values ki ginti ghalat hai', key: d.line, why: msg.replace(/'/g, ''), how: 'Function ki definition jitni values maangti hai, utni hi do.', auto: false });
        return;
      }
      if (/^'[^']+' is not a member of 'std'/.test(msg)) {
        useFixits();
        var nm = /^'([^']+)'/.exec(msg)[1];
        if (HEADERS[nm] && !hasInclude(code, HEADERS[nm])) needHeaders[HEADERS[nm]] = nm;
        if (!fixitsUsed && !needHeaders[HEADERS[nm]]) add({ title: '"' + nm + '" std me nahi mila', why: 'Shayad spelling ghalat hai ya zaroori #include missing hai.', how: 'Spelling check karo.', auto: false });
        return;
      }
      // anything else: the first error only, in plain words
      if (k === 0 || d.fixits.length) {
        useFixits();
        add({ cascade: k > 0 && !fixitsUsed, title: 'Compiler error', key: msg, why: 'Compiler kehta hai: <code>' + esc(msg) + '</code>', how: 'Line ' + d.line + ' ko dhyan se dekho. Aksar ghalti isi line ya is se pichli line me hoti hai.', auto: fixitsUsed });
      }
    });

    curD = null;
    // missing #include notes (GCC gives a fix-it in a note)
    diags.forEach(function (d) {
      var m = /did you forget to '#include <([^>]+)>'/.exec(d.msg);
      if (m && d.kind === 'note') { needHeaders[m[1]] = needHeaders[m[1]] || m[1]; }
    });

    // linker errors
    var m0;
    if (/undefined reference to `main'/.test(raw) || /undefined reference to `WinMain/.test(raw)) {
      var hasMain = /\bint\s+main\s*\(/.test(code), alt = /\b(?:int|void)\s+(mian|Main|MAIN|man|mainn|maim)\s*\(/.exec(code);
      if (alt) post.push(function (c) { return c.replace(new RegExp('\\b(?:int|void)\\s+' + alt[1] + '\\s*\\('), 'int main('); });
      if (!hasMain) add({ title: 'main() function nahi mila', why: 'Har C++ program <code>int main()</code> se shuru hota hai.' + (alt ? ' Aap ne <code>' + alt[1] + '</code> likha hai.' : ''), how: 'Program me <code>int main() { ... return 0; }</code> likho.', auto: !!alt });
    } else if ((m0 = /undefined reference to `([^']+)'/.exec(raw))) {
      add({ title: '"' + m0[1] + '" ki body nahi likhi', why: 'Function ka naam (declaration) likha hai, lekin us ka code (definition) kahin nahi. Virtual function ho to har class me us ki body likhni hai.', how: 'Function ki body likho, jaise <code>' + esc(m0[1].replace(/\(.*$/, '')) + '(...) { ... }</code> — ya agar abstract banana tha to <code>= 0;</code> lagao.', auto: false });
    }

    // build the corrected code
    var fixed = code;
    if (edits.length) fixed = applyEdits(fixed, dedupe(edits, needStd));
    post.forEach(function (fn) { fixed = fn(fixed); });
    Object.keys(needHeaders).forEach(function (h) {
      if (!hasInclude(fixed, h)) {
        fixed = /#\s*include/.test(fixed) ? insertAfterIncludes(fixed, '#include <' + h + '>') : '#include <' + h + '>\n' + fixed;
        add({ title: '#include <' + h + '> missing hai', key: h, showLine: false, why: '<code>' + esc(needHeaders[h]) + '</code> use karne ke liye <code>&lt;' + h + '&gt;</code> library include karni padti hai.', how: 'Upar <code>#include &lt;' + h + '&gt;</code> likho.', auto: true });
      }
    });
    if (needStd && !/using\s+namespace\s+std\s*;/.test(fixed)) fixed = insertAfterIncludes(fixed, 'using namespace std;');

    // when a certain fix exists, later "not declared"/structure errors are usually side effects of it
    if (items.some(function (it) { return it.auto; })) items = items.filter(function (it) { return !it.cascade; });

    // ---------- runtime problems ----------
    if (!raw) runtime(o, items);

    if (!items.length && raw) {
      items.push({ title: 'Compiler error', why: 'Error message upar dekho — sab se pehli <b>error:</b> line sab se zaroori hai.', how: 'Pehli error wali line theek karo aur dobara Run karo. Baaki errors aksar khud hi khatam ho jaati hain.', auto: false });
    }
    return { items: items, fixed: fixed !== code ? fixed : null };
  }


  // private data read from outside -> add a public const getter and call it
  function privateFix(code, lines, d, full) {
    var fm = /^(.*?)\s*\b(\w+)::(\w+)$/.exec(full);           // "int Bank::balance"
    if (!fm || /\(/.test(full)) return null;
    var type = fm[1].trim(), cls = fm[2], mem = fm[3];
    if (!type || /\bconst\b|\bstatic\b/.test(type)) return null;
    var L = lines[d.line - 1] || '', idx = colToIdx(L, d.col);
    var lineHere = L.slice(idx);
    if (lineHere.indexOf(mem) !== 0) { var j = L.indexOf('.' + mem, Math.max(0, idx - mem.length - 2)); if (j < 0) return null; idx = j + 1; lineHere = L.slice(idx); }
    var Cap = mem.charAt(0).toUpperCase() + mem.slice(1), getter = 'get' + Cap, setter = null;
    var wm = new RegExp('^' + mem + '\\s*=(?!=)\\s*([^;]+);').exec(lineHere);
    if (wm) setter = 'set' + Cap;                                // obj.x = value;  -> obj.setX(value);
    else if (/^\w+\s*(\+\+|--|\+=|-=|\*=|\/=)/.test(lineHere) || /(\+\+|--)\s*\w*\.?$/.test(L.slice(0, idx - 1))) return null;
    var fnName = setter || getter;
    var member = setter ? 'void ' + setter + '(' + type + ' v) { ' + mem + ' = v; }' : type + ' ' + getter + '() const { return ' + mem + '; }';
    var callEdit = setter
      ? { sl: d.line, sc: byteCol(L, idx), el: d.line, ec: byteCol(L, idx + wm[0].length), text: setter + '(' + wm[1].trim() + ');' }
      : { sl: d.line, sc: byteCol(L, idx), el: d.line, ec: byteCol(L, idx + mem.length), text: getter + '()' };
    var callText = setter ? 'obj.' + setter + '(' + wm[1].trim() + ');' : 'obj.' + getter + '()';
    if (new RegExp('\\b' + fnName + '\\s*\\(').test(code)) return { edits: [callEdit], getter: member, call: callText };
    var cm = new RegExp('\\b(?:class|struct)\\s+' + cls + '\\b[^{;]*\\{').exec(code);
    if (!cm) return null;
    var depth = 0, i = cm.index + cm[0].length - 1, end = -1;
    for (; i < code.length; i++) { if (code[i] === '{') depth++; else if (code[i] === '}') { depth--; if (!depth) { end = i; break; } } }
    if (end < 0) return null;
    var starts = lineStarts(code), ln = 0;
    while (ln + 1 < starts.length && starts[ln + 1] <= end) ln++;
    var lineText = lines[ln], col = end - starts[ln];
    var text = (lineText.slice(0, col).trim() ? '\n' : '') + 'public:\n    ' + member + '\n' + (lineText.slice(0, col).match(/^\s*/) || [''])[0];
    if (!lineText.slice(0, col).trim()) text = 'public:\n    ' + member + '\n' + lineText.slice(0, col);
    var startCol = lineText.slice(0, col).trim() ? byteCol(lineText, col) : 1;
    return {
      edits: [
        { sl: ln + 1, sc: startCol, el: ln + 1, ec: byteCol(lineText, col), text: text },
        callEdit
      ],
      getter: 'public: ' + member, call: callText
    };
  }

  function dedupe(edits, needStd) {
    var seen = {};
    return edits.filter(function (e) {
      if (needStd && /^std::/.test(e.text)) return false;     // we add "using namespace std;" instead
      var k = [e.sl, e.sc, e.el, e.ec, e.text].join(',');
      if (seen[k]) return false;
      seen[k] = 1; return true;
    });
  }
  function byteCol(line, idx) { // JS index -> GCC byte column
    var s = line.slice(0, idx), b = 0;
    for (var i = 0; i < s.length; i++) { var c = s.charCodeAt(i); if (c >= 0xD800 && c <= 0xDBFF) { b += 4; i++; } else b += c < 0x80 ? 1 : c < 0x800 ? 2 : 3; }
    return b + 1;
  }
  function lineFix(n, fn) { return function (c) { var ls = c.split('\n'); if (ls[n - 1] != null) ls[n - 1] = fn(ls[n - 1]); return ls.join('\n'); }; }
  function cap(s) { return s ? esc(s.charAt(0).toUpperCase() + s.slice(1)) : ''; }

  function runtime(o, items) {
    var sig = String(o.signal || ''), ec = o.exit_code, err = String(o.stderr || ''), code = o.code || '';
    if (/segment|SIGSEGV/i.test(sig) || ec === 139 || ec === -11) {
      items.push({ title: 'Program crash ho gaya (Segmentation fault)', why: 'Program ne aisi memory ko chhua jo us ki nahi thi. Aam wajahein: array ki had se bahar index (jaise 5 size ke array me <code>arr[5]</code>), <code>nullptr</code> pointer use karna, ya <code>delete</code> ke baad pointer use karna.', how: 'Arrays me index hamesha <code>0</code> se <code>size-1</code> tak rakho (loop: <code>i &lt; size</code>, <code>i &lt;= size</code> nahi). Pointer use karne se pehle check karo ke woh <code>nullptr</code> na ho.', auto: false });
    } else if (/floating|SIGFPE/i.test(sig) || ec === 136 || ec === -8) {
      items.push({ title: 'Zero se divide kiya gaya', why: 'Kisi number ko <code>0</code> se divide (<code>/</code>) ya <code>%</code> kiya gaya — yeh math me mumkin nahi.', how: 'Divide karne se pehle check karo: <code>if (b != 0) cout &lt;&lt; a / b;</code>', auto: false });
    } else if (/time|kill|SIGKILL|SIGXCPU/i.test(sig) || ec === 137 || ec === -9) {
      items.push({ title: 'Program rukta hi nahi (infinite loop)', why: 'Program bohat dair tak chalta raha, is liye rok diya gaya. Aksar loop ki condition kabhi false nahi hoti, ya program <code>cin</code> se input ka intezaar kar raha hai.', how: 'Loop me counter badhao (<code>i++</code>) aur condition check karo. Agar program input maangta hai to <b>Input</b> box me value likho.', auto: false });
    } else if (/terminate called after throwing/.test(err) || /SIGABRT|abort/i.test(sig) || ec === 134 || ec === -6) {
      var what = /what\(\):\s*(.*)/.exec(err);
      items.push({ title: 'Program me exception aayi aur woh pakdi nahi gayi', why: 'Program ne ek error (exception) <code>throw</code> ki' + (what ? ': <code>' + esc(what[1]) + '</code>' : '') + ', lekin koi <code>try/catch</code> nahi tha. Aam wajah: <code>vector.at()</code> ya <code>string.at()</code> me ghalat index, ya <code>stoi</code> me ghalat text.', how: 'Index/value check karo, ya code ko <code>try { ... } catch (exception &amp;e) { cout &lt;&lt; e.what(); }</code> me rakho.', auto: false });
    } else if (sig || (ec != null && (ec < 0 || ec > 128))) {
      items.push({ title: 'Program crash ho gaya' + (sig ? ' (' + esc(sig) + ')' : ''), why: 'Program chalte chalte achanak ruk gaya. Aam wajahein: kisi number ko <code>0</code> se divide karna, array ki had se bahar index, ya <code>nullptr</code> pointer use karna.', how: 'Divide se pehle check karo <code>if (b != 0)</code>; arrays me index <code>0</code> se <code>size-1</code> tak rakho; pointer use karne se pehle check karo.', auto: false });
    } else if (ec != null && ec !== 0) {
      items.push({ title: 'Program ne ' + ec + ' return kiya', why: '<code>main()</code> ke end par <code>return 0;</code> ka matlab hai "sab theek". Is program ne ' + ec + ' return kiya, jo error samjha jaata hai.', how: 'Agar sab theek hai to <code>main()</code> ke end par <code>return 0;</code> likho.', auto: false });
    }
    if (/\bcin\b/.test(code) && !String(o.stdin || '').trim()) {
      items.push({ title: 'Program input maangta hai', why: 'Program me <code>cin</code> hai, lekin <b>Input</b> box khali hai, is liye values nahi mili.', how: 'Input box me har value nayi line par likho, phir Run dabao.', auto: false });
    }
  }

  // simple line diff for the "before / after" preview
  function diff(a, b) {
    var A = a.split('\n'), B = b.split('\n'), n = A.length, m = B.length, i, j;
    if (n * m > 400000) return null;
    var T = []; for (i = 0; i <= n; i++) { T.push(new Int32Array(m + 1)); }
    for (i = n - 1; i >= 0; i--) for (j = m - 1; j >= 0; j--) T[i][j] = A[i] === B[j] ? T[i + 1][j + 1] + 1 : Math.max(T[i + 1][j], T[i][j + 1]);
    var out = []; i = 0; j = 0;
    while (i < n || j < m) {
      if (i < n && j < m && A[i] === B[j]) { out.push([' ', A[i], i + 1]); i++; j++; }
      else if (i < n && (j >= m || T[i + 1][j] >= T[i][j + 1])) { out.push(['-', A[i], i + 1]); i++; }
      else { out.push(['+', B[j], j + 1]); j++; }
    }
    // keep changed lines with one line of context
    var keep = out.map(function (r, k) { return r[0] !== ' ' || (out[k - 1] && out[k - 1][0] !== ' ') || (out[k + 1] && out[k + 1][0] !== ' '); });
    var res = [], gap = false;
    out.forEach(function (r, k) { if (keep[k]) { res.push(r); gap = false; } else if (!gap) { res.push(['…', '', 0]); gap = true; } });
    if (res.length && res[0][0] === '…') res.shift();
    if (res.length && res[res.length - 1][0] === '…') res.pop();
    return res;
  }

  window.SWSolution = { analyze: analyze, diff: diff, parse: parse, esc: esc };
})();

// Start Well Education — online C++ compiler backend (Vercel serverless function)
// POST /api/run  { code: "...", stdin: "..." }
//   -> { ok, backend, compile_error, stdout, stderr, exit_code, time_ms }
// GET  /api/run?selftest=1  compiles and runs "Hello" to check everything works.
//
// The code is compiled by a free public service: Wandbox (wandbox.org) first,
// Compiler Explorer (godbolt.org) as a fallback. Nothing is stored.

const MAX_CODE = 64000;       // characters
const MAX_STDIN = 16000;
const MAX_OUTPUT = 20000;
const TIMEOUT_MS = 25000;
const PER_MINUTE = 20;        // runs per visitor per minute (best effort)

const hits = new Map();
function limited(ip) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < 60000);
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 5000) hits.clear();
  return list.length > PER_MINUTE;
}

function cut(s) {
  s = String(s || '');
  return s.length > MAX_OUTPUT ? s.slice(0, MAX_OUTPUT) + '\n… (output cut: too long)' : s;
}

async function post(url, body) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'User-Agent': 'StartWellEducation-SWE-Compiler/1.0' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const text = await r.text();
    if (!r.ok) throw new Error('HTTP ' + r.status + ': ' + text.slice(0, 200));
    return JSON.parse(text);
  } finally {
    clearTimeout(timer);
  }
}

// ---- Wandbox -------------------------------------------------------------
async function wandbox(code, stdin) {
  const d = await post('https://wandbox.org/api/compile.json', {
    compiler: 'gcc-head',
    code,
    stdin,
    options: '',
    'compiler-option-raw': '-std=c++17\n-O2\n-Wall\n-fdiagnostics-parseable-fixits\n-fno-diagnostics-color',
    'runtime-option-raw': '',
    save: false,
  });
  // When compilation fails Wandbox sends no program_* fields at all.
  const ran = d.program_message !== undefined || d.program_output !== undefined || d.program_error !== undefined;
  const compiled = ran || d.status === '0' || !/\berror\b/i.test(d.compiler_error || '');
  return {
    backend: 'Wandbox',
    compile_error: compiled ? '' : cut(d.compiler_error || d.compiler_message),
    warnings: compiled ? cut(d.compiler_error || '') : '',
    stdout: cut(d.program_output),
    stderr: cut(d.program_error),
    exit_code: d.status != null && d.status !== '' ? Number(d.status) : null,
    signal: d.signal || '',
  };
}

// ---- Compiler Explorer -------------------------------------------------------
const CE_COMPILERS = ['g132', 'g141', 'g122'];
function ceText(arr) { return (arr || []).map((l) => l.text).join('\n'); }
async function godbolt(code, stdin) {
  let last;
  for (const id of CE_COMPILERS) {
    try {
      const d = await post('https://godbolt.org/api/compiler/' + id + '/compile', {
        source: code,
        options: {
          userArguments: '-std=c++17 -O2 -Wall -fdiagnostics-parseable-fixits -fno-diagnostics-color',
          executeParameters: { args: [], stdin },
          compilerOptions: { executorRequest: true },
          filters: { execute: true },
          tools: [],
          libraries: [],
        },
        lang: 'c++',
        allowStoreCodeDebug: false,
      });
      const ex = d.execResult || d;
      const build = ex.buildResult || d.buildResult || {};
      const buildErr = ceText(build.stderr);
      const didRun = ex.didExecute !== false && build.code !== undefined ? build.code === 0 : ex.didExecute !== false;
      return {
        backend: 'Compiler Explorer',
        compile_error: didRun ? '' : cut(buildErr || ceText(d.stderr) || 'Compilation failed'),
        warnings: didRun ? cut(buildErr) : '',
        stdout: cut(ceText(ex.stdout)),
        stderr: cut(didRun ? ceText(ex.stderr) : ''),
        exit_code: didRun && typeof ex.code === 'number' ? ex.code : null,
        signal: ex.timedOut ? 'Timed out' : '',
      };
    } catch (e) { last = e; }
  }
  throw last || new Error('Compiler Explorer unavailable');
}

async function run(code, stdin) {
  const started = Date.now();
  const errors = [];
  for (const fn of [wandbox, godbolt]) {
    try {
      const r = await fn(code, stdin);
      return Object.assign({ ok: true, time_ms: Date.now() - started }, r);
    } catch (e) {
      errors.push((fn.name || 'backend') + ': ' + (e && e.message));
    }
  }
  return { ok: false, error: 'The online compiler is busy or unreachable right now. Please try again in a minute.', details: errors };
}

const HELLO = '#include <iostream>\nint main(){ std::cout << "Hello from Start Well!" << std::endl; return 0; }';

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  try {
    if (req.method === 'GET') {
      const url = new URL(req.url, 'http://x');
      if (url.searchParams.get('selftest')) {
        const r = await run(HELLO, '');
        res.statusCode = r.ok && /Hello from Start Well/.test(r.stdout) ? 200 : 502;
        return res.end(JSON.stringify(Object.assign({ selftest: res.statusCode === 200 }, r)));
      }
      return res.end(JSON.stringify({ ok: true, service: 'Start Well C++ compiler', usage: 'POST {code, stdin}' }));
    }
    if (req.method !== 'POST') { res.statusCode = 405; return res.end(JSON.stringify({ ok: false, error: 'Use POST' })); }

    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = null; } }
    if (!body || typeof body !== 'object') {
      const raw = await new Promise((ok) => { let s = ''; req.on('data', (c) => { s += c; if (s.length > 200000) req.destroy(); }); req.on('end', () => ok(s)); req.on('error', () => ok('')); });
      try { body = JSON.parse(raw || '{}'); } catch (e) { body = {}; }
    }
    const code = typeof body.code === 'string' ? body.code : '';
    const stdin = typeof body.stdin === 'string' ? body.stdin : '';
    if (!code.trim()) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: 'Please write some code first.' })); }
    if (code.length > MAX_CODE) { res.statusCode = 413; return res.end(JSON.stringify({ ok: false, error: 'Code is too long (max ' + MAX_CODE + ' characters).' })); }
    if (stdin.length > MAX_STDIN) { res.statusCode = 413; return res.end(JSON.stringify({ ok: false, error: 'Input is too long.' })); }

    const ip = String(req.headers['x-forwarded-for'] || (req.socket && req.socket.remoteAddress) || 'x').split(',')[0].trim();
    if (limited(ip)) { res.statusCode = 429; return res.end(JSON.stringify({ ok: false, error: 'Too many runs. Please wait a minute and try again.' })); }

    const r = await run(code, stdin);
    res.statusCode = r.ok ? 200 : 502;
    return res.end(JSON.stringify(r));
  } catch (e) {
    res.statusCode = 500;
    return res.end(JSON.stringify({ ok: false, error: 'Server error. Please try again.' }));
  }
};

module.exports._internal = { run, wandbox, godbolt };

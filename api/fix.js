// Start Well Education — AI "Solution" helper (Vercel serverless function)
// GET  /api/fix            -> { ai: true|false }   (is an AI key configured?)
// POST /api/fix { code, error, stdin } -> { ok, code, explanation }
//
// Optional. Works only when the Vercel project has the environment variable
// GEMINI_API_KEY (free key from https://aistudio.google.com/apikey).
// GEMINI_MODEL can override the model name.

const MAX_CODE = 30000;
const PER_MINUTE = 6;
const hits = new Map();
function limited(ip) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < 60000);
  list.push(now); hits.set(ip, list);
  if (hits.size > 5000) hits.clear();
  return list.length > PER_MINUTE;
}

const PROMPT = `You are a friendly C++ teacher at Start Well Education, a school in Bhimber, Pakistan.
A student's C++ program has a problem. Fix it so it compiles with g++ -std=c++17 and runs correctly.
Rules:
- Keep the student's idea, names, comments, messages and style. Change as little as possible.
- Return the COMPLETE corrected program (all lines), not just a part.
- Use only the standard library. Do not add code that reads input unless the program already does.
- explanation: 2 to 4 short sentences in simple Roman Urdu (Urdu written in English letters) saying what was wrong and what you changed.
Reply with JSON only: {"explanation": "...", "code": "..."}`;

async function readBody(req) {
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = null; } }
  if (body && typeof body === 'object') return body;
  const raw = await new Promise((ok) => { let s = ''; req.on('data', (c) => { s += c; if (s.length > 200000) req.destroy(); }); req.on('end', () => ok(s)); req.on('error', () => ok('')); });
  try { return JSON.parse(raw || '{}'); } catch (e) { return {}; }
}

function stripFence(s) {
  return String(s || '').replace(/^\s*```(?:json|cpp|c\+\+)?\s*/i, '').replace(/\s*```\s*$/, '');
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  const key = process.env.GEMINI_API_KEY;
  if (req.method === 'GET') return res.end(JSON.stringify({ ai: !!key }));
  if (req.method !== 'POST') { res.statusCode = 405; return res.end(JSON.stringify({ ok: false, error: 'Use POST' })); }
  if (!key) { res.statusCode = 501; return res.end(JSON.stringify({ ok: false, error: 'AI helper is not set up.' })); }

  const body = await readBody(req);
  const code = typeof body.code === 'string' ? body.code : '';
  const error = typeof body.error === 'string' ? body.error.slice(0, 6000) : '';
  const stdin = typeof body.stdin === 'string' ? body.stdin.slice(0, 2000) : '';
  if (!code.trim() || code.length > MAX_CODE) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: 'Bad request' })); }
  const ip = String(req.headers['x-forwarded-for'] || 'x').split(',')[0].trim();
  if (limited(ip)) { res.statusCode = 429; return res.end(JSON.stringify({ ok: false, error: 'Too many requests. Please wait a minute.' })); }

  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const text = PROMPT + '\n\nPROGRAM:\n```cpp\n' + code + '\n```\n\nPROBLEM (compiler error or what happened when it ran):\n' + (error || '(none given)') +
    (stdin ? '\n\nINPUT GIVEN TO THE PROGRAM:\n' + stdin : '');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 25000);
  try {
    const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text }] }],
        generationConfig: { temperature: 0.1, responseMimeType: 'application/json' },
      }),
      signal: ctrl.signal,
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error('AI HTTP ' + r.status + ' ' + JSON.stringify(d).slice(0, 200));
    const out = (((d.candidates || [])[0] || {}).content || {}).parts || [];
    const raw = stripFence(out.map((p) => p.text || '').join(''));
    let j;
    try { j = JSON.parse(raw); } catch (e) { j = null; }
    if (!j || typeof j.code !== 'string' || !j.code.trim()) throw new Error('AI gave no code');
    return res.end(JSON.stringify({ ok: true, code: stripFence(j.code).replace(/\s*$/, '\n'), explanation: String(j.explanation || '').slice(0, 1500) }));
  } catch (e) {
    res.statusCode = 502;
    return res.end(JSON.stringify({ ok: false, error: 'AI helper is busy right now.', details: String(e && e.message).slice(0, 300) }));
  } finally {
    clearTimeout(timer);
  }
};

// GNOSIA code runner — executes one learner program inside node:vm and
// evaluates test cases against it. Reads a JSON job on stdin, writes a JSON
// result on stdout. Started by app/services/runner.py with Node's permission
// model (no fs writes, no child processes, no network).
//
// Job:    { code, timeoutMs, tests: [{ id, kind, ...spec, fail? }], vars?: [names] }
// Result: { logs: [str], error: {name, message, line} | null, vars: {}, results: [{id, pass, detail, ms}] }
//
// Test kinds
//   source_regex   { pattern, flags? }                 source matches
//   source_absent  { pattern, flags? }                 source does NOT match
//   expr           { expr }                            truthy after the program ran (no error)
//   stdout_last    { equals, trim? }                   last console.log line
//   stdout_line    { line (1-based), equals, trim? }
//   stdout_count   { equals }                          number of printed lines
//   stdout_includes{ text }
//   no_error       {}
// `fail` may contain ${js} placeholders evaluated in the program context
// (plus `last` = last output line) to explain a failure, e.g. "skor akhir ${skor}".
import vm from 'node:vm';

const read = async () => { let s = ''; for await (const c of process.stdin) s += c; return JSON.parse(s); };

function lineOf(err) {
  const m = /main\.js:(\d+)/.exec(String(err && err.stack || ''));
  return m ? +m[1] : null;
}

function safe(v) {
  if (v === undefined) return { t: 'undefined' };
  try { return JSON.parse(JSON.stringify(v)); } catch { return String(v); }
}

const job = await read();
const timeout = Math.max(50, Math.min(5000, job.timeoutMs || 1000));
const src = String(job.code || '');

// No host objects are handed to the program: console is defined inside the context.
const ctx = vm.createContext({}, { codeGeneration: { strings: false, wasm: false }, microtaskMode: 'afterEvaluate' });
new vm.Script(`
  globalThis.__logs = [];
  const __fmt = v => typeof v === 'string' ? v : (v && typeof v === 'object') ? (() => { try { return JSON.stringify(v); } catch { return String(v); } })() : String(v);
  globalThis.console = Object.freeze({ log: (...a) => { if (__logs.length < 500) __logs.push(a.map(__fmt).join(' ')); }, error: (...a) => __logs.push(a.map(__fmt).join(' ')), warn: (...a) => __logs.push(a.map(__fmt).join(' ')) });
`).runInContext(ctx);

let error = null;
const t0 = performance.now();
try {
  new vm.Script(src, { filename: 'main.js' }).runInContext(ctx, { timeout });
} catch (e) {
  const timedOut = e && e.code === 'ERR_SCRIPT_EXECUTION_TIMEOUT';
  error = timedOut
    ? { name: 'TimeoutError', message: 'Program berjalan terlalu lama (mungkin loop tanpa akhir).', line: null }
    : { name: (e && e.name) || 'Error', message: (e && e.message) || String(e), line: lineOf(e) };
}
const runMs = Math.round(performance.now() - t0);

const evalIn = expr => new vm.Script(`(${expr})`, { filename: 'test.js' }).runInContext(ctx, { timeout: 200 });
let logs = [];
try { logs = JSON.parse(evalIn('JSON.stringify(globalThis.__logs)')); } catch { logs = []; }
const last = logs.length ? logs[logs.length - 1] : '';

function template(str) {
  if (!str) return '';
  return String(str).replace(/\$\{([^}]+)\}/g, (_, expr) => {
    if (expr.trim() === 'last') return last;
    try { const v = evalIn(`typeof ${expr.trim().split(/[^\w$]/)[0]} === 'undefined' ? undefined : (${expr})`); return v === undefined ? 'tidak ada' : String(v); }
    catch { return 'tidak ada'; }
  });
}

const vars = {};
for (const name of job.vars || []) {
  if (!/^[A-Za-z_$][\w$]*$/.test(name)) continue;
  try { vars[name] = safe(evalIn(`typeof ${name} === 'undefined' ? undefined : ${name}`)); } catch { vars[name] = { t: 'undefined' }; }
}

const norm = (s, trim) => (trim === false ? String(s) : String(s).trimEnd());
const results = (job.tests || []).map(t => {
  const s0 = performance.now();
  let pass = false, detail = '';
  try {
    switch (t.kind) {
      case 'source_regex': pass = new RegExp(t.pattern, t.flags || 'm').test(src); break;
      case 'source_absent': pass = !new RegExp(t.pattern, t.flags || 'm').test(src); break;
      case 'no_error': pass = !error; break;
      case 'expr': pass = !error && Boolean(evalIn(t.expr)); break;
      case 'stdout_last': pass = !error && norm(last, t.trim) === norm(t.equals, t.trim); break;
      case 'stdout_line': pass = !error && logs.length >= t.line && norm(logs[t.line - 1], t.trim) === norm(t.equals, t.trim); break;
      case 'stdout_count': pass = !error && logs.length === t.equals; break;
      case 'stdout_includes': pass = !error && logs.some(l => l.includes(t.text)); break;
      default: detail = `jenis tes tidak dikenal: ${t.kind}`;
    }
  } catch (e) { pass = false; detail = t.kind === 'expr' ? '' : String(e && e.message || e); }
  if (!pass && !detail) {
    const needsRun = !['source_regex', 'source_absent'].includes(t.kind);
    detail = error && needsRun ? (t.fail_on_error || 'program berhenti karena error') : template(t.fail) || 'belum sesuai';
  }
  return { id: t.id, pass, detail: pass ? '' : detail, ms: Math.max(1, Math.round(performance.now() - s0 + (t.kind === 'expr' ? runMs : 0))) };
});

process.stdout.write(JSON.stringify({ logs, error, vars, results, ms: runMs }));

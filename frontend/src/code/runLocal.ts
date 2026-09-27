/* Runs ungraded code (Playground) in a throwaway Web Worker so it cannot touch the page.
   Graded code (Challenge, Ulangan, Proyek) runs on the server sandbox instead. */
export type LocalRun = { logs: string[]; error: { name: string; message: string; line: number | null } | null };

const WORKER = `
const fmt = v => typeof v === 'string' ? v : (v && typeof v === 'object') ? (() => { try { return JSON.stringify(v); } catch { return String(v); } })() : String(v);
self.onmessage = e => {
  const logs = [];
  const con = { log: (...a) => logs.push(a.map(fmt).join(' ')), error: (...a) => logs.push(a.map(fmt).join(' ')), warn: (...a) => logs.push(a.map(fmt).join(' ')) };
  try {
    new Function('console', e.data.code)(con);
    self.postMessage({ logs, error: null });
  } catch (err) {
    const m = /<anonymous>:(\\d+):\\d+/.exec(String(err && err.stack || ''));
    self.postMessage({ logs, error: { name: (err && err.name) || 'Error', message: (err && err.message) || String(err), line: m ? +m[1] - 2 : null } });
  }
};`;

let url: string | null = null;

export function runLocal(code: string, timeoutMs = 1500): Promise<LocalRun> {
  url = url || URL.createObjectURL(new Blob([WORKER], { type: 'text/javascript' }));
  return new Promise(resolve => {
    const w = new Worker(url!);
    const t = setTimeout(() => {
      w.terminate();
      resolve({ logs: [], error: { name: 'TimeoutError', message: 'Program berjalan terlalu lama (mungkin loop tanpa akhir).', line: null } });
    }, timeoutMs);
    w.onmessage = e => { clearTimeout(t); w.terminate(); resolve(e.data as LocalRun); };
    w.onerror = e => { clearTimeout(t); w.terminate(); resolve({ logs: [], error: { name: 'Error', message: e.message, line: null } }); };
    w.postMessage({ code });
  });
}

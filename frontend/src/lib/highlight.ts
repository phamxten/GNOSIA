/* Tiny JS highlighter (from motion.js G.highlight) for read-only code in cards, choices and reviews.
   Editable code uses CodeMirror 6 with the same token colours. Returns escaped HTML. */
export const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const TOKENS = /("[^"]*"|'[^']*'|`[^`]*`)|\b(\d+(?:\.\d+)?)\b|\b(const|let|var|function|return|if|else|for|of|in|while|new|typeof|true|false|null|undefined|class)\b|\b(console|Math|JSON)\b|\.(\w+)(?=\()|(\/\/.*$)|([=+\-*/<>!;,(){}[\]])/g;

export function highlightLine(line: string): string {
  if (/^\s*\/\//.test(line)) return `<span class="c">${esc(line)}</span>`;
  let out = '';
  let last = 0;
  line.replace(TOKENS, (m, s, n, k, o, f, c, pn, idx: number) => {
    out += esc(line.slice(last, idx));
    if (s) out += `<span class="s">${esc(s)}</span>`;
    else if (n) out += `<span class="n">${n}</span>`;
    else if (k) out += `<span class="k">${k}</span>`;
    else if (o) out += `<span class="p">${o}</span>`;
    else if (f) out += `.<span class="f">${esc(f)}</span>`;
    else if (c) out += `<span class="c">${esc(c)}</span>`;
    else if (pn) out += `<span class="pn">${esc(pn)}</span>`;
    last = idx + m.length;
    return m;
  });
  return out + esc(line.slice(last));
}

export const highlightLines = (src: string) => src.split('\n').map(highlightLine);

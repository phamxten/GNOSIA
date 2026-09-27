/* A tiny, safe arithmetic evaluator for content templates like "{{2 + v}}" or "harga * jumlah".
   Supports numbers, variables from `vars`, + - * / and parentheses. No eval. */
export function calc(expr: string, vars: Record<string, number>): number {
  const tokens = expr.match(/\d+(?:\.\d+)?|[A-Za-z_$][\w$]*|[-+*/()]/g) || [];
  let i = 0;
  const peek = () => tokens[i];
  const next = () => tokens[i++];
  const factor = (): number => {
    const t = next();
    if (t === '(') { const v = sum(); next(); return v; }
    if (t === '-') return -factor();
    if (t === undefined) return 0;
    if (/^\d/.test(t)) return parseFloat(t);
    return vars[t] ?? 0;
  };
  const term = (): number => {
    let v = factor();
    while (peek() === '*' || peek() === '/') { const op = next(); const r = factor(); v = op === '*' ? v * r : v / r; }
    return v;
  };
  const sum = (): number => {
    let v = term();
    while (peek() === '+' || peek() === '-') { const op = next(); const r = term(); v = op === '+' ? v + r : v - r; }
    return v;
  };
  return sum();
}

/** Replaces {{expr}} placeholders using calc(). */
export const fill = (tpl: string, vars: Record<string, number>) => tpl.replace(/\{\{([^}]+)\}\}/g, (_, e) => String(calc(e, vars)));

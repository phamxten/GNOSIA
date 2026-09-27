import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Exercise } from '../api/types';
import { Icon } from '../design/Icon';
import { cx } from '../design/ui';
import { burst, ease, motion, pop, shake } from '../fx';
import { highlightLine } from '../lib/highlight';

export type Marks = { picked?: number | null; ok?: boolean } | boolean[] | null;
type Props = { item: Exercise; locked: boolean; marks: Marks; onChange: (answer: unknown, ready: boolean) => void };

const hl = (s: string) => ({ __html: highlightLine(s) || ' ' });

// ---------------------------------------------------------------- Choice / PredictOutput
export function ChoiceEx({ item, locked, marks, onChange }: Props) {
  const [pick, setPick] = useState<number | null>(null);
  const m = marks as { picked?: number; ok?: boolean } | null;
  const choose = (i: number, el: HTMLElement) => { if (locked) return; setPick(i); pop(el); onChange(i, true); };
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.target as Element).closest('input,textarea')) return;
      if (/^[1-4]$/.test(e.key) && item.choices && +e.key <= item.choices.length) {
        const el = document.querySelectorAll<HTMLElement>('[data-choices] .choice')[+e.key - 1];
        if (el) choose(+e.key - 1, el);
      }
    };
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  });
  return (
    <>
      {item.code && <div className="codecard mt-6"><div className="cc-body">{item.code.split('\n').map((l, i) => <div className="cc-line" key={i}><span className="cc-ln">{i + 1}</span><span dangerouslySetInnerHTML={hl(l)} /></div>)}</div></div>}
      <div className={cx('choices', item.cols === 2 && 'cols-2', locked && 'is-locked')} role="radiogroup" data-choices data-answer-area>
        {item.choices!.map((c, i) => {
          const picked = pick === i;
          const cls = cx('choice', picked && !m && 'is-picked', m && picked && (m.ok ? 'is-right' : 'is-wrong'), m?.ok && !picked && 'is-dim');
          return (
            <button key={i} className={cls} role="radio" aria-checked={picked} onClick={e => choose(i, e.currentTarget)}>
              <span className="key">{i + 1}</span><span className="code">{c}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}

// ---------------------------------------------------------------- TokenFill
export function FillEx({ item, locked, marks, onChange }: Props) {
  const code = item.code || '';
  const nSlots = (code.match(/\{\{slot\}\}/g) || []).length;
  const [slots, setSlots] = useState<(number | null)[]>(Array(nSlots).fill(null));
  const [over, setOver] = useState<number | null>(null);
  const slotRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const tray = item.tray || [];
  const m = Array.isArray(marks) ? marks : null;
  const update = (next: (number | null)[]) => { setSlots(next); onChange(next.map(t => (t === null ? null : tray[t].val)), next.every(x => x !== null)); };
  const place = (tok: number, slot?: number) => {
    if (locked) return;
    const next = [...slots];
    const target = slot ?? next.findIndex(x => x === null);
    if (target < 0) return;
    const prevIdx = next.indexOf(tok);
    if (prevIdx >= 0) next[prevIdx] = null;
    next[target] = tok;
    update(next);
    requestAnimationFrame(() => pop(slotRefs.current[target]));
  };
  const clear = (i: number) => { if (locked || slots[i] === null) return; const next = [...slots]; next[i] = null; update(next); };
  const startDrag = (e: React.PointerEvent<HTMLButtonElement>, tok: number) => {
    if (locked || e.button !== 0) return;
    e.preventDefault();
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    const sx = e.clientX, sy = e.clientY;
    let hit: number | null = null;
    el.classList.add('is-drag');
    const move = (ev: PointerEvent) => {
      el.style.transform = `translate(${ev.clientX - sx}px, ${ev.clientY - sy}px) rotate(-3deg) scale(1.06)`;
      hit = slotRefs.current.findIndex(s => { if (!s) return false; const r = s.getBoundingClientRect(); return ev.clientX > r.left && ev.clientX < r.right && ev.clientY > r.top && ev.clientY < r.bottom; });
      if (hit < 0) hit = null;
      setOver(hit);
    };
    const up = (ev: PointerEvent) => {
      el.releasePointerCapture(e.pointerId);
      el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up);
      el.classList.remove('is-drag'); el.style.transform = ''; setOver(null);
      const moved = Math.hypot(ev.clientX - sx, ev.clientY - sy) > 4;
      if (!moved) place(tok); else if (hit !== null) place(tok, hit);
    };
    el.addEventListener('pointermove', move); el.addEventListener('pointerup', up);
  };
  const lines = code.split('\n');
  let s = 0;
  return (
    <>
      <div className="slot-code mt-6" data-answer-area>
        {lines.map((line, li) => (
          <div key={li}>
            <span className="t-faint">{li + 1}</span>{'  '}
            {line.split(/(\{\{slot\}\})/).map((part, pi) => {
              if (part !== '{{slot}}') return <span key={pi} dangerouslySetInnerHTML={hl(part)} />;
              const idx = s++;
              const tok = slots[idx];
              return (
                <span key={pi} ref={el => { slotRefs.current[idx] = el; }} role="button" tabIndex={0} aria-label={`Kotak ${idx + 1}${tok !== null ? `: ${tray[tok].label}` : ' kosong'}`}
                  className={cx('slot', tok !== null && 'is-filled', over === idx && 'is-over', m && (m[idx] ? 'is-right' : 'is-wrong'))}
                  onClick={() => clear(idx)} onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Backspace') clear(idx); }}>
                  {tok !== null && <span className="token">{tray[tok].label}</span>}
                </span>
              );
            })}
          </div>
        ))}
      </div>
      <div className="token-tray" aria-label="Potongan kode">
        {tray.map((t, i) => (
          <button key={i} className={cx('token', slots.includes(i) && 'is-used')} onPointerDown={e => startDrag(e, i)}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); place(i); } }}>{t.label}</button>
        ))}
      </div>
    </>
  );
}

// ---------------------------------------------------------------- Parsons
export function ParsonsEx({ item, locked, marks, onChange }: Props) {
  const lines = (item.lines || []) as { id: string; code: string }[];
  const [order, setOrder] = useState(lines.map(l => l.id));
  const box = useRef<HTMLDivElement>(null);
  const firstPos = useRef<Map<string, number> | null>(null);
  const m = Array.isArray(marks) ? marks : null;
  useEffect(() => { onChange(order, true); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const snapshot = () => {
    const map = new Map<string, number>();
    box.current?.querySelectorAll<HTMLElement>('.pblock').forEach(b => map.set(b.dataset.id!, b.offsetTop));
    firstPos.current = map;
  };
  useLayoutEffect(() => { // FLIP: animate siblings to their new place
    const first = firstPos.current;
    if (!first || motion() === 'off') return;
    box.current?.querySelectorAll<HTMLElement>('.pblock').forEach(b => {
      if (b.classList.contains('is-drag')) return;
      const d = (first.get(b.dataset.id!) ?? b.offsetTop) - b.offsetTop;
      if (d) b.animate([{ transform: `translateY(${d}px)` }, { transform: 'none' }], { duration: 280, easing: ease.gentle });
    });
    firstPos.current = null;
  }, [order]);
  const move = (from: number, to: number) => {
    if (to < 0 || to >= order.length || from === to) return;
    snapshot();
    const next = [...order];
    const [x] = next.splice(from, 1);
    next.splice(to, 0, x);
    setOrder(next);
    onChange(next, true);
  };
  const startDrag = (e: React.PointerEvent<HTMLDivElement>, id: string) => {
    if (locked || e.button !== 0) return;
    e.preventDefault();
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    el.classList.add('is-drag');
    const sy = e.clientY;
    const base = el.offsetTop;
    let cur = [...order];
    const mv = (ev: PointerEvent) => {
      const others = [...box.current!.querySelectorAll<HTMLElement>('.pblock')].filter(x => x !== el);
      const idx = others.findIndex(x => { const r = x.getBoundingClientRect(); return ev.clientY < r.top + r.height / 2; });
      const target = idx < 0 ? others.length : idx;
      const from = cur.indexOf(id);
      if (target !== from) {
        snapshot();
        const next = cur.filter(x => x !== id);
        next.splice(target, 0, id);
        cur = next;
        setOrder(next);
      }
      requestAnimationFrame(() => { el.style.transform = `translateY(${ev.clientY - sy - (el.offsetTop - base)}px)`; });
    };
    const up = () => {
      el.classList.remove('is-drag'); el.style.transform = '';
      el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', up);
      onChange(cur, true);
    };
    el.addEventListener('pointermove', mv); el.addEventListener('pointerup', up);
  };
  const byId = Object.fromEntries(lines.map(l => [l.id, l]));
  return (
    <div className="parsons" ref={box} data-answer-area role="list">
      {order.map((id, i) => (
        <div key={id} data-id={id} className={cx('pblock', m && (m[i] ? 'is-right' : 'is-wrong'))} tabIndex={0} role="listitem"
          aria-label={`Baris ${i + 1}: ${byId[id].code}. Alt dan panah atas atau bawah untuk memindah.`}
          onPointerDown={e => startDrag(e, id)}
          onKeyDown={e => {
            if (!e.altKey || locked) return;
            if (e.key === 'ArrowUp') { e.preventDefault(); move(i, i - 1); requestAnimationFrame(() => (box.current?.querySelector(`[data-id="${id}"]`) as HTMLElement)?.focus()); }
            if (e.key === 'ArrowDown') { e.preventDefault(); move(i, i + 1); requestAnimationFrame(() => (box.current?.querySelector(`[data-id="${id}"]`) as HTMLElement)?.focus()); }
          }}>
          <span className="grip"><Icon name="grip-vertical" /></span><span className="pcode" dangerouslySetInnerHTML={hl(byId[id].code)} />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- BugPick
export function BugEx({ item, locked, marks, onChange }: Props) {
  const [pick, setPick] = useState<number | null>(null);
  const m = marks as { picked?: number; ok?: boolean } | null;
  const lines = (item.lines || []) as string[];
  return (
    <>
      <div className="bugcode" role="listbox" aria-label="Baris kode" data-answer-area>
        {lines.map((l, i) => {
          const n = i + 1;
          return (
            <div key={i} role="option" tabIndex={0} aria-selected={pick === n}
              className={cx('bugline', pick === n && !m && 'is-picked', m && pick === n && (m.ok ? 'is-right' : 'is-wrong'))}
              onClick={() => { if (!locked) { setPick(n); onChange(n, true); } }}
              onKeyDown={e => { if ((e.key === 'Enter' || e.key === ' ') && !locked) { e.preventDefault(); e.stopPropagation(); setPick(n); onChange(n, true); } }}>
              <span className="ln-no">{n}</span><span dangerouslySetInnerHTML={hl(l)} />
            </div>
          );
        })}
      </div>
      {item.error && <div className="out-bubble is-err mt-4"><Icon name="circle-x" size={14} />{item.error}</div>}
    </>
  );
}

// ---------------------------------------------------------------- SliderTask
export function SliderEx({ item, locked, onChange }: Props) {
  const min = item.min ?? 1, max = item.max ?? 10;
  const [v, setV] = useState(item.value ?? min);
  const total = v * (item.result?.mul ?? 1);
  const hit = total === item.target;
  useEffect(() => { onChange(v, false); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const code = (item.code || '').split('\n');
  return (
    <>
      <div className="codecard mt-6"><div className="cc-body">
        {code.map((l, i) => (
          <div key={i} className={cx('cc-line', item.lit?.includes(i + 1) && 'is-lit')}><span className="cc-ln">{i + 1}</span>
            {l.split(/(\{\{v\}\})/).map((p, j) => (p === '{{v}}' ? <span key={j} className="n">{v}</span> : <span key={j} dangerouslySetInnerHTML={hl(p)} />))}
          </div>
        ))}
      </div></div>
      <div className="slider-box" data-answer-area>
        <div className="slider-readout"><span>{item.var} = <span className="big">{v}</span></span><span>{item.result?.label} = <span className="big" style={{ color: hit ? 'var(--perkuat-ink)' : undefined }}>{total}</span></span></div>
        <input className="range" type="range" min={min} max={max} value={v} disabled={locked} aria-label={item.var}
          style={{ ['--p' as string]: `${((v - min) / (max - min)) * 100}%` }}
          onChange={e => { const n = +e.target.value; setV(n); onChange(n, true); }} />
        <div className="row between mt-2 target-line"><span>{min}</span><span>target {item.target}</span><span>{max}</span></div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------- MatchPairs
export function MatchEx({ item, locked, onChange }: Props) {
  const left = item.left || [], right = item.right || [];
  const [pick, setPick] = useState<{ side: 'l' | 'r'; key: string } | null>(null);
  const [done, setDone] = useState<string[]>([]);
  const [wrong, setWrong] = useState<string[]>([]);
  const [links, setLinks] = useState<string[]>([]);
  const wrap = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const draw = (key: string) => {
    const o = svg.current!.getBoundingClientRect();
    const a = wrap.current!.querySelector<HTMLElement>(`[data-l="${key}"]`)!.getBoundingClientRect();
    const b = wrap.current!.querySelector<HTMLElement>(`[data-r="${key}"]`)!.getBoundingClientRect();
    const x1 = a.right - o.left, y1 = a.top + a.height / 2 - o.top, x2 = b.left - o.left, y2 = b.top + b.height / 2 - o.top;
    return `M${x1} ${y1} C${x1 + 20} ${y1} ${x2 - 20} ${y2} ${x2} ${y2}`;
  };
  useLayoutEffect(() => {
    const p = svg.current?.lastElementChild as SVGPathElement | null;
    if (!p || motion() === 'off') return;
    const len = p.getTotalLength();
    p.animate([{ strokeDashoffset: len, strokeDasharray: `${len}` }, { strokeDashoffset: 0, strokeDasharray: `${len}` }], { duration: 400, easing: ease.out });
  }, [links.length]);
  const click = (side: 'l' | 'r', key: string, el: HTMLElement) => {
    if (locked || done.includes(key)) return;
    if (!pick) { setPick({ side, key }); return; }
    if (pick.side === side) { setPick(pick.key === key ? null : { side, key }); return; }
    if (pick.key === key) {
      const nd = [...done, key];
      setDone(nd);
      setLinks(l => [...l, draw(key)]);
      burst(el, { count: 8, spread: 40 });
      onChange(nd.map(k => [k, k]), nd.length === left.length);
    } else {
      const ks = [`${pick.side}:${pick.key}`, `${side}:${key}`];
      setWrong(ks);
      setTimeout(() => setWrong([]), 400);
      shake(el);
    }
    setPick(null);
  };
  const cls = (side: 'l' | 'r', key: string, code?: boolean) => cx('mitem', code && 'code', pick?.side === side && pick.key === key && 'is-picked', done.includes(key) && 'is-done', wrong.includes(`${side}:${key}`) && 'is-wrong');
  return (
    <div className="match" ref={wrap} data-answer-area>
      <svg className="links" ref={svg}>{links.map((d, i) => <path key={i} d={d} />)}</svg>
      <div className="stack gap-2">{left.map(x => <button key={x.key} data-l={x.key} className={cls('l', x.key, item.left_code)} onClick={e => click('l', x.key, e.currentTarget)} aria-pressed={pick?.side === 'l' && pick.key === x.key}>{x.text}</button>)}</div>
      <div className="stack gap-2">{right.map(x => <button key={x.key} data-r={x.key} className={cls('r', x.key, item.right_code)} onClick={e => click('r', x.key, e.currentTarget)} aria-pressed={pick?.side === 'r' && pick.key === x.key}>{x.text}</button>)}</div>
    </div>
  );
}

export const TYPE_CHIP: Record<string, [string, string]> = {
  choice: ['list', 'Pilih jawaban'], predict: ['terminal', 'Tebak output'], fill: ['puzzle', 'Lengkapi kode'], parsons: ['arrow-down-up', 'Susun baris'],
  bug: ['bug', 'Temukan bug'], slider: ['sliders-horizontal', 'Atur nilai'], match: ['link', 'Pasangkan'],
};

export function ExerciseBody(p: Props) {
  switch (p.item.type) {
    case 'choice': case 'predict': return <ChoiceEx {...p} />;
    case 'fill': return <FillEx {...p} />;
    case 'parsons': return <ParsonsEx {...p} />;
    case 'bug': return <BugEx {...p} />;
    case 'slider': return <SliderEx {...p} />;
    case 'match': return <MatchEx {...p} />;
    default: return null;
  }
}

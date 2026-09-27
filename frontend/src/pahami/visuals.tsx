import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Visual } from '../api/types';
import { Icon } from '../design/Icon';
import type { Mood } from '../design/Nosi';
import { cx } from '../design/ui';
import { burst, flyTo, pop, rise, shake } from '../fx';
import { fill } from '../lib/calc';
import { highlightLine } from '../lib/highlight';
import { Html } from '../lib/html';
import { Knob } from './Knob';

type Ctx = { setMood: (m: Mood) => void; onProgress?: (seen: number, total: number) => void; preview?: boolean };

/** One code line where {{name}} placeholders become scrubbable knobs. */
function LineWithKnobs({ line, knobs }: { line: string; knobs: Record<string, ReactNode> }) {
  const parts = line.split(/(\{\{\w+\}\})/);
  return (
    <>
      {parts.map((p, i) => {
        const m = /^\{\{(\w+)\}\}$/.exec(p);
        if (m && knobs[m[1]] !== undefined) return <Fragment key={i}>{knobs[m[1]]}</Fragment>;
        return <span key={i} dangerouslySetInnerHTML={{ __html: highlightLine(p) }} />;
      })}
    </>
  );
}

function VarBox({ tag, val, type, isConst, boxRef, tagHidden, valHidden, tagStyle, boxStyle, valStyle }: {
  tag?: string; val?: ReactNode; type?: string; isConst?: boolean; boxRef?: React.Ref<HTMLDivElement>; tagHidden?: boolean; valHidden?: boolean;
  tagStyle?: React.CSSProperties; boxStyle?: React.CSSProperties; valStyle?: React.CSSProperties;
}) {
  return (
    <div className="vbox">
      {tag && <span className="tag" style={{ ...(tagHidden ? { opacity: 0 } : {}), ...tagStyle }}>{tag}</span>}
      <div className={cx('box', isConst && 'is-const')} ref={boxRef} style={boxStyle}><span className="val" style={{ ...(valHidden ? { opacity: 0 } : {}), ...valStyle }}>{val}</span></div>
      {type && <span className="type">{type}</span>}
    </div>
  );
}

// ------------------------------------------------------------------ intro
export function IntroSide({ v }: { v: Extract<Visual, { type: 'intro' }> }) {
  if (!v.side) return null;
  if (v.side.kind === 'bubble') return <div className="hide-sm" style={{ transform: 'scale(1.15)' }}><span className="out-bubble" style={{ fontSize: 16 }}><span className="p">›</span>{v.side.text}</span></div>;
  return <div className="hide-sm" style={{ transform: 'scale(1.15)' }}><VarBox tag={v.side.tag} val={v.side.val} type={v.side.type} /></div>;
}

export function IntroObjectives({ v }: { v: Extract<Visual, { type: 'intro' }> }) {
  return (
    <>
      <div className="t-label mt-8">{v.objectives_label || 'Setelah bagian ini kamu bisa'}</div>
      <div className="obj-list">
        {v.objectives.map((o, i) => <div className="obj rise" style={{ animationDelay: `${150 + i * 90}ms` }} key={i}><span className="n">{i + 1}</span><Html html={o} /></div>)}
      </div>
    </>
  );
}

// ------------------------------------------------------------------ tokens
export function TokensViz({ v, ctx }: { v: Extract<Visual, { type: 'tokens' }>; ctx: Ctx }) {
  const [on, setOn] = useState<string | null>(null);
  const [seen, setSeen] = useState<Set<string>>(new Set());
  const [tagShown, setTagShown] = useState(false);
  const [valShown, setValShown] = useState(false);
  const slot = useRef<HTMLDivElement>(null);
  const tagRef = useRef<HTMLSpanElement>(null);
  const explain = useRef<HTMLDivElement>(null);
  const tokRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const cur = v.tokens.find(t => t.key === on);
  useEffect(() => { ctx.onProgress?.(seen.size, v.tokens.length); if (seen.size === v.tokens.length) ctx.setMood('happy'); }, [seen.size]); // eslint-disable-line react-hooks/exhaustive-deps
  const click = (key: string) => {
    const t = v.tokens.find(x => x.key === key)!;
    setOn(key);
    rise(explain.current);
    if (t.effect === 'tag') { setTagShown(true); requestAnimationFrame(() => pop(tagRef.current)); }
    if (t.effect === 'fly' && !valShown) flyTo(tokRefs.current[key], slot.current).then(() => { setValShown(true); pop(slot.current); });
    if (t.effect === 'pop') pop(slot.current);
    setSeen(s => new Set(s).add(key));
  };
  const target = v.target;
  return (
    <div className="viz viz-dots mt-6">
      <div className="row between wrap gap-6" style={{ alignItems: 'center' }}>
        <div className="bigcode" role="group" aria-label={v.tokens.map(t => t.text).join(' ') + (v.suffix || '')}>
          {v.tokens.map(t => (
            <button key={t.key} ref={el => { tokRefs.current[t.key] = el; }} className={cx('tok', t.cls, on === t.key && 'is-on')} onClick={() => click(t.key)} aria-pressed={on === t.key}>{t.text}</button>
          ))}
          {v.suffix && <span className="pn">{v.suffix}</span>}
        </div>
        {target.kind === 'output' ? (
          <div className="vbox">
            <span className="tag" ref={tagRef} style={{ opacity: tagShown ? 1 : 0 }}>{target.tag || 'output'}</span>
            <div className="out-screen" ref={slot}>{valShown && <span className="out-bubble"><span className="p">›</span>{target.val}</span>}</div>
            <span className="type">{target.type}</span>
          </div>
        ) : (
          <div className="vbox">
            <span className="tag" ref={tagRef} style={{ opacity: tagShown ? 1 : 0 }}>{target.tag}</span>
            <div className="box" ref={slot}><span className="val" style={{ opacity: valShown ? 1 : 0 }}>{target.val}</span></div>
            <span className="type">{target.type}</span>
          </div>
        )}
      </div>
      <div className="explain-box" aria-live="polite" ref={explain}>
        <span className="ek">{cur ? cur.text : '?'}</span>
        <Html className="t-muted" html={cur ? cur.explain : v.start || 'Ketuk bagian kode.'} />
      </div>
      <div className="row gap-2 mt-4 t-sm t-faint" data-tok-progress>Bagian dipahami: <span className="hint-ladder">{v.tokens.map((t, i) => <i key={t.key} className={i < seen.size ? 'on' : ''} />)}</span></div>
    </div>
  );
}

// ------------------------------------------------------------------ live code
export function LiveCodeViz({ v }: { v: Extract<Visual, { type: 'livecode' }> }) {
  const [val, setVal] = useState(v.knob.value);
  const box = useRef<HTMLDivElement>(null);
  const change = (n: number) => { setVal(n); pop(box.current); };
  const knob = <Knob value={val} min={v.knob.min} max={v.knob.max} step={v.knob.step} label={v.knob.label || 'angka'} onChange={change} />;
  const outs = (v.outputs || []).map(o => fill(o, { v: val }));
  const card = (
    <div className="codecard">
      <div className="cc-head"><span className="cc-file"><span className="lang">JS</span>{v.file || 'kode.js'}</span>{v.status && <span className="t-xs t-faint" style={{ marginLeft: 'auto' }}>{v.status}</span>}</div>
      <div className="cc-body">
        {v.lines.map((l, i) => (
          <div key={i} className={cx('cc-line', v.lit?.includes(i + 1) && 'is-lit')}><span className="cc-ln">{i + 1}</span><LineWithKnobs line={l.replace(/\{\{knob\}\}/g, '{{k}}')} knobs={{ k: knob }} /></div>
        ))}
      </div>
      <div className="cc-out">{outs.map((o, i) => <span className="out-bubble" key={i + o}><span className="p">›</span>{o}</span>)}</div>
    </div>
  );
  if (!v.box) return <div className="mt-6">{card}{v.note && <Html as="p" className="t-xs t-faint mt-4" html={v.note} />}</div>;
  return (
    <div className="grid grid-2 mt-6" style={{ alignItems: 'center', gap: 28 }}>
      {card}
      <div className="t-center">
        <VarBox tag={v.box.tag} val={val} type={v.box.type} boxRef={box} />
        {v.note && <Html as="p" className="t-xs t-faint mt-6" html={v.note} />}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ let vs const
export function TryChangeViz({ v, ctx }: { v: Extract<Visual, { type: 'trychange' }>; ctx: Ctx }) {
  const [vals, setVals] = useState(v.boxes.map(b => b.val));
  const [err, setErr] = useState(false);
  const refs = useRef<(HTMLDivElement | null)[]>([]);
  const errRef = useRef<HTMLDivElement>(null);
  const tryIt = (i: number) => {
    const b = v.boxes[i];
    if (b.kind === 'let') {
      setVals(vs => vs.map((x, j) => (j === i ? (x === b.val ? b.alt || b.val : b.val) : x)));
      pop(refs.current[i]); burst(refs.current[i], { count: 8, spread: 50 }); setErr(false); ctx.setMood('happy');
    } else {
      shake(refs.current[i]); setErr(true); ctx.setMood('oops'); requestAnimationFrame(() => rise(errRef.current));
    }
  };
  return (
    <div className="viz viz-dots mt-6" style={{ minHeight: 260 }}>
      <div className="boxes" style={{ marginTop: 36 }}>
        {v.boxes.map((b, i) => (
          <div className="stack" style={{ alignItems: 'center', gap: 14 }} key={b.tag}>
            <VarBox tag={b.tag} val={vals[i]} type={b.kind} isConst={b.kind === 'const'} boxRef={el => { refs.current[i] = el; }} valStyle={vals[i].length > 6 ? { fontSize: 15 } : undefined} />
            <button className="btn btn-secondary btn-sm btn-press" onClick={() => tryIt(i)}><Icon name="pencil" /><span className="t-mono">{b.button}</span></button>
          </div>
        ))}
      </div>
      {err && v.error && <div className="err-bubble" ref={errRef}><span className="out-bubble is-err"><Icon name="circle-x" size={14} />{v.error}</span></div>}
    </div>
  );
}

// ------------------------------------------------------------------ cards
export function CardsViz({ v }: { v: Extract<Visual, { type: 'cards' }> }) {
  return (
    <div className={cx('grid mt-6', v.cards.length === 2 ? 'grid-2' : 'grid-3')} style={{ gap: 12 }}>
      {v.cards.map((c, i) => (
        <div className="card card-pad" data-tilt key={i}>
          <div className="t-label">{c.label}</div>
          <div className={cx('t-mono mt-2', c.tone === 'bad' && 't-danger', c.tone === 'muted' && 't-faint')} style={{ fontSize: 17, wordBreak: 'break-word' }}>{c.code}</div>
          <Html as="p" className="t-sm t-muted mt-2" html={c.note} />
        </div>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------ two knobs → total
export function KnobCalcViz({ v }: { v: Extract<Visual, { type: 'knobcalc' }> }) {
  const [vals, setVals] = useState<Record<string, number>>(Object.fromEntries(Object.entries(v.knobs).map(([k, s]) => [k, s.value])));
  const totalBox = useRef<HTMLDivElement>(null);
  const { a, op, b } = v.formula;
  const total = op === '*' ? vals[a] * vals[b] : op === '+' ? vals[a] + vals[b] : vals[a] - vals[b];
  const knobs = Object.fromEntries(Object.entries(v.knobs).map(([k, s]) => [k,
    <Knob key={k} value={vals[k]} min={s.min} max={s.max} step={s.step} label={k} onChange={n => { setVals(x => ({ ...x, [k]: n })); pop(totalBox.current); }} />]));
  const big = (n: number) => (String(n).length > 4 ? { fontSize: 17 } : undefined);
  return (
    <>
      <div className="codecard mt-6">
        <div className="cc-head"><span className="cc-file"><span className="lang">JS</span>{v.file || 'kode.js'}</span></div>
        <div className="cc-body">
          {v.lines.map((l, i) => <div key={i} className={cx('cc-line', v.lit?.includes(i + 1) && 'is-lit')}><span className="cc-ln">{i + 1}</span><LineWithKnobs line={l} knobs={knobs} /></div>)}
        </div>
        <div className="cc-out"><span className="out-bubble"><span className="p">›</span>{v.output_prefix}<b>{total}</b></span></div>
      </div>
      <div className="boxes mt-8">
        <VarBox tag={a} val={vals[a]} valStyle={big(vals[a])} />
        <span className="op">{op === '*' ? '×' : op}</span>
        <VarBox tag={b} val={vals[b]} valStyle={big(vals[b])} />
        <span className="op">=</span>
        <VarBox tag={v.result} val={total} boxRef={totalBox} valStyle={big(total)} tagStyle={{ background: 'var(--perkuat-fill)' }}
          boxStyle={{ borderColor: 'var(--perkuat-line)', boxShadow: 'inset 0 -10px 0 var(--perkuat-soft)' }} />
      </div>
    </>
  );
}

// ------------------------------------------------------------------ summary
export function SummaryViz({ v }: { v: Extract<Visual, { type: 'summary' }> }) {
  return (
    <>
      <div className="sum-grid">
        {v.cards.map((c, i) => (
          <div className="sum-card rise" style={{ animationDelay: `${150 + i * 90}ms` }} key={i}>
            <Icon name={c.icon} size={20} className="ic-i t-accent" />
            <Html as="div" className="t-h4 mt-2" html={c.title} />
            <Html as="p" className="t-sm t-muted mt-1" html={c.body} />
          </div>
        ))}
      </div>
      {v.callout && <div className="callout callout-accent mt-6"><Icon name={v.callout.icon} /><Html as="div" className="t-sm" html={v.callout.html} /></div>}
    </>
  );
}

// ------------------------------------------------------------------ static code / shelf
export function CodeViz({ v }: { v: Extract<Visual, { type: 'code' }> }) {
  return (
    <div className="codecard mt-6">
      {v.file && <div className="cc-head"><span className="cc-file"><span className="lang">JS</span>{v.file}</span></div>}
      <div className="cc-body">{v.lines.map((l, i) => <div className="cc-line" key={i}><span className="cc-ln">{i + 1}</span><span dangerouslySetInnerHTML={{ __html: highlightLine(l) }} /></div>)}</div>
      {!!v.outputs?.length && <div className="cc-out">{v.outputs.map((o, i) => <span className="out-bubble" key={i} style={{ animationDelay: `${i * 120}ms` }}><span className="p">›</span>{o}</span>)}</div>}
    </div>
  );
}

export function ShelfViz({ v }: { v: Extract<Visual, { type: 'shelf' }> }) {
  return (
    <div className="viz viz-dots mt-6 t-center">
      <div className="vbox"><span className="tag">{v.name}</span>
        <div className="shelf">{v.items.map((it, i) => <div key={i} className={cx('slot-i', v.hot === i && 'is-hot')}>{String(it)}<small>{i}</small></div>)}</div>
      </div>
    </div>
  );
}

export function Reveal({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={cx('reveal', open && 'is-open')} role="button" tabIndex={0} aria-expanded={open}
      onClick={() => setOpen(o => !o)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); setOpen(o => !o); } }}>
      <div className="rv-q"><Icon name="help-circle" className="t-accent" /><Html html={q} /></div>
      <Html as="div" className="rv-a" html={a} />
    </div>
  );
}

export function VisualView({ v, ctx }: { v: Visual; ctx: Ctx }) {
  switch (v.type) {
    case 'tokens': return <TokensViz v={v} ctx={ctx} />;
    case 'livecode': return <LiveCodeViz v={v} />;
    case 'trychange': return <TryChangeViz v={v} ctx={ctx} />;
    case 'cards': return <CardsViz v={v} />;
    case 'knobcalc': return <KnobCalcViz v={v} />;
    case 'summary': return <SummaryViz v={v} />;
    case 'code': return <CodeViz v={v} />;
    case 'shelf': return <ShelfViz v={v} />;
    default: return null;
  }
}

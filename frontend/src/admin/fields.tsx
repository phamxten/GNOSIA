import { useEffect, useState, type ReactNode } from 'react';
import { Icon } from '../design/Icon';
import { cx } from '../design/ui';

/* Small form helpers for the Builder. */
export function Field({ label, children, help, full }: { label: string; children: ReactNode; help?: string; full?: boolean }) {
  return <div className="field" style={full ? { gridColumn: '1 / -1' } : undefined}><span className="field-label">{label}</span>{children}{help && <span className="field-help">{help}</span>}</div>;
}

export function Text({ value, onChange, mono, placeholder, big, label }: { value?: string; onChange: (v: string) => void; mono?: boolean; placeholder?: string; big?: boolean; label?: string }) {
  return <input className={cx('input', big && 'input-lg')} style={{ ...(mono ? { fontFamily: 'var(--font-mono)' } : {}), ...(big ? { fontFamily: 'var(--font-serif)', fontSize: 24, height: 52 } : {}) }}
    value={value ?? ''} placeholder={placeholder} aria-label={label} onChange={e => onChange(e.target.value)} />;
}

export function Area({ value, onChange, mono, rows = 3, placeholder, label }: { value?: string; onChange: (v: string) => void; mono?: boolean; rows?: number; placeholder?: string; label?: string }) {
  return <textarea className="textarea" rows={rows} aria-label={label} style={mono ? { fontFamily: 'var(--font-mono)', fontSize: 13 } : undefined} value={value ?? ''} placeholder={placeholder} onChange={e => onChange(e.target.value)} />;
}

export function Num({ value, onChange, min, max, label }: { value?: number; onChange: (v: number) => void; min?: number; max?: number; label?: string }) {
  return <input className="input" type="number" aria-label={label} value={value ?? 0} min={min} max={max} onChange={e => onChange(Number(e.target.value))} />;
}

/** JSON editor with parse validation (for visual parameters the structured editors do not cover). */
export function JsonArea({ value, onChange, rows = 10, label }: { value: unknown; onChange: (v: unknown) => void; rows?: number; label: string }) {
  const [text, setText] = useState(() => JSON.stringify(value, null, 2));
  const [err, setErr] = useState('');
  useEffect(() => { setText(JSON.stringify(value, null, 2)); setErr(''); }, [JSON.stringify(value)]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      <textarea className={cx('textarea json-edit', err && 'is-invalid')} rows={rows} aria-label={label} spellCheck={false} value={text}
        onChange={e => { setText(e.target.value); try { onChange(JSON.parse(e.target.value)); setErr(''); } catch (x) { setErr((x as Error).message); } }} />
      {err && <span className="field-error"><Icon name="circle-alert" size={14} />JSON belum valid: {err}</span>}
    </>
  );
}

/** Editable list of strings. */
export function StringList({ items, onChange, mono, placeholder, addLabel = 'Tambah' }: { items: string[]; onChange: (v: string[]) => void; mono?: boolean; placeholder?: string; addLabel?: string }) {
  return (
    <div className="stack gap-2">
      {items.map((it, i) => (
        <div className="row gap-2" key={i}>
          <span className="t-mono t-xs t-faint" style={{ width: 18 }}>{i + 1}</span>
          <input className="input grow" style={mono ? { fontFamily: 'var(--font-mono)' } : undefined} value={it} placeholder={placeholder} onChange={e => onChange(items.map((x, j) => (j === i ? e.target.value : x)))} />
          <button className="btn btn-ghost btn-icon btn-sm" aria-label="Naik" disabled={i === 0} onClick={() => { const n = [...items]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; onChange(n); }}><Icon name="arrow-down-up" /></button>
          <button className="btn btn-ghost btn-icon btn-sm" aria-label="Hapus" onClick={() => onChange(items.filter((_, j) => j !== i))}><Icon name="x" /></button>
        </div>
      ))}
      <button className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => onChange([...items, ''])}><Icon name="plus" />{addLabel}</button>
    </div>
  );
}

export function ConceptChips({ all, value, onChange }: { all: { key: string; name: string }[]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="row gap-1 wrap">
      {all.map(c => <button key={c.key} className="chip" aria-pressed={value.includes(c.key)} onClick={() => onChange(value.includes(c.key) ? value.filter(x => x !== c.key) : [...value, c.key])}>{c.name}</button>)}
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { create } from 'zustand';
import { Icon } from './Icon';
import { Html } from '../lib/html';

export type ToastKind = 'accent' | 'success' | 'warning' | 'danger';
type Toast = { id: number; kind: ToastKind; icon: string; title: string; body?: string; ms: number };

const useToasts = create<{ items: Toast[]; push: (t: Omit<Toast, 'id' | 'ms'> & { ms?: number }) => void; remove: (id: number) => void }>(set => ({
  items: [],
  push: t => set(s => ({ items: [...s.items, { ms: 4200, ...t, id: Date.now() + Math.random() }] })),
  remove: id => set(s => ({ items: s.items.filter(x => x.id !== id) })),
}));

/** toast({ kind, icon, title, body }) — bottom-right stack, auto-dismiss after 4.2 s. */
export const toast = (t: { kind?: ToastKind; icon?: string; title: string; body?: string; ms?: number }) =>
  useToasts.getState().push({ kind: t.kind || 'accent', icon: t.icon || 'info', title: t.title, body: t.body, ms: t.ms });

function ToastItem({ t }: { t: Toast }) {
  const remove = useToasts(s => s.remove);
  const [leaving, setLeaving] = useState(false);
  const timer = useRef<number>(0);
  const kill = () => { setLeaving(true); window.setTimeout(() => remove(t.id), 160); };
  useEffect(() => { timer.current = window.setTimeout(kill, t.ms); return () => clearTimeout(timer.current); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className={`toast is-${t.kind}${leaving ? ' is-leaving' : ''}`} role="status">
      <Icon name={t.icon} className="toast-icon" />
      <div className="grow"><div className="t-medium">{t.title}</div>{t.body && <Html as="div" className="t-muted t-sm mt-1" html={t.body} />}</div>
      <button className="btn btn-ghost btn-icon btn-sm" aria-label="Tutup" onClick={kill}><Icon name="x" /></button>
    </div>
  );
}

export function ToastStack() {
  const items = useToasts(s => s.items);
  if (!items.length) return null;
  return <div className="toast-stack" aria-live="polite">{items.map(t => <ToastItem key={t.id} t={t} />)}</div>;
}

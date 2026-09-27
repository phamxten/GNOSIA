import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icon';
import { highlightLine } from '../lib/highlight';
import type { Person } from '../api/types';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

export function Avatar({ p, size, className, style }: { p: Pick<Person, 'initials' | 'avatar'> | null | undefined; size?: 'sm' | 'lg'; className?: string; style?: React.CSSProperties }) {
  if (!p) return null;
  return <span className={cx('avatar', size && `avatar-${size}`, p.avatar, className)} style={style}>{p.initials}</span>;
}

export function PhaseTag({ phase, children, locked, className }: { phase?: string; children: ReactNode; locked?: boolean; className?: string }) {
  return <span className={cx('phase-tag', locked && 'is-locked', className)} data-phase={phase}>{children}</span>;
}

export function Mastery({ tier, weak, large }: { tier: number; weak?: boolean; large?: boolean }) {
  return (
    <span className={cx('mastery', weak && 'is-weak', large && 'mastery-lg')} data-tier={tier} role="img" aria-label={`Penguasaan ${tier} dari 5`}>
      <i /><i /><i /><i /><i />
    </span>
  );
}

export function Attempts({ fails, total = fails }: { fails: number; total?: number }) {
  return <span className="attempts">{Array.from({ length: Math.max(total, fails) }, (_, i) => <i key={i} className={i < fails ? 'f' : ''} />)}</span>;
}

export function EmptyState({ icon, title, children, action }: { icon: string; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-glyph"><Icon name={icon} /></div>
      <div className="t-h4">{title}</div>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

/** STATES.md #4 — generic fetch error with retry, shown where the content was. */
export function LoadError({ onRetry, message }: { onRetry?: () => void; message?: string }) {
  return (
    <div className="callout callout-danger" role="alert">
      <Icon name="circle-alert" />
      <div className="grow t-sm">{message || 'Gagal memuat. Periksa koneksi, lalu coba lagi.'}</div>
      {onRetry && <button className="btn btn-secondary btn-sm" onClick={onRetry}>Coba lagi</button>}
    </div>
  );
}

export function Skel({ w, h, r, className, style }: { w?: number | string; h: number; r?: number; className?: string; style?: React.CSSProperties }) {
  return <div className={cx('skeleton', className)} style={{ width: w, height: h, borderRadius: r, ...style }} />;
}

/** Read-only code lines (.cc-line) with line numbers and optional lit/bad lines. */
export function CodeLines({ code, lit = [], bad, numbers = true }: { code: string; lit?: number[]; bad?: number | null; numbers?: boolean }) {
  return (
    <>
      {code.split('\n').map((l, i) => (
        <div key={i} className={cx('cc-line', lit.includes(i + 1) && 'is-lit', bad === i + 1 && 'is-bad')}>
          {numbers && <span className="cc-ln">{i + 1}</span>}
          <span dangerouslySetInnerHTML={{ __html: highlightLine(l) || ' ' }} />
        </div>
      ))}
    </>
  );
}

export function CodeCard({ code, file, lit, children, className, headRight }: { code: string; file?: string; lit?: number[]; children?: ReactNode; className?: string; headRight?: ReactNode }) {
  return (
    <div className={cx('codecard', className)}>
      {file && <div className="cc-head"><span className="cc-file"><span className="lang">JS</span>{file}</span>{headRight}</div>}
      <div className="cc-body"><CodeLines code={code} lit={lit} /></div>
      {children}
    </div>
  );
}

export function Modal({ open, onClose, title, children, foot, role = 'dialog', width }: {
  open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; foot?: ReactNode; role?: 'dialog' | 'alertdialog'; width?: number;
}) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <div>
      <div className="scrim" onClick={onClose} />
      <div className="modal" role={role} aria-modal="true" aria-label={typeof title === 'string' ? title : undefined} style={width ? { width } : undefined}>
        <div className="modal-head"><h3 className="t-h3">{title}</h3></div>
        <div className="modal-body">{children}</div>
        {foot && <div className="modal-foot">{foot}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return <label className="switch"><input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} aria-label={label} /></label>;
}

export function SaveState({ state, idle = 'Tersimpan', icon = 'cloud-check' }: { state: 'idle' | 'saving' | 'saved' | 'offline' | 'error'; idle?: string; icon?: string }) {
  if (state === 'saving') return <span className="save-state"><Icon name="loader-circle" size={14} className="spin" />Menyimpan…</span>;
  if (state === 'offline') return <span className="save-state" style={{ color: 'var(--kuis-ink)' }}><Icon name="wifi-off" size={14} />Tersimpan di perangkat ini</span>;
  if (state === 'error') return <span className="save-state" style={{ color: 'var(--danger)' }}><Icon name="circle-alert" size={14} />Gagal menyimpan</span>;
  return <span className="save-state"><Icon name={icon} size={14} />{idle}</span>;
}

/** Flame SVG used by streak chips (flickers in full motion). */
export function Flame({ size = 18 }: { size?: number }) {
  return (
    <svg className="flame" viewBox="0 0 24 24" aria-hidden="true" style={{ width: size, height: size }}>
      <path fill="currentColor" d="M12 2c1 3.5 5 6 5 11a5 5 0 0 1-10 0c0-2.2 1-3.6 2.2-4.8.3 1.5 1 2.5 2 3C11 8.5 11.5 5 12 2z" />
    </svg>
  );
}

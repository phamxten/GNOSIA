import { forwardRef, type ReactNode } from 'react';
import { Link } from 'react-router';
import type { PhaseId, PhaseMeta } from '../api/types';
import { Icon } from '../design/Icon';
import { Nosi, type Mood } from '../design/Nosi';
import { cx, Flame } from '../design/ui';

/** LessonPlayer frame: data-phase root, aura, top bar with PhaseBar, stage and a fixed footer (COMPONENTS §2). */
export function PlayerShell({ phase, children, className }: { phase: PhaseId | 'free'; children: ReactNode; className?: string }) {
  return (
    <div className={cx('player', className)} data-phase={phase}>
      <div className="aura" aria-hidden="true"><i /><i /></div>
      {children}
    </div>
  );
}

export const PhaseBar = ({ phases, current, labels = {}, progress }: {
  phases: PhaseMeta[]; current: PhaseId; labels?: Partial<Record<PhaseId, string>>; progress?: number;
}) => (
  <div className="phasebar" aria-label="Kemajuan bab">
    {phases.map((p, i) => {
      const isNow = p.id === current;
      const v = isNow && progress !== undefined ? progress : p.state === 'done' ? 1 : p.state === 'open' ? p.progress : 0;
      const icon = p.state === 'done' && !isNow ? 'check' : p.state === 'locked' ? 'lock' : p.icon;
      return (
        <div key={p.id} className={cx('seg', isNow && 'is-now', p.state === 'done' && !isNow && 'is-done')} data-phase={p.id}>
          <span className="lbl"><Icon name={icon} /><span>{i + 1} · {labels[p.id] || p.label}</span></span>
          <div className="trk"><span style={{ ['--v' as string]: `${Math.round(v * 100)}%` }} /></div>
        </div>
      );
    })}
  </div>
);

export function PlayerTop({ exitTo, center, right, xp, streak, mood, bump, xpRef }: {
  exitTo: string; center: ReactNode; right?: ReactNode; xp?: number; streak?: number; mood?: Mood; bump?: number;
  xpRef?: React.Ref<HTMLSpanElement>;
}) {
  return (
    <header className="player-top">
      <Link to={exitTo} className="btn btn-ghost btn-icon" aria-label="Keluar ke halaman bab"><Icon name="x" size={20} /></Link>
      {center}
      {right ?? (
        <div className="row gap-3 pt-right">
          {streak !== undefined && <span className="stat-chip"><Flame />{streak}</span>}
          {xp !== undefined && <span className="stat-chip"><Icon name="zap" style={{ color: 'var(--xp)' }} /><span ref={xpRef}>{xp}</span></span>}
          <Nosi size="sm" mood={mood} bump={bump} />
        </div>
      )}
    </header>
  );
}

export const PlayerFoot = forwardRef<HTMLElement, { state?: 'idle' | 'ok' | 'no'; children: ReactNode }>(({ state = 'idle', children }, ref) => (
  <footer className={cx('player-foot', state === 'ok' && 'is-ok', state === 'no' && 'is-no')} ref={ref}>
    <div className="inner">{children}</div>
  </footer>
));
PlayerFoot.displayName = 'PlayerFoot';

/** PhaseComplete / ChapterComplete overlay (COMPONENTS §2). */
export function DoneOverlay({ children, labelledBy, wide }: { children: ReactNode; labelledBy?: string; wide?: boolean }) {
  return (
    <div className="done" role="dialog" aria-modal="true" aria-labelledby={labelledBy}>
      <div className="done-card" style={wide ? { width: 'min(600px, 100%)' } : undefined}>{children}</div>
    </div>
  );
}

/** Gate tile: locked (coral) → open (sage, pop + burst). */
export function Gate({ open, title, text, gateRef, tag }: { open: boolean; title: string; text: string; gateRef?: React.Ref<HTMLDivElement>; tag?: ReactNode }) {
  return (
    <div className={cx('gate', open && 'is-open')} ref={gateRef} style={{ textAlign: 'left' }}>
      <span className="lock"><Icon name={open ? 'lock-open' : 'lock'} /></span>
      <div className="grow"><div className="t-h4">{title}</div><div className="t-xs t-faint">{text}</div></div>
      {tag}
    </div>
  );
}

import { Link } from 'react-router';
import type { PhaseMeta } from '../api/types';
import { cx } from '../design/ui';

/** Four phase cards (done / now / locked); open and done phases are links. */
export function PhaseSteps({ phases, current }: { phases: PhaseMeta[]; current?: string }) {
  return (
    <div className="phase-steps">
      {phases.map(p => {
        const now = p.state === 'open' && (current ? p.id === current : true);
        const cls = cx('pstep', p.state === 'done' && 'is-done', now && 'is-now', p.state === 'locked' && 'is-locked');
        const inner = (
          <>
            <span className="pnum">{p.meta}</span>
            <span className="pname">{p.label}</span>
            <span className="bar"><span style={{ ['--v' as string]: `${Math.round(p.progress * 100)}%` }} /></span>
          </>
        );
        return p.state === 'locked' || p.link.includes('#')
          ? <div key={p.id} className={cls} data-phase={p.id}>{inner}</div>
          : <Link key={p.id} className={cls} data-phase={p.id} to={p.link}>{inner}</Link>;
      })}
    </div>
  );
}

import { Icon } from '../design/Icon';
import { cx } from '../design/ui';
import { Html } from '../lib/html';

export type RobotState = 'idle' | 'queued' | 'running' | 'pass' | 'fail';
export type Robot = { id: string; name: string; state: RobotState; ms?: number; detail?: string; hidden?: boolean };

/** Test robots: queued → running → pass/fail, one by one (MOTION §3.6). */
export function TestRobots({ robots, onReport }: { robots: Robot[]; onReport?: (id: string) => void }) {
  const passed = robots.filter(r => r.state === 'pass').length;
  return (
    <div>
      <div className="row between mb-2"><span className="eyebrow">Robot penguji</span><span className="t-xs t-mono t-faint" aria-live="polite">{passed} / {robots.length}</span></div>
      <div className="robots">
        {robots.map(r => (
          <div key={r.id} className={cx('robot', r.state === 'running' && 'is-run', r.state === 'pass' && 'is-pass', r.state === 'fail' && 'is-fail')}>
            <span className="rb"><Icon name={r.state === 'running' ? 'loader-circle' : r.state === 'pass' ? 'check' : r.state === 'fail' ? 'x' : 'bot'} /></span>
            <Html html={r.name} />
            <span className="rmeta">
              {r.state === 'idle' ? 'menunggu' : r.state === 'queued' ? 'antre' : r.state === 'running' ? 'mengecek…' : r.state === 'pass' ? `${r.ms ?? 1} ms` : 'gagal'}
              {r.state === 'fail' && onReport && <button className="link report" onClick={() => onReport(r.id)}>laporkan</button>}
            </span>
            {r.state === 'fail' && r.detail && <span className="rdiff">{r.detail}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

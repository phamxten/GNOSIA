import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { useApi } from '../api/hooks';
import type { MentorNote, ReviewCard } from '../api/types';
import { Icon } from '../design/Icon';
import { Avatar, cx, EmptyState, LoadError, Mastery, Skel } from '../design/ui';
import { ease, motion, ticker } from '../fx';
import { Html } from '../lib/html';

type Star = { key: string; name: string; x: number; y: number; mastery: number; state: 'on' | 'weak' | 'off'; tier: number };
type Data = {
  kpis: { mastery: number; mastery_delta: number; chapters_done: number; chapters_total: number; current_text: string; accuracy: number; xp: number; streak: number };
  path: { slug: string; title: string }; stars: Star[]; edges: [string, string][]; trend: { week: string; pct: number }[];
  review: ReviewCard[]; mentor: MentorNote;
  table: { id: number; title: string; active: boolean; cells: { text: string; on: boolean }[]; tier: number }[];
};

/* from mockups/progress.html */
const css = `
.kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
.kpi { padding: 20px; border-radius: 20px; background: var(--surface); border: 1px solid var(--border); }
.kpi .stat-value { font-size: 42px; }
.const-wrap { position: relative; margin-top: 16px; }
.star-tip { position: absolute; z-index: 5; pointer-events: none; transform: translate(-50%, calc(-100% - 16px)); padding: 10px 12px; border-radius: 12px; background: var(--surface-raised); border: 1px solid var(--border); box-shadow: var(--shadow-pop); font-size: 12px; white-space: nowrap; }
.prog-two { display: grid; grid-template-columns: 1.3fr 1fr; gap: 16px; margin-top: 16px; }
.chart { width: 100%; height: 220px; }
.chart .grid-l { stroke: var(--divider); }
.chart .ln { fill: none; stroke: var(--pahami-fill); stroke-width: 2.5; stroke-linecap: round; }
.chart .ar { fill: var(--pahami-soft); opacity: .7; }
.chart text { font-family: var(--font-mono); font-size: 10px; fill: var(--text-faint); }
.ph-cell { display: inline-flex; align-items: center; justify-content: center; min-width: 52px; height: 26px; padding: 0 8px; border-radius: 8px; font-family: var(--font-mono); font-size: 12px; font-weight: 600; background: var(--ph-soft); color: var(--ph-ink); }
.ph-cell.is-none { background: var(--surface-sunken); color: var(--text-faint); font-weight: 400; }
@media (max-width: 1000px) { .kpis { grid-template-columns: 1fr 1fr; } .prog-two { grid-template-columns: 1fr; } .tbl-wrap { overflow-x: auto; } }
`;

function Constellation({ stars, edges }: { stars: Star[]; edges: [string, string][] }) {
  const svg = useRef<SVGSVGElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<{ s: Star; left: number; top: number } | null>(null);
  const by = Object.fromEntries(stars.map(s => [s.key, s]));
  const col = (s: Star) => (s.state === 'off' ? 'var(--border-strong)' : s.state === 'weak' ? 'var(--kuis-fill)' : 'var(--pahami-fill)');
  useEffect(() => {
    if (motion() === 'off' || !svg.current) return;
    svg.current.querySelectorAll<SVGGElement>('.star').forEach((g, i) => g.animate([{ opacity: 0, transform: 'scale(.3)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 600, delay: 200 + i * 80, easing: ease.bouncy, fill: 'backwards' }));
    svg.current.querySelectorAll<SVGLineElement>('.edge').forEach((l, i) => {
      const len = Math.hypot(l.x2.baseVal.value - l.x1.baseVal.value, l.y2.baseVal.value - l.y1.baseVal.value);
      l.style.strokeDasharray = String(len);
      l.animate([{ strokeDashoffset: len }, { strokeDashoffset: 0 }], { duration: 800, delay: 400 + i * 60, easing: ease.out, fill: 'both' });
    });
  }, []);
  return (
    <div className="const-wrap" ref={wrap}>
      <div className="constellation">
        <svg viewBox="0 0 1000 480" ref={svg} role="img" aria-label="Konstelasi konsep" onPointerLeave={() => setTip(null)}>
          {edges.filter(([a, b]) => by[a] && by[b]).map(([a, b]) => (
            <line key={a + b} className={cx('edge', by[a].state !== 'off' && by[b].state !== 'off' && 'is-lit')} x1={by[a].x} y1={by[a].y} x2={by[b].x} y2={by[b].y} />
          ))}
          {stars.map((s, i) => {
            const r = 6 + s.mastery * 10, c = col(s);
            return (
              <g className="star" key={s.key} tabIndex={0} aria-label={`${s.name}: ${s.state === 'off' ? 'belum dibuka' : `${Math.round(s.mastery * 100)}% dikuasai`}${s.state === 'weak' ? ', perlu diulang' : ''}`}
                onPointerEnter={() => { const rc = wrap.current!.getBoundingClientRect(); setTip({ s, left: (s.x / 1000) * rc.width, top: (s.y / 480) * rc.height }); }}
                onFocus={() => { const rc = wrap.current!.getBoundingClientRect(); setTip({ s, left: (s.x / 1000) * rc.width, top: (s.y / 480) * rc.height }); }}
                onBlur={() => setTip(null)}>
                {s.state !== 'off' && <circle className="star-glow" cx={s.x} cy={s.y} r={r + 10} fill={c} opacity=".18" style={{ animationDelay: `${i * 0.3}s` }} />}
                <circle cx={s.x} cy={s.y} r={r} fill={s.state === 'off' ? 'var(--surface)' : c} stroke={c} strokeWidth="2" strokeDasharray={s.state === 'off' ? '3 3' : undefined} />
                <text x={s.x} y={s.y + r + 18} textAnchor="middle">{s.name}</text>
              </g>
            );
          })}
        </svg>
      </div>
      {tip && (
        <div className="star-tip" style={{ left: tip.left, top: tip.top }}>
          <b>{tip.s.name}</b> · {tip.s.state === 'off' ? 'belum dibuka' : `${Math.round(tip.s.mastery * 100)}% dikuasai`}
          {tip.s.state === 'weak' && <><br /><span style={{ color: 'var(--kuis-ink)' }}>perlu diulang</span></>}
        </div>
      )}
    </div>
  );
}

function Trend({ v }: { v: number[] }) {
  const ln = useRef<SVGPathElement>(null);
  const W = 600, H = 220, pad = 24;
  const x = (i: number) => pad + i * (W - pad * 2) / Math.max(1, v.length - 1), y = (n: number) => H - pad - n / 100 * (H - pad * 2);
  const d = v.map((n, i) => `${i ? 'L' : 'M'}${x(i)} ${y(n)}`).join(' ');
  useEffect(() => {
    const p = ln.current;
    if (!p) return;
    const L = p.getTotalLength();
    p.style.strokeDasharray = String(L);
    if (motion() !== 'off') p.animate([{ strokeDashoffset: L }, { strokeDashoffset: 0 }], { duration: 1400, easing: ease.gentle });
  }, [d]);
  return (
    <svg className="chart mt-4" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={`Tren penguasaan 8 minggu: ${v.join(', ')} persen`}>
      {[0, 25, 50, 75, 100].map(g => <g key={g}><line className="grid-l" x1={pad} x2={W - pad} y1={y(g)} y2={y(g)} /><text x="0" y={y(g) + 3}>{g}</text></g>)}
      <path className="ar" d={`${d} L${x(v.length - 1)} ${H - pad} L${pad} ${H - pad}Z`} />
      <path className="ln" d={d} ref={ln} />
      {v.map((n, i) => <circle key={i} cx={x(i)} cy={y(n)} r={i === v.length - 1 ? 6 : 3.5} fill="var(--surface)" stroke="var(--pahami-fill)" strokeWidth="2.5" />)}
    </svg>
  );
}

function Tick({ to, className, style }: { to: number; className?: string; style?: React.CSSProperties }) {
  const r = useRef<HTMLSpanElement>(null);
  useEffect(() => { ticker(r.current, to, { from: 0, dur: 1200 }); }, [to]);
  return <span ref={r} className={className} style={style}>0</span>;
}

export default function Progres() {
  const q = useApi<Data>('/api/progress');
  const loc = useLocation();
  useEffect(() => { if (loc.hash === '#feedback' && q.data) document.getElementById('feedback')?.scrollIntoView({ behavior: 'smooth' }); }, [loc.hash, q.data]);
  if (q.error) return <main className="page"><LoadError onRetry={() => q.refetch()} /></main>;
  if (!q.data) return <main className="page" aria-busy="true"><style>{css}</style><Skel h={44} w={380} /><div className="kpis mt-8">{[0, 1, 2, 3].map(i => <Skel key={i} h={120} r={20} />)}</div><Skel h={420} r={20} className="mt-6" /></main>;
  const d = q.data, k = d.kpis;
  return (
    <main className="page">
      <style>{css}</style>
      <div className="page-head"><div><div className="eyebrow">Progres &amp; penguasaan</div><h1 className="big-serif mt-2" style={{ fontSize: 44 }}>Langit <em>pengetahuanmu</em>.</h1><p className="t-muted mt-2">Setiap bintang adalah satu konsep. Makin kamu kuasai, makin terang bintangnya.</p></div></div>
      <div className="kpis">
        <div className="kpi rise"><span className="eyebrow">Penguasaan rata-rata</span><div className="stat-value mt-2"><Tick to={k.mastery} /><small>%</small></div>
          <div className={cx('t-xs mt-1', k.mastery_delta > 0 ? 't-success' : 't-faint')}>{k.mastery_delta > 0 ? `▲ ${k.mastery_delta} minggu ini` : k.mastery_delta < 0 ? `▼ ${-k.mastery_delta} minggu ini` : 'stabil minggu ini'}</div></div>
        <div className="kpi rise d1"><span className="eyebrow">Bab selesai</span><div className="stat-value mt-2"><Tick to={k.chapters_done} /><small>/ {k.chapters_total}</small></div><div className="t-xs t-faint mt-1">{k.current_text}</div></div>
        <div className="kpi rise d2"><span className="eyebrow">Akurasi Perkuat</span><div className="stat-value mt-2"><Tick to={k.accuracy} /><small>%</small></div><div className="t-xs t-faint mt-1">benar di percobaan pertama</div></div>
        <div className="kpi rise d3"><span className="eyebrow">Total XP</span><div className="stat-value mt-2" style={{ color: 'var(--xp)' }}><Tick to={k.xp} /></div><div className="t-xs t-faint mt-1">{k.streak ? `streak ${k.streak} hari` : 'mulai streak hari ini'}</div></div>
      </div>

      <section className="card card-pad mt-6">
        <div className="row between"><h2 className="t-h3">Konstelasi · {d.path.title}</h2>
          <div className="row gap-4 t-xs t-muted hide-sm"><span className="row gap-1"><span className="dot" style={{ background: 'var(--pahami-fill)' }} />dikuasai</span><span className="row gap-1"><span className="dot" style={{ background: 'var(--kuis-fill)' }} />perlu diulang</span><span className="row gap-1"><span className="dot" style={{ background: 'var(--border-strong)' }} />belum dibuka</span></div></div>
        <Constellation stars={d.stars} edges={d.edges} />
      </section>

      <div className="prog-two">
        <section className="card card-pad"><div className="row between"><h2 className="t-h3">Tren penguasaan</h2><span className="t-xs t-faint">8 minggu</span></div><Trend v={d.trend.map(t => t.pct)} /></section>
        <section className="card card-pad" id="feedback">
          <div className="row between"><h2 className="t-h3">Perlu diulang</h2>{d.review.length > 0 && <span className="badge badge-warning">{d.review.length}</span>}</div>
          {d.review.length ? (
            <div className="list mt-2">
              {d.review.map(r => (
                <Link className="list-row is-clickable" to={r.action.href} style={{ padding: '12px 0' }} key={r.concept}>
                  <Mastery tier={r.tier} weak /><div className="grow"><div className="t-sm t-medium">{r.name}</div><div className="meta">{r.source} · Bab {r.chapter}</div></div><Icon name="chevron-right" size={14} className="t-faint" />
                </Link>
              ))}
            </div>
          ) : <EmptyState icon="sparkles" title="Tidak ada yang perlu diulang">Konsep yang salah di Perkuat, Kuis, atau Uji akan muncul di sini.</EmptyState>}
          <div className="eyebrow mt-6 mb-2">Feedback mentor terakhir</div>
          {d.mentor ? <div className="row-top gap-3"><Avatar p={d.mentor.mentor} size="sm" /><div><p className="t-sm" style={{ lineHeight: 1.55, margin: 0 }}>“{d.mentor.body}”</p><div className="t-xs t-faint mt-1">{d.mentor.mentor.name} · {d.mentor.ago}</div></div></div>
            : <p className="t-sm t-faint">Belum ada feedback.</p>}
        </section>
      </div>

      <section className="card mt-6 tbl-wrap" style={{ overflow: 'hidden' }}>
        <div className="p-5 row between"><h2 className="t-h3">Per bab, per fase</h2><span className="t-xs t-faint">skor terakhir</span></div>
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead><tr><th>Bab</th><th>Pahami</th><th>Perkuat</th><th>Kuis</th><th>Uji</th><th>Penguasaan</th></tr></thead>
            <tbody>
              {d.table.map(r => (
                <tr key={r.id}>
                  <td className={r.active ? 't-medium' : 't-muted'}>{r.active ? <Link to={`/bab/${r.id}`}>{r.title}</Link> : r.title}</td>
                  {r.cells.map((c, i) => <td key={i}><span className={cx('ph-cell', !c.on && 'is-none')} data-phase={['pahami', 'perkuat', 'kuis', 'uji'][i]}><Html html={c.text} /></span></td>)}
                  <td><Mastery tier={r.tier} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

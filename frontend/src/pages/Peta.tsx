import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { useApi } from '../api/hooks';
import type { MapData, MapNode } from '../api/types';
import { Icon } from '../design/Icon';
import { PhaseRing } from '../design/PhaseRing';
import { toast } from '../design/toast';
import { LoadError, Skel } from '../design/ui';
import { ease, motion, shake } from '../fx';

const STEP = 170, TOP = 110;

/* from mockups/peta.html */
const css = `
.map-layout { display: grid; grid-template-columns: minmax(0, 1fr) 300px; gap: 40px; }
.map-wrap { position: relative; border-radius: 28px; border: 1px solid var(--border); background: var(--surface); overflow: hidden; }
.map-wrap::before { content: ""; position: absolute; inset: 0; background-image: radial-gradient(var(--border) 1px, transparent 1px); background-size: 22px 22px; opacity: .7; }
.mod-label { position: absolute; left: 24px; transform: translateY(-50%); font-family: var(--font-mono); font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: var(--text-faint); display: flex; align-items: center; gap: 10px; }
.mod-label::after { content: ""; width: 60px; height: 1px; background: var(--border-strong); }
.pop { position: absolute; z-index: 5; width: 300px; transform: translate(-50%, 16px); background: var(--surface-raised); border: 1px solid var(--border); border-radius: 20px; box-shadow: var(--shadow-modal); padding: 18px; animation: rise 360ms var(--spring-bouncy) both; text-align: left; }
.pop .phase-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-top: 12px; }
.pop .phase-row span { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 8px 4px; border-radius: 12px; font-size: 11px; background: var(--surface-sunken); color: var(--text-faint); }
.pop .phase-row span.ok { background: var(--ph-soft); color: var(--ph-ink); }
.course-pick { display: grid; gap: 8px; }
.course-pick a { display: flex; align-items: center; gap: 12px; padding: 12px; border-radius: 14px; border: 1px solid var(--border); background: var(--surface); }
.course-pick a[aria-current] { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }
.map-side { position: sticky; top: 88px; align-self: start; display: flex; flex-direction: column; gap: 28px; }
.mnode { background: none; border: 0; cursor: pointer; }
.mnode.is-soon { opacity: .7; } .mnode.is-soon .disc { border-style: dashed; }
@media (max-width: 1000px) { .map-layout { grid-template-columns: 1fr; } .map-side { position: static; order: -1; } .mnode { width: 140px; } .mnode .disc { width: 80px; height: 80px; } .mnode .disc .icon { width: 46px; height: 46px; } .mod-label { display: none; } }
`;

function routePath(pts: number[][]) {
  return pts.map((p, i) => {
    if (!i) return `M${p[0]} ${p[1]}`;
    const p0 = pts[i - 2] || pts[i - 1], p1 = pts[i - 1], p3 = pts[i + 1] || p;
    const c1 = [p1[0] + (p[0] - p0[0]) / 6, p1[1] + (p[1] - p0[1]) / 6], c2 = [p[0] - (p3[0] - p1[0]) / 6, p[1] - (p3[1] - p1[1]) / 6];
    return `C${c1} ${c2} ${p}`;
  }).join(' ');
}

export default function Peta() {
  const { pathId = 'js-dasar' } = useParams();
  const q = useApi<MapData>(`/api/paths/${pathId}/map`);
  const mapRef = useRef<HTMLDivElement>(null);
  const doneRef = useRef<SVGPathElement>(null);
  const [W, setW] = useState(0);
  const [pop, setPop] = useState<number | null>(null);
  const small = typeof window !== 'undefined' && innerWidth < 1000;
  useLayoutEffect(() => {
    const el = mapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    setW(el.clientWidth);
    return () => ro.disconnect();
  }, [q.data]);
  const nodes = q.data?.nodes || [];
  const pts = nodes.map((n, i) => [(n.x / 100) * W, TOP + i * STEP]);
  const H = TOP + Math.max(0, nodes.length - 1) * STEP + 150;
  const reachIdx = Math.max(-1, ...nodes.map((n, i) => (n.state === 'done' || n.state === 'now' ? i : -1)));
  useEffect(() => {
    const pd = doneRef.current;
    if (!pd || !W || reachIdx < 1) return;
    const total = pd.getTotalLength();
    let upto = 0;
    for (let s = 0; s <= total; s += 4) { if (pd.getPointAtLength(s).y >= pts[reachIdx][1] - 2) { upto = s; break; } }
    pd.style.strokeDasharray = `${upto} ${total}`;
    if (motion() !== 'off') pd.animate([{ strokeDasharray: `0 ${total}` }, { strokeDasharray: `${upto} ${total}` }], { duration: 1400, delay: 300, easing: ease.gentle });
  }, [W, reachIdx]); // eslint-disable-line react-hooks/exhaustive-deps

  if (q.error) return <main className="page"><LoadError onRetry={() => q.refetch()} /></main>;
  const d = q.data;
  const learn = nodes.filter(n => n.kind === 'chapter');
  const ring = [0, 1, 2, 3].map(i => (learn.length ? learn.reduce((a, n) => a + (n.ring[i] || 0), 0) / learn.length : 0));
  const cur = nodes.find(n => n.state === 'now');
  const curPhase = cur ? cur.phases.find(p => p.value < 1) : null;

  const click = (n: MapNode, i: number, el: HTMLElement) => {
    if (n.state === 'locked' || n.state === 'soon') {
      shake(el);
      toast({ kind: 'accent', icon: 'lock', title: n.state === 'soon' ? `${n.kind === 'chapter' ? `Bab ${n.number}` : n.title} segera hadir` : `${n.kind === 'chapter' ? `Bab ${n.number}` : n.title} masih terkunci`, body: n.lock_message });
      return;
    }
    setPop(p => (p === i ? null : i));
  };

  return (
    <main className="page" style={{ maxWidth: 1280 }}>
      <style>{css}</style>
      <div className="page-head">
        <div><div className="eyebrow">Peta belajar</div>
          <h1 className="big-serif mt-2" style={{ fontSize: 44 }}>{d ? <>{d.path.title.split(' ').slice(0, -1).join(' ')} <em>{d.path.title.split(' ').slice(-1)}</em></> : 'Memuat…'}</h1>
          <p className="t-muted mt-2">{learn.length || '…'} bab · setiap bab: Pahami → Perkuat → Kuis → Uji. Bab berikutnya terbuka setelah Uji lulus.</p></div>
      </div>
      <div className="map-layout">
        <div className="map-wrap">
          <div className="map" ref={mapRef} style={{ height: d ? H : 900 }} onClick={e => { if (!(e.target as Element).closest('.mnode,.pop')) setPop(null); }}>
            {!d && <div className="stack gap-6" style={{ padding: 60, alignItems: 'center' }}>{[0, 1, 2, 3].map(i => <Skel key={i} h={96} w={96} r={48} />)}</div>}
            {d && W > 0 && (
              <svg className="route" viewBox={`0 0 ${W} ${H}`}>
                <path className="path-bg" d={routePath(pts)} />
                <path className="path-done" d={routePath(pts)} ref={doneRef} style={{ strokeDasharray: `0 ${99999}` }} />
              </svg>
            )}
            {d && W > 0 && nodes.map((n, i) => (
              <div key={n.id}>
                {n.module && <div className="mod-label" style={{ top: pts[i][1] - 70 }}>{n.module}</div>}
                <button className={`mnode${n.state === 'open' ? '' : ` is-${n.state}`}`} style={{ left: pts[i][0], top: pts[i][1], animation: motion() === 'off' ? undefined : `rise 600ms ${ease.bouncy} ${100 + i * 70}ms both` }}
                  aria-label={`${n.kind === 'chapter' ? `Bab ${n.number}. ` : ''}${n.title}, ${n.state === 'done' ? 'selesai' : n.state === 'now' ? 'sedang dipelajari' : n.state === 'locked' ? 'terkunci' : n.state === 'soon' ? 'segera hadir' : 'terbuka'}`}
                  onClick={e => click(n, i, e.currentTarget)}>
                  {n.state === 'now' && <span className="here">Kamu di sini</span>}
                  <span className="disc">
                    <PhaseRing values={n.ring} size={small ? 80 : 96} stroke={6} />
                    <span className="icon"><Icon name={n.state === 'locked' ? 'lock' : n.icon} /></span>
                  </span>
                  <span className="name">{n.kind === 'chapter' ? `${n.number}. ` : ''}{n.title}</span>
                  <span className="sub">{n.state === 'soon' ? 'segera hadir' : n.subtitle}</span>
                </button>
                {pop === i && (
                  <div className="pop" style={{ left: pts[i][0], top: pts[i][1] + 70 }} role="dialog" aria-label={n.title}>
                    <div className="row between"><span className="t-h4">{n.kind === 'chapter' ? `${n.number}. ` : ''}{n.title}</span><button className="btn btn-ghost btn-icon btn-sm" aria-label="Tutup" onClick={() => setPop(null)}><Icon name="x" /></button></div>
                    <div className="t-xs t-faint mt-1">{n.subtitle}</div>
                    {n.kind === 'chapter' && (
                      <div className="phase-row">{n.phases.map(p => (
                        <span key={p.id} data-phase={p.id} className={p.value >= 1 ? 'ok' : ''}><Icon name={p.value >= 1 ? 'check' : p.value > 0 ? 'loader' : 'circle'} size={14} />{p.label}</span>
                      ))}</div>
                    )}
                    <Link className="btn btn-primary btn-lg btn-press w-full mt-4" to={n.href}>{n.kind === 'project' ? 'Buka proyek' : n.state === 'done' ? 'Ulas bab' : 'Masuk bab'}<Icon name="arrow-right" /></Link>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
        <aside className="map-side">
          <section>
            <div className="eyebrow mb-2">Kemajuan jalur</div>
            <div className="row gap-4">
              <PhaseRing values={ring} size={92} stroke={8}><b className="big-serif" style={{ fontSize: 24 }}>{d?.summary.pct ?? 0}%</b></PhaseRing>
              <div className="t-sm t-muted">{d?.summary.chapters_done ?? 0} dari {d?.summary.chapters_total ?? 0} bab selesai.<br />
                {cur && curPhase ? <>Bab {cur.number} sedang di <b style={{ color: `var(--${curPhase.id}-ink)` }}>{curPhase.label}</b>.</> : 'Belum ada bab yang sedang dipelajari.'}</div>
            </div>
          </section>
          <section>
            <div className="eyebrow mb-2">Jalur</div>
            <div className="course-pick">
              {d && <Link aria-current="true" to={`/peta/${d.path.slug}`}><span className="badge badge-mono">JS</span><div className="grow t-sm t-medium">{d.path.title}</div><Icon name="check" size={14} className="t-accent" /></Link>}
              {d?.other_paths.map(p => <Link key={p.slug} to={`/peta/${p.slug}`}><span className="badge badge-mono">{p.title.slice(0, 2).toUpperCase()}</span><div className="grow t-sm">{p.title}</div></Link>)}
              {d && !d.other_paths.length && <p className="t-xs t-faint">Jalur lain (TypeScript, Python) sedang disiapkan.</p>}
            </div>
          </section>
          <section>
            <div className="eyebrow mb-2">Cara membaca cincin</div>
            <div className="stack gap-2 t-sm">
              {(['pahami', 'perkuat', 'kuis', 'uji'] as const).map(p => <div className="row gap-2" key={p}><span className="dot" style={{ background: `var(--${p}-fill)` }} />{p[0].toUpperCase() + p.slice(1)}</div>)}
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}

import { useEffect } from 'react';
import { Link, useLocation, useParams } from 'react-router';
import { useApi } from '../api/hooks';
import type { ChapterOverview, PhaseMeta } from '../api/types';
import { Icon } from '../design/Icon';
import { Nosi } from '../design/Nosi';
import { PhaseRing } from '../design/PhaseRing';
import { toast } from '../design/toast';
import { cx, LoadError, Mastery, PhaseTag, Skel } from '../design/ui';
import { Html } from '../lib/html';
import { highlightLine } from '../lib/highlight';
import { useLockRedirect } from '../lib/hooks';
import { shake } from '../fx';
import { ApiError } from '../api/client';

/* from mockups/bab.html */
const css = `
.bab-hero { display: grid; grid-template-columns: minmax(0, 1fr) 240px; gap: 40px; align-items: center; }
.journey { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-top: 36px; position: relative; }
.jcard { position: relative; display: flex; flex-direction: column; gap: 12px; padding: 22px; border-radius: 22px; border: 1px solid var(--border); background: var(--surface); min-height: 280px; transition: transform var(--dur-320) var(--spring-gentle), box-shadow var(--dur-200); }
.jcard .jnum { width: 40px; height: 40px; border-radius: 12px; display: grid; place-items: center; background: var(--ph-soft); color: var(--ph-ink); }
.jcard h3 { font-family: var(--font-serif); font-weight: 400; font-size: 28px; margin: 0; }
.jcard ul { margin: 0; padding: 0; list-style: none; display: grid; gap: 6px; font-size: 13px; color: var(--text-muted); }
.jcard ul li { display: flex; gap: 8px; align-items: center; }
.jcard .jfoot { margin-top: auto; }
.jcard.is-done { background: var(--ph-soft); border-color: var(--ph-line); }
.jcard.is-now { border-color: var(--ph-fill); box-shadow: 0 0 0 4px var(--ph-soft), 0 20px 40px -24px rgba(31,30,27,.3); transform: translateY(-4px); }
.jcard.is-locked { background: transparent; border-style: dashed; cursor: not-allowed; }
.jcard.is-locked h3, .jcard.is-locked .jnum { color: var(--text-faint); } .jcard.is-locked .jnum { background: var(--surface-sunken); }
.skills { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
.skill { display: flex; gap: 10px; align-items: center; padding: 12px 14px; border-radius: 14px; background: var(--surface); border: 1px solid var(--border); font-size: 14px; }
.cheat { border-radius: 20px; border: 1px solid var(--pahami-line); background: var(--pahami-soft); padding: 22px; }
.cheat pre { margin: 12px 0 0; padding: 14px 16px; border-radius: 12px; background: var(--editor-bg); border: 1px solid var(--border); font-family: var(--font-mono); font-size: 13px; line-height: 1.7; overflow-x: auto; }
.uji-choice { display: grid; gap: 8px; }
@media (max-width: 1000px) { .bab-hero { grid-template-columns: 1fr; } .journey { grid-template-columns: 1fr 1fr; } .skills { grid-template-columns: 1fr; } }
@media (max-width: 600px) { .journey { grid-template-columns: 1fr; } .jcard { min-height: 0; } }
`;

export default function Bab() {
  const { id } = useParams();
  const loc = useLocation();
  const q = useApi<ChapterOverview>(`/api/chapters/${id}`);
  useLockRedirect(q.error);
  useEffect(() => { if (loc.hash === '#uji' && q.data) document.getElementById('uji')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, [loc.hash, q.data]);
  if (q.error instanceof ApiError && q.error.status === 409) return null;
  if (q.error) return <main className="page"><LoadError onRetry={() => q.refetch()} /></main>;
  if (!q.data) return (
    <main className="page" aria-busy="true"><style>{css}</style>
      <Skel h={14} w={200} /><div className="bab-hero mt-4"><div><Skel h={56} w={260} /><Skel h={60} className="mt-4" /></div><Skel h={220} w={220} r={110} /></div>
      <div className="journey">{[0, 1, 2, 3].map(i => <Skel key={i} h={280} r={22} />)}</div>
    </main>
  );
  const d = q.data;
  const f = d.facts;
  const ph = Object.fromEntries(d.phases.map(p => [p.id, p])) as Record<string, PhaseMeta>;
  const cardCls = (p: PhaseMeta) => cx('jcard', p.state === 'done' && 'is-done', p.state === 'open' && !d.completed && p.id === d.current && 'is-now', p.state === 'locked' && 'is-locked');
  const badge = (p: PhaseMeta, lockedLabel: string) =>
    p.state === 'done' ? <span className="badge badge-success"><Icon name="check" />{p.id === 'kuis' && p.score != null ? `Lulus ${Math.round(p.score)}%` : 'Selesai'}</span>
      : p.state === 'open' ? <PhaseTag>{p.id === d.current ? 'Sekarang' : 'Terbuka'}</PhaseTag>
        : <span className="t-xs t-faint">{lockedLabel}</span>;
  const lockedClick = (e: React.MouseEvent, label: string) => {
    shake(e.currentTarget);
    toast({ kind: 'accent', icon: 'lock', title: `Selesaikan ${label} dulu`, body: 'Fase terbuka satu per satu, tidak ada yang dilompati.' });
  };
  const bar = (p: PhaseMeta, text: string) => (
    <div className="jfoot"><div className="pstep" style={{ padding: 0, border: 0, background: 'none' }}><span className="bar"><span style={{ ['--v' as string]: `${Math.round(p.progress * 100)}%` }} /></span></div><div className="t-xs t-mono t-faint mt-2">{text}</div></div>
  );
  const copy = async () => {
    try { await navigator.clipboard.writeText(d.cheatsheet || ''); toast({ kind: 'success', icon: 'copy', title: 'Catatan disalin' }); }
    catch { toast({ kind: 'danger', icon: 'circle-alert', title: 'Gagal menyalin' }); }
  };
  const left = d.eta.left;

  return (
    <main className="page">
      <style>{css}</style>
      <div className="crumbs t-sm t-muted mb-4"><Link to={`/peta/${d.path.slug}`} className="link" style={{ fontWeight: 500 }}>Peta · {d.path.title}</Link> <span className="t-faint">/</span> Bab {d.position.number}</div>
      <section className="bab-hero">
        <div>
          <div className="eyebrow">Bab {d.position.number} dari {d.position.total}{d.chapter.module ? ` · Modul ${d.chapter.module}` : ''}</div>
          <h1 className="big-serif mt-2" style={{ fontSize: 56 }}>{d.chapter.title}</h1>
          <Html as="p" className="t-lg t-muted mt-3" style={{ maxWidth: '56ch', lineHeight: 1.6 }} html={d.chapter.description} />
          <div className="row gap-3 mt-6 wrap">
            <Link className="btn btn-phase btn-xl btn-press" data-phase={d.primary.phase} to={d.primary.href}>{d.completed ? 'Ulas Pahami' : d.primary.label}<Icon name="arrow-right" /></Link>
            <span className="t-sm t-faint">{d.completed ? `Bab selesai · ±${d.eta.total} menit total` : `±${d.eta.total} menit total · sisa ±${left} menit`}</span>
          </div>
        </div>
        <div className="t-center"><PhaseRing values={d.ring} size={220} stroke={14}><Nosi size="lg" mood={d.completed ? 'cheer' : 'happy'} style={{ width: 110, height: 110 }} /></PhaseRing></div>
      </section>

      <section className="journey" aria-label="Empat fase bab ini">
        {(() => { const p = ph.pahami; const body = (<>
          <div className="row between"><span className="jnum"><Icon name={p.state === 'locked' ? 'lock' : 'book-open'} /></span>{badge(p, '')}</div>
          <h3>Pahami</h3>
          <ul><li><Icon name="clapperboard" size={14} />{f.scenes} scene beranimasi</li>{f.live > 0 && <li><Icon name="code-xml" size={14} />{f.live} kode hidup</li>}<li><Icon name="clock" size={14} />{f.pahami_minutes} menit</li></ul>
          {p.state === 'done' ? <span className="jfoot link t-sm">Ulas kembali →</span> : bar(p, p.short)}
        </>); return <Link className={cardCls(p)} data-phase="pahami" to={p.link} data-tilt>{body}</Link>; })()}
        {(() => { const p = ph.perkuat; const body = (<>
          <div className="row between"><span className="jnum"><Icon name={p.state === 'locked' ? 'lock' : 'dumbbell'} /></span>{badge(p, 'setelah Pahami')}</div>
          <h3>Perkuat</h3>
          <ul><li><Icon name="list-checks" size={14} />{f.items} latihan, {f.types} tipe</li><li><Icon name="repeat" size={14} />adaptif, soal serupa jika salah</li><li><Icon name="lightbulb" size={14} />petunjuk bertingkat</li></ul>
          {p.state === 'open' ? bar(p, `${p.short.replace(' soal', '')} selesai`) : p.state === 'done' ? <span className="jfoot link t-sm">Latihan lagi →</span> : null}
        </>); return p.state === 'locked'
          ? <div className={cardCls(p)} data-phase="perkuat" onClick={e => lockedClick(e, 'Pahami')} role="button" aria-disabled="true">{body}</div>
          : <Link className={cardCls(p)} data-phase="perkuat" to={p.link} data-tilt>{body}</Link>; })()}
        {(() => { const p = ph.kuis; const body = (<>
          <div className="row between"><span className="jnum"><Icon name={p.state === 'locked' ? 'lock' : 'zap'} /></span>{badge(p, 'setelah Perkuat')}</div>
          <h3>Kuis</h3>
          <ul><li><Icon name="zap" size={14} />{f.round} soal trivia</li><li><Icon name="timer" size={14} />{f.seconds} detik per soal</li><li><Icon name="flag" size={14} />lulus ≥ {f.pass_pct}% untuk membuka Uji</li></ul>
          {p.state === 'open' && p.score != null && bar(p, `terbaik ${Math.round(p.score)}% · butuh ${f.pass_pct}%`)}
        </>); return p.state === 'locked'
          ? <div className={cardCls(p)} data-phase="kuis" onClick={e => lockedClick(e, 'Perkuat')} role="button" aria-disabled="true">{body}</div>
          : <Link className={cardCls(p)} data-phase="kuis" to={p.link} data-tilt>{body}</Link>; })()}
        {(() => { const p = ph.uji; const locked = p.state === 'locked';
          return (
            <div className={cardCls(p)} data-phase="uji" id="uji" onClick={locked ? e => lockedClick(e, 'Kuis') : undefined} role={locked ? 'button' : undefined} aria-disabled={locked || undefined}>
              <div className="row between"><span className="jnum"><Icon name={locked ? 'lock' : 'swords'} /></span>{badge(p, 'setelah Kuis')}</div>
              <h3>Uji</h3>
              <ul>
                {f.exam && f.uji_mode !== 'challenge' && <li><Icon name="timer" size={14} /><span><b>Ulangan</b> · {f.exam.count} soal · {f.exam.minutes} menit</span></li>}
                {f.exam && f.challenge && f.uji_mode === 'any' && <li style={{ justifyContent: 'center', color: 'var(--text-faint)' }}>atau</li>}
                {f.challenge && f.uji_mode !== 'ulangan' && <li><Icon name="swords" size={14} /><span><b>Challenge</b> · {f.challenge.title}</span></li>}
              </ul>
              {!locked && (
                <div className="jfoot uji-choice">
                  {f.exam && f.uji_mode !== 'challenge' && <Link className="btn btn-secondary btn-sm btn-press" to={`/bab/${d.chapter.id}/uji/ulangan`}><Icon name="timer" />Ulangan</Link>}
                  {f.challenge && f.uji_mode !== 'ulangan' && <Link className="btn btn-phase btn-sm btn-press" to={`/bab/${d.chapter.id}/uji/challenge`}><Icon name="swords" />Challenge</Link>}
                </div>
              )}
            </div>
          ); })()}
      </section>

      <div className="grid grid-2 mt-12" style={{ gap: 32 }}>
        <section>
          <h2 className="big-serif" style={{ fontSize: 26 }}>Yang akan kamu kuasai</h2>
          <div className="skills mt-4">{d.skills.map(s => <div className="skill" key={s.key}><Mastery tier={s.tier} weak={s.weak} />{s.skill}</div>)}</div>
          <p className="t-xs t-faint mt-3">Penguasaan naik dari latihan, kuis, dan uji. Membaca saja hanya sampai tingkat “Dilihat”.</p>
        </section>
        <section className="cheat">
          <div className="row between"><span className="eyebrow" style={{ color: 'var(--pahami-ink)' }}>Catatan ringkas · dari Pahami</span>
            {d.cheatsheet && <button className="btn btn-ghost btn-sm" onClick={copy}><Icon name="copy" />Salin</button>}</div>
          {d.cheatsheet
            ? <pre dangerouslySetInnerHTML={{ __html: d.cheatsheet.split('\n').map(highlightLine).join('\n') }} />
            : <div className="row gap-3 mt-4 t-sm t-muted"><Icon name="lock" />Terbuka setelah kamu menyelesaikan Pahami.</div>}
        </section>
      </div>
    </main>
  );
}

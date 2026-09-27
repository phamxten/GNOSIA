import { useEffect, useRef } from 'react';
import { Link } from 'react-router';
import './beranda.css';
import { useApi, useMe } from '../api/hooks';
import type { Home } from '../api/types';
import { Icon } from '../design/Icon';
import { Nosi } from '../design/Nosi';
import { PhaseRing } from '../design/PhaseRing';
import { Avatar, EmptyState, Flame, LoadError, PhaseTag, Skel } from '../design/ui';
import { Html } from '../lib/html';
import { ease, motion } from '../fx';
import { greeting, todayLabel, useHeartbeat } from '../lib/hooks';
import { PhaseSteps } from '../learning/PhaseSteps';

function GoalRing({ minutes, target }: { minutes: number; target: number }) {
  const ref = useRef<SVGCircleElement>(null);
  const C = 201, off = C * (1 - Math.min(1, minutes / Math.max(1, target)));
  useEffect(() => {
    if (ref.current && motion() !== 'off') ref.current.animate([{ strokeDashoffset: C }, { strokeDashoffset: off }], { duration: 1100, easing: ease.gentle });
  }, [off]);
  return (
    <div className="goal-ring">
      <svg width="76" height="76"><circle cx="38" cy="38" r="32" stroke="var(--viz-track)" /><circle ref={ref} cx="38" cy="38" r="32" stroke="var(--perkuat-fill)" strokeDasharray={C} strokeDashoffset={off} /></svg>
      <span className="num">{Math.min(minutes, 999)}/{target}</span>
    </div>
  );
}

export default function Beranda() {
  const { data: me } = useMe();
  const q = useApi<Home>('/api/home');
  useHeartbeat();
  const first = me?.name.split(' ')[0] || '';
  if (q.isLoading) return (
    <main className="page" aria-busy="true">
      <Skel h={12} w={150} /><Skel h={44} w={420} className="mt-3" style={{ maxWidth: '100%' }} />
      <Skel h={280} r={24} className="mt-8" />
      <div className="grid grid-3 mt-4"><Skel h={140} r={20} /><Skel h={140} r={20} /><Skel h={140} r={20} /></div>
    </main>
  );
  if (q.error || !q.data) return <main className="page"><LoadError onRetry={() => q.refetch()} /></main>;
  const h = q.data;
  const c = h.continue;

  if (h.first_time) {
    const start = c?.chapter || h.first_chapter;
    return (
      <main className="page">
        <section className="welcome">
          <Nosi size="xl" mood="cheer" />
          <div>
            <div className="eyebrow">Selamat datang di GNOSIA</div>
            <h1 className="big-serif mt-2" style={{ fontSize: 44 }}>Halo {first}, aku <em>Nosi</em>.</h1>
            <p className="t-lg t-muted mt-3" style={{ maxWidth: '52ch', lineHeight: 1.6 }}>Setiap bab punya 4 langkah: <b style={{ color: 'var(--pahami-ink)' }}>Pahami</b> konsepnya, <b style={{ color: 'var(--perkuat-ink)' }}>Perkuat</b> dengan latihan, <b style={{ color: 'var(--kuis-ink)' }}>Kuis</b> singkat, lalu <b style={{ color: 'var(--uji-ink)' }}>Uji</b>. Tidak ada yang dilompati.</p>
            <div className="row gap-3 mt-6 wrap">
              {start && <Link className="btn btn-primary btn-xl btn-press" to={`/bab/${start.id}/pahami`}>Mulai Bab {start.number} · {start.title}<Icon name="arrow-right" /></Link>}
              <Link className="btn btn-ghost btn-lg" to="/playground">Atau ngoding bebas dulu</Link>
            </div>
          </div>
        </section>
        <div className="phase-steps mt-6">
          <div className="pstep" data-phase="pahami"><span className="pnum">01</span><span className="pname">Pahami</span><span className="t-xs t-muted">Animasi dan kode hidup menjelaskan konsep</span></div>
          <div className="pstep" data-phase="perkuat"><span className="pnum">02</span><span className="pname">Perkuat</span><span className="t-xs t-muted">Latihan interaktif yang menyesuaikan</span></div>
          <div className="pstep" data-phase="kuis"><span className="pnum">03</span><span className="pname">Kuis</span><span className="t-xs t-muted">Trivia cepat, lulus 70%</span></div>
          <div className="pstep" data-phase="uji"><span className="pnum">04</span><span className="pname">Uji</span><span className="t-xs t-muted">Ulangan atau challenge coding</span></div>
        </div>
        <div className="card mt-6"><EmptyState icon="folder-kanban" title="Belum ada proyek">{h.next_project ? `Proyek pertamamu, ${h.next_project.title}, terbuka setelah Bab ${h.next_project.after}.` : 'Proyek akan muncul di sini.'}</EmptyState></div>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="greet">
        <div><div className="eyebrow">{todayLabel()}</div><h1 className="big-serif mt-2" style={{ fontSize: 44 }}>{greeting()}, <em>{first}</em>.</h1></div>
        <div className="hint-row" style={{ margin: 0 }}><Html as="div" className="balloon" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }} html={h.nudge} /><Nosi mood="happy" /></div>
      </div>

      {c ? (
        <section className="continue" data-tilt data-phase={c.phase} aria-label="Lanjutkan belajar">
          <div className="stack gap-4">
            <div className="row gap-2"><PhaseTag phase={c.phase}>{c.phase_label}</PhaseTag><span className="t-sm t-faint">{c.path.title} · Bab {c.chapter.number}</span></div>
            <h2 className="big-serif" style={{ fontSize: 40, margin: 0 }}>{c.chapter.title}</h2>
            <PhaseSteps phases={c.phases} current={c.phase} />
            <div className="row gap-3 mt-2 wrap">
              <Link className="btn btn-phase btn-xl btn-press" data-phase={c.phase} to={c.primary.href}>{c.primary.label}<Icon name="arrow-right" /></Link>
              <span className="t-sm t-faint">±{c.eta} menit lagi</span>
            </div>
          </div>
          <div className="stack center" style={{ alignItems: 'center' }}>
            <PhaseRing values={c.ring} size={180} stroke={12}>
              <div><div className="big-serif" style={{ fontSize: 42 }}>{c.done}<span className="t-faint" style={{ fontSize: 22 }}>/4</span></div><div className="t-xs t-faint">fase selesai</div></div>
            </PhaseRing>
          </div>
        </section>
      ) : (
        <section className="continue"><div className="stack gap-3"><h2 className="big-serif" style={{ fontSize: 36, margin: 0 }}>Semua bab yang terbit sudah selesai.</h2><p className="t-muted">Bab berikutnya sedang disiapkan. Sambil menunggu, coba Playground atau ulas konsep yang perlu diulang.</p><div className="row gap-2"><Link className="btn btn-primary btn-lg btn-press" to="/peta">Lihat peta</Link><Link className="btn btn-ghost btn-lg" to="/playground">Playground</Link></div></div><Nosi size="xl" mood="cheer" /></section>
      )}

      <div className="widgets">
        <div className="widget">
          <div className="row between"><span className="eyebrow">Target harian</span><Icon name="target" className="t-faint" /></div>
          <div className="row gap-4"><GoalRing minutes={h.goal.minutes} target={h.goal.target} /><div>
            <div className="t-h4">{h.goal.minutes} dari {h.goal.target} menit</div>
            <div className="t-sm t-muted mt-1">{h.goal.minutes >= h.goal.target ? 'Target hari ini tercapai. Keren!' : `${h.goal.target - h.goal.minutes} menit lagi untuk hari ini.`}</div>
          </div></div>
        </div>
        <div className="widget">
          <div className="row between"><span className="eyebrow">Streak</span>
            <span className="row gap-1 t-mono t-semibold" style={{ color: 'var(--kuis-ink)' }}><Flame size={22} />{h.streak.days ? `${h.streak.days} hari` : 'Mulai lagi hari ini'}</span></div>
          <div className="week">{h.streak.week.map(d => <span key={d.label}><i className={[d.on ? 'on' : '', d.today ? 'today' : ''].join(' ')}>{d.on && <Icon name="check" size={14} />}</i>{d.label}</span>)}</div>
        </div>
        {h.daily_quiz.available ? (
          <Link className="widget" data-phase="kuis" to="/kuis-harian" style={{ background: 'var(--kuis-soft)', borderColor: 'var(--kuis-line)' }} data-tilt>
            <div className="row between"><span className="eyebrow" style={{ color: 'var(--kuis-ink)' }}>Kuis harian</span><Icon name="zap" style={{ color: 'var(--kuis-ink)' }} /></div>
            <div className="t-h3">5 soal acak dari bab yang sudah kamu pelajari</div>
            <div className="row between"><span className="t-sm t-muted">{h.daily_quiz.done_today ? 'Sudah main hari ini · main lagi tanpa XP' : `±2 menit · +${h.daily_quiz.xp} XP`}</span><span className="btn btn-phase btn-sm btn-press">Main</span></div>
          </Link>
        ) : (
          <div className="widget is-locked"><div className="row between"><span className="eyebrow">Kuis harian</span><Icon name="lock" className="t-faint" /></div>
            <div className="t-h3 t-muted">Terbuka setelah kamu menyelesaikan Pahami di satu bab.</div></div>
        )}
      </div>

      {h.review.length > 0 && (
        <>
          <div className="sec-title"><h2>Perlu diulang</h2><span className="t-sm t-faint">dipilih dari jawaban salahmu</span></div>
          <div className="review-cards">
            {h.review.slice(0, 3).map(r => (
              <div className="rcard" data-tilt key={r.concept}>
                <div className="row between"><span className="t-h4">{r.name}</span><PhaseTag phase={r.phase}>{r.source}</PhaseTag></div>
                <Html as="p" className="t-sm t-muted" html={r.note || `Konsep dari Bab ${r.chapter}.`} />
                <Link className="btn btn-secondary btn-sm btn-press" to={r.action.href} style={{ alignSelf: 'flex-start' }}><Icon name={r.action.icon} />{r.action.label}</Link>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="two mt-12">
        <section className="widget">
          <div className="row between"><span className="eyebrow">Dari mentor</span>{h.mentor?.unread ? <span className="badge badge-accent">{h.mentor.unread} baru</span> : null}</div>
          {h.mentor ? (
            <>
              <div className="row gap-3"><Avatar p={h.mentor.mentor} /><div><div className="t-sm t-medium">{h.mentor.mentor.name}</div><div className="t-xs t-faint">{h.mentor.ago}{h.mentor.context ? ` · ${h.mentor.context}` : ''}</div></div></div>
              <p style={{ lineHeight: 1.6 }}>“{h.mentor.body}”</p>
              <Link className="link t-sm" to={h.mentor.href}>{h.mentor.href.startsWith('/proyek') ? 'Balas di proyek →' : 'Lihat semua feedback →'}</Link>
            </>
          ) : <EmptyState icon="message-circle" title="Belum ada pesan">Feedback mentormu akan muncul di sini.</EmptyState>}
        </section>
        <section className="widget">
          <div className="row between"><span className="eyebrow">Proyek</span><Link className="link t-sm" to="/proyek">Semua</Link></div>
          {h.projects.map(p => (
            <Link key={p.id} className="row gap-3" to={p.href}><PhaseRing values={p.ring} size={54} stroke={5} /><div className="grow"><div className="t-h4">{p.title}</div><div className="t-xs t-faint">{p.meta}</div></div><Icon name="chevron-right" className="t-faint" /></Link>
          ))}
          {!h.projects.length && h.next_project && (
            <div className="row gap-3"><span style={{ width: 54, height: 54, borderRadius: 16, display: 'grid', placeItems: 'center', border: '1px dashed var(--border-strong)' }}><Icon name="folder-kanban" className="t-faint" /></span>
              <div className="grow"><div className="t-h4">{h.next_project.title}</div><div className="t-xs t-faint">terbuka setelah Bab {h.next_project.after}</div></div></div>
          )}
          <Link className="row gap-3" to={h.notebook ? `/playground/${h.notebook.id}` : '/playground'}><span style={{ width: 54, height: 54, borderRadius: 16, display: 'grid', placeItems: 'center', background: 'var(--surface-sunken)' }}><Icon name="notebook-pen" className="t-muted" /></span><div className="grow"><div className="t-h4">{h.notebook ? `${h.notebook.title} · playground` : 'Playground'}</div><div className="t-xs t-faint">ngoding bebas{h.notebook ? ` · ${h.notebook.ago}` : ''}</div></div><Icon name="chevron-right" className="t-faint" /></Link>
        </section>
      </div>
    </main>
  );
}

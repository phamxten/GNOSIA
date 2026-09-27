import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import '../player/player.css';
import { api, ApiError } from '../api/client';
import { useRefreshMe } from '../api/hooks';
import type { Exercise, PhaseMeta, PlayerHeader } from '../api/types';
import { Icon } from '../design/Icon';
import { Nosi, type Mood } from '../design/Nosi';
import { toast } from '../design/toast';
import { cx, LoadError, Modal, Skel } from '../design/ui';
import { burst, confetti, correct, pop, sound, ticker, wrong } from '../fx';
import { Html } from '../lib/html';
import { useHeartbeat, useLockRedirect } from '../lib/hooks';
import { DoneOverlay, Gate, PhaseBar, PlayerFoot, PlayerShell, PlayerTop } from '../player/Player';
import { ExerciseBody, TYPE_CHIP, type Marks } from './exercises';

type PerkuatData = PlayerHeader & {
  mode: 'phase' | 'mini'; items: Exercise[]; index: number; solved: Record<string, boolean>; attempts: Record<string, number>;
  hint: Record<string, number>; assist_cap: number; solution_allowed: boolean; done: boolean; kuis: { round: number }; praise: string[];
};
type CheckRes = {
  correct: boolean; marks: Marks; attempt: number; xp?: number; explain?: string; praise?: string; hint?: string; hint_level?: number;
  solution_available?: boolean; inserted?: Exercise; xp_week: number;
};
type Complete = { accuracy: number; first_try: number; total: number; xp?: number; mode?: string; kuis?: { round: number; pass_pct: number } };

export default function PerkuatPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const refreshMe = useRefreshMe();
  const mini = params.has('latih') || params.has('mini');
  const [d, setD] = useState<PerkuatData | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [i, setI] = useState(0);
  const [phase, setPhase] = useState<'answer' | 'next' | 'retry'>('answer');
  const [answer, setAnswer] = useState<unknown>(null);
  const [ready, setReady] = useState(false);
  const [marks, setMarks] = useState<Marks>(null);
  const [fb, setFb] = useState<{ ok: boolean; title: string; body: string } | null>(null);
  const [attemptKey, setAttemptKey] = useState(0);
  const [hint, setHint] = useState<{ level: number; text: string } | null>(null);
  const [solution, setSolution] = useState<string | null>(null);
  const [askSolution, setAskSolution] = useState(false);
  const [mood, setMood] = useState<Mood>('think');
  const [bump, setBump] = useState(0);
  const [done, setDone] = useState<Complete | null>(null);
  const [busy, setBusy] = useState(false);
  const shownAt = useRef(Date.now());
  const btn = useRef<HTMLButtonElement>(null);
  const xpRef = useRef<HTMLSpanElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  useLockRedirect(error);
  useHeartbeat(Number(id));

  const load = async () => {
    setError(null);
    try {
      const r = mini
        ? await api.post<PerkuatData>(`/api/chapters/${id}/perkuat/mini`, { concepts: params.get('latih') ? [params.get('latih')] : [], round_id: Number(params.get('mini')) || null })
        : await api.get<PerkuatData>(`/api/chapters/${id}/perkuat`);
      setD(r);
      const firstOpen = r.items.findIndex(it => !r.solved[it.id]);  // resume at the first item not yet answered correctly
      setI(r.done ? 0 : firstOpen >= 0 ? firstOpen : r.items.length - 1);
    } catch (e) { setError(e); }
  };
  useEffect(() => { load(); }, [id, mini]); // eslint-disable-line react-hooks/exhaustive-deps

  const item = d?.items[i];
  const N = d?.items.length || 0;
  const reset = () => {
    setPhase('answer'); setReady(false); setAnswer(null); setMarks(null); setFb(null); setHint(null); setSolution(null);
    setMood('think'); setBump(b => b + 1); shownAt.current = Date.now();
  };
  useEffect(() => { if (item) { reset(); setAttemptKey(k => k + 1); scrollTo({ top: 0, behavior: 'smooth' }); } }, [i, item?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const check = async () => {
    if (!d || !item || !ready || busy) return;
    setBusy(true);
    try {
      const r = await api.post<CheckRes>(`/api/chapters/${id}/perkuat/check`, { item_id: item.id, answer, ms: Date.now() - shownAt.current, mode: d.mode });
      setMarks(r.marks);
      const attempts = { ...d.attempts, [item.id]: r.attempt };
      if (r.correct) {
        setPhase('next');
        setFb({ ok: true, title: r.praise || 'Mantap!', body: r.explain || '' });
        setMood('happy'); setBump(b => b + 1);
        correct({ button: btn.current, xpEl: xpRef.current, xp: r.xp });
        setD({ ...d, attempts, solved: { ...d.solved, [item.id]: true }, xp: r.xp_week });
      } else {
        setPhase('retry');
        setFb({ ok: false, title: 'Belum tepat, tidak apa-apa.', body: r.hint || 'Coba lihat lagi pelan-pelan.' });
        setMood('oops'); setBump(b => b + 1);
        wrong({ target: stage.current?.querySelector('[data-answer-area]') });
        const items = r.inserted ? [...d.items.slice(0, i + 1), r.inserted, ...d.items.slice(i + 1)] : d.items;
        setD({ ...d, items, attempts, hint: { ...d.hint, [item.id]: r.hint_level ?? d.hint[item.id] ?? 0 }, solution_allowed: d.solution_allowed });
        if (r.inserted) toast({ kind: 'accent', icon: 'repeat', title: 'Soal serupa ditambahkan', body: 'Satu latihan ekstra untuk konsep ini.' });
      }
    } catch (e) {
      toast({ kind: 'danger', icon: 'circle-alert', title: e instanceof ApiError && e.offline ? 'Koneksi terputus' : 'Gagal memeriksa', body: 'Jawabanmu belum terkirim. Coba lagi.' });
    } finally { setBusy(false); }
  };

  const retry = () => { reset(); if (item && ['choice', 'predict', 'bug', 'fill'].includes(item.type)) setAttemptKey(k => k + 1); };

  const nextItem = async () => {
    if (!d) return;
    if (i < N - 1) {
      setI(i + 1);
      api.post(`/api/chapters/${id}/perkuat/index`, { index: i + 1, mode: d.mode }).catch(() => undefined);
      return;
    }
    const firstUnsolved = d.items.findIndex(it => !d.solved[it.id]);
    if (firstUnsolved >= 0) { setI(firstUnsolved); return; }
    setBusy(true);
    try {
      const r = await api.post<Complete>(`/api/chapters/${id}/perkuat/complete`, { mode: d.mode });
      setDone(r);
      qc.invalidateQueries({ queryKey: [`/api/chapters/${id}`] });
      refreshMe();
    } catch (e) {
      toast({ kind: 'danger', icon: 'circle-alert', title: 'Belum bisa menyelesaikan', body: e instanceof ApiError ? e.message : 'Coba lagi.' });
    } finally { setBusy(false); }
  };

  const primary = () => { if (phase === 'answer') check(); else if (phase === 'retry') retry(); else nextItem(); };

  const openHint = async () => {
    if (!d || !item) return;
    try {
      const r = await api.post<{ level: number; text: string; max: boolean }>(`/api/chapters/${id}/perkuat/hint`, { item_id: item.id, ms_since_shown: Date.now() - shownAt.current, mode: d.mode });
      setHint(r);
      if (r.level) setD({ ...d, hint: { ...d.hint, [item.id]: r.level } });
      setMood('think'); setBump(b => b + 1);
    } catch { toast({ kind: 'danger', icon: 'circle-alert', title: 'Petunjuk belum bisa dibuka' }); }
  };
  const openSolution = async () => {
    if (!d || !item) return;
    setAskSolution(false);
    try {
      const r = await api.post<{ html: string }>(`/api/chapters/${id}/perkuat/solution`, { item_id: item.id, mode: d.mode });
      setSolution(r.html);
    } catch (e) { toast({ kind: 'accent', icon: 'lock', title: e instanceof ApiError ? e.message : 'Belum tersedia' }); }
  };

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.target as Element).closest('input,textarea,.bugline,.pblock,.slot')) return;
      if (e.key === 'Enter' && !(e.target as Element).closest('button')) { e.preventDefault(); primary(); }
    };
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  });

  if (error && !(error instanceof ApiError && error.status === 409)) return <PlayerShell phase="perkuat"><div className="player-error"><LoadError onRetry={load} /></div></PlayerShell>;
  if (!d || !item) return (
    <PlayerShell phase="perkuat">
      <header className="player-top"><span /><Skel h={30} w="100%" style={{ maxWidth: 760, justifySelf: 'center' }} /><span /></header>
      <main className="stage-wrap"><div className="stage"><Skel h={420} r={20} /></div></main>
    </PlayerShell>
  );

  const hl = d.hint[item.id] || 0;
  const pips = [3, 4, 5].map(l => hl >= l);
  const attempts = d.attempts[item.id] || 0;
  const solvedCount = d.items.filter(it => d.solved[it.id]).length;
  const [chipIcon, chipLabel] = TYPE_CHIP[item.type];
  const isLast = i === N - 1 && d.items.every((it, k) => k === i || d.solved[it.id]);
  const canSolution = d.solution_allowed && attempts >= 3 && item.has_solution && phase !== 'next';

  return (
    <PlayerShell phase="perkuat">
      <PlayerTop exitTo={`/bab/${id}`} xp={d.xp} streak={d.streak} mood={mood} bump={bump} xpRef={xpRef}
        center={<PhaseBar phases={d.phases as PhaseMeta[]} current="perkuat" progress={d.mode === 'mini' ? undefined : solvedCount / N} labels={d.mode === 'mini' ? { perkuat: 'Perkuat mini' } : {}} />} />
      <main className="stage-wrap"><div className="stage" ref={stage}>
        <section className="scene scene-enter" key={item.id} aria-labelledby="q-title">
          <div className="q-meta">
            <span className="phase-tag">{d.mode === 'mini' ? 'Perkuat mini' : 'Perkuat'}</span>
            {item.similar ? <span className="similar-chip"><Icon name="repeat" size={14} />Soal serupa</span> : <span className="type-chip"><Icon name={chipIcon} />{chipLabel}</span>}
            <span className="t-faint t-sm">Soal {i + 1} dari {N}</span>
          </div>
          <Html as="h2" className="q-title" id="q-title" html={item.title} />
          {item.help && <Html as="p" className="q-help" html={item.help} />}
          <ExerciseBody key={`${item.id}-${attemptKey}`} item={item} locked={phase !== 'answer'} marks={marks}
            onChange={(a, r) => { setAnswer(a); setReady(r); }} />
          {solution && <div className="solution"><div className="eyebrow" style={{ color: 'var(--kuis-ink)' }}>Jawaban lengkap · L6</div><Html as="div" className="t-sm mt-2" html={solution} /></div>}
        </section>
        {hint && (
          <div className="hint-row"><Nosi mood="think" /><div className="balloon"><span className="lvl">Petunjuk · L{hint.level || '–'}</span><Html html={hint.text} /></div></div>
        )}
      </div></main>

      <PlayerFoot state={fb ? (fb.ok ? 'ok' : 'no') : 'idle'}>
        {phase !== 'next' && d.assist_cap >= 3 && (
          <button className="btn btn-ghost btn-lg" onClick={openHint} aria-label={`Petunjuk, level ${hl ? `L${hl}` : 'belum dibuka'}`}>
            <Icon name="lightbulb" /><span className="hide-sm">Petunjuk</span>
            <span className="hint-ladder hide-sm">{pips.map((p, k) => <i key={k} className={p ? 'on' : ''} />)}</span>
          </button>
        )}
        {canSolution && <button className="btn btn-ghost btn-lg hide-sm" onClick={() => setAskSolution(true)}><Icon name="eye" />Jawaban</button>}
        <div className="fb-idle"><span className="kbdhint hide-sm"><kbd>1</kbd>–<kbd>4</kbd> pilih · <kbd>↵</kbd> periksa</span></div>
        <div className="fb fb-ok"><span className="fb-icon"><Icon name="check" /></span><div className="grow"><div className="fb-title">{fb?.title}</div><Html as="div" className="fb-body t-muted" html={fb?.ok ? fb.body : ''} /></div></div>
        <div className="fb fb-no"><span className="fb-icon"><Icon name="rotate-ccw" /></span><div className="grow"><div className="fb-title">Belum tepat, tidak apa-apa.</div><Html as="div" className="fb-body t-muted" html={!fb?.ok ? fb?.body : ''} /></div></div>
        <button ref={btn} className={cx('btn btn-xl btn-press', phase === 'retry' ? 'btn-no' : 'btn-ok', busy && 'is-loading')} style={{ minWidth: 180 }}
          disabled={phase === 'answer' && !ready} onClick={primary}>
          {phase === 'answer' ? 'Periksa' : phase === 'retry' ? 'Coba lagi' : isLast ? (d.mode === 'mini' ? 'Selesai' : 'Selesaikan Perkuat') : 'Lanjut'}
        </button>
      </PlayerFoot>

      <Modal open={askSolution} onClose={() => setAskSolution(false)} title="Lihat jawaban lengkap?" role="alertdialog"
        foot={<><button className="btn btn-ghost" onClick={() => setAskSolution(false)}>Coba sekali lagi</button><button className="btn btn-primary btn-press" onClick={openSolution}>Ya, tampilkan</button></>}>
        <p>Kamu sudah mencoba {attempts} kali. Jawaban lengkap membantu, tapi mencoba sendiri membuat ingatan lebih kuat.</p>
      </Modal>
      {done && (d.mode === 'mini'
        ? <MiniDone id={id!} res={done} onBack={() => nav(`/bab/${id}/kuis`)} />
        : <PerkuatDone id={id!} res={done} />)}
    </PlayerShell>
  );
}

function PerkuatDone({ id, res }: { id: string; res: Complete }) {
  const acc = useRef<HTMLElement>(null), first = useRef<HTMLElement>(null), xp = useRef<HTMLSpanElement>(null), gate = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    confetti(); sound('done');
    ticker(acc.current, res.accuracy, { from: 0 }); ticker(first.current, res.first_try, { from: 0 }); ticker(xp.current, res.xp ?? 75, { from: 0, dur: 1200 });
    const t = setTimeout(() => { setOpen(true); requestAnimationFrame(() => burst(gate.current?.querySelector('.lock'), { count: 10, spread: 60 })); }, 1100);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <DoneOverlay>
      <Nosi size="xl" mood="cheer" />
      <div className="eyebrow mt-4">Fase 2 dari 4 selesai</div>
      <h2 className="big-serif mt-2" style={{ fontSize: 44 }}>Pemahamanmu <em style={{ color: 'var(--perkuat-ink)' }}>makin kuat</em>.</h2>
      <div className="done-stats"><div><b ref={acc}>0</b><span className="t-xs t-faint">% tepat</span></div><div><b ref={first}>0</b><span className="t-xs t-faint">benar di coba 1</span></div><div><b style={{ color: 'var(--xp)' }}>+<span ref={xp}>0</span></b><span className="t-xs t-faint">XP</span></div></div>
      <div className="mt-6"><Gate open={open} gateRef={gate} title={`Kuis · ${res.kuis?.round ?? 10} soal trivia`} text={open ? `terbuka · lulus minimal ${res.kuis?.pass_pct ?? 70}%` : 'terkunci'} tag={<span className="phase-tag" data-phase="kuis">Fase 3</span>} /></div>
      <Link className="btn btn-phase btn-xl btn-press w-full mt-6" data-phase="kuis" to={`/bab/${id}/kuis`}>Mulai Kuis<Icon name="zap" /></Link>
      <Link className="btn btn-ghost mt-2" to={`/bab/${id}`}>Nanti saja</Link>
    </DoneOverlay>
  );
}

function MiniDone({ id, res, onBack }: { id: string; res: Complete; onBack: () => void }) {
  useEffect(() => { sound('done'); pop(document.querySelector('.done-card')); }, []);
  return (
    <DoneOverlay>
      <Nosi size="lg" mood="happy" />
      <div className="eyebrow mt-4">Perkuat mini selesai</div>
      <h2 className="big-serif mt-2" style={{ fontSize: 40 }}>Konsepnya sudah <em>diulang</em>.</h2>
      <p className="t-muted mt-3">{res.first_try} dari {res.total} benar di percobaan pertama.</p>
      <div className="row gap-2 mt-8">
        <button className="btn btn-phase btn-xl btn-press grow" data-phase="kuis" onClick={onBack}><Icon name="zap" />Ke kuis</button>
        <Link className="btn btn-secondary btn-xl btn-press grow" to={`/bab/${id}`}>Kembali ke bab</Link>
      </div>
    </DoneOverlay>
  );
}

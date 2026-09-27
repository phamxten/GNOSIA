import { useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import '../player/player.css';
import { api, ApiError } from '../api/client';
import { useApi, useRefreshMe } from '../api/hooks';
import type { KuisQuestion, PhaseMeta, PlayerHeader } from '../api/types';
import { Icon } from '../design/Icon';
import { Nosi, type Mood } from '../design/Nosi';
import { toast } from '../design/toast';
import { cx, LoadError, PhaseTag, Skel } from '../design/ui';
import { burst, confetti, motion, pop, shake, sound, ticker, xpFloat } from '../fx';
import { highlightLine } from '../lib/highlight';
import { Html } from '../lib/html';
import { useHeartbeat, useLockRedirect } from '../lib/hooks';
import { Gate, PhaseBar, PlayerShell, PlayerTop } from '../player/Player';

type Intro = PlayerHeader & { round_size: number; seconds: number; pass_pct: number; combo_max: number; tries: number; best: number | null; passed: boolean;
  uji: UjiOptions };
type UjiOptions = { ulangan: boolean; challenge: boolean; exam: { count: number; minutes: number; pass: number }; challenge_title: string };
type Round = { round_id: number; kind: string; seconds: number; combo_max: number; pass_pct: number; questions: KuisQuestion[] };
type Answer = { correct: boolean; answer: number; points: number; score: number; combo: number; best_combo: number };
type Result = { kind: string; pct: number; correct: number; total: number; best_combo: number; score: number; xp: number; passed: boolean; pass_pct: number;
  missing: number; review: { t: string; answer: string; e: string; ok: boolean; picked: string | null; trivia: boolean }[]; uji?: UjiOptions; was_done?: boolean };

const C = 150.8;

export default function KuisPage({ daily = false }: { daily?: boolean }) {
  const { id } = useParams();
  const [params] = useSearchParams();
  const review = params.get('ulang');
  const qc = useQueryClient();
  const refreshMe = useRefreshMe();
  const intro = useApi<Intro>(!daily ? `/api/chapters/${id}/kuis` : null, { staleTime: 0 });
  useLockRedirect(intro.error);
  useHeartbeat(daily ? null : Number(id));
  const [stage, setStage] = useState<'intro' | 'count' | 'play' | 'result'>('intro');
  const [count, setCount] = useState(3);
  const [round, setRound] = useState<Round | null>(null);
  const [k, setK] = useState(0);
  const [left, setLeft] = useState(20);
  const [picked, setPicked] = useState<number | null>(null);
  const [reveal, setReveal] = useState<Answer | null>(null);
  const [answers, setAnswers] = useState<boolean[]>([]);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(1);
  const [res, setRes] = useState<Result | null>(null);
  const [mood, setMood] = useState<Mood>('think');
  const [bump, setBump] = useState(0);
  const [starting, setStarting] = useState(false);
  const scoreRef = useRef<HTMLSpanElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const comboRef = useRef<HTMLSpanElement>(null);
  const cdRef = useRef<HTMLSpanElement>(null);
  const timer = useRef<number>(0);
  const lock = useRef(false);

  const q = round?.questions[k];
  const PER = round?.seconds || 20;

  const start = async () => {
    if (starting) return;
    setStarting(true);
    try {
      const r = daily
        ? await api.post<Round>('/api/kuis-harian/rounds')
        : await api.post<Round>(`/api/chapters/${id}/kuis/rounds`, review ? { kind: 'review', concept: review } : {});
      setRound(r); setK(0); setAnswers([]); setScore(0); setCombo(1); setRes(null);
      setStage('count'); setCount(3);
    } catch (e) {
      toast({ kind: 'danger', icon: 'circle-alert', title: e instanceof ApiError ? e.message : 'Gagal memulai kuis' });
    } finally { setStarting(false); }
  };

  useEffect(() => { // 3-2-1
    if (stage !== 'count') return;
    pop(cdRef.current);
    if (count === 0) { setStage('play'); return; }
    const t = setTimeout(() => { setCount(c => c - 1); sound('tick'); }, motion() === 'off' ? 1 : 700);
    return () => clearTimeout(t);
  }, [stage, count]);

  useEffect(() => { // per-question timer
    if (stage !== 'play' || !q) return;
    lock.current = false;
    setPicked(null); setReveal(null); setLeft(PER); setMood('think'); setBump(b => b + 1);
    const card = cardRef.current;
    if (card) { card.classList.remove('scene-enter'); void card.offsetWidth; card.classList.add('scene-enter'); }
    timer.current = window.setInterval(() => setLeft(l => l - 1), 1000);
    return () => clearInterval(timer.current);
  }, [stage, k, q?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (stage === 'play' && left <= 0 && !lock.current) choose(-1); }, [left]); // eslint-disable-line react-hooks/exhaustive-deps

  const choose = async (j: number, el?: HTMLElement) => {
    if (!round || lock.current) return;
    lock.current = true;
    clearInterval(timer.current);
    setPicked(j);
    try {
      const a = await api.post<Answer>(`/api/kuis/rounds/${round.round_id}/answer`, { index: k, choice: j, left: Math.max(0, left) });
      setReveal(a);
      setAnswers(x => [...x, a.correct]);
      setCombo(a.combo);
      if (a.correct) {
        ticker(scoreRef.current, a.score); burst(el); xpFloat(scoreRef.current, `+${a.points}`); setMood('happy'); sound('ok');
        requestAnimationFrame(() => { const cb = comboRef.current; if (cb) { cb.classList.remove('is-bump'); void cb.offsetWidth; cb.classList.add('is-bump'); } });
      } else { shake(cardRef.current); setMood('oops'); sound('no'); }
      setScore(a.score); setBump(b => b + 1);
      setTimeout(() => { if (k < round.questions.length - 1) setK(k + 1); else finish(round); }, 1300);
    } catch {
      lock.current = false;
      toast({ kind: 'danger', icon: 'wifi-off', title: 'Koneksi terputus', body: 'Jawaban belum terkirim. Ketuk lagi.' });
    }
  };

  const finish = async (r: Round) => {
    try {
      const out = await api.post<Result>(`/api/kuis/rounds/${r.round_id}/finish`);
      setRes(out); setStage('result');
      qc.invalidateQueries({ queryKey: [`/api/chapters/${id}`] });
      refreshMe();
    } catch { toast({ kind: 'danger', icon: 'circle-alert', title: 'Gagal mengirim hasil', body: 'Coba lagi sebentar.' }); }
  };

  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      if (stage !== 'play' || !q) return;
      const j = /^[1-4]$/.test(e.key) ? +e.key - 1 : 'abcd'.indexOf(e.key.toLowerCase());
      if (j >= 0 && j < q.o.length) choose(j, document.querySelectorAll<HTMLElement>('[data-choices] .choice')[j]);
    };
    document.addEventListener('keydown', kd);
    return () => document.removeEventListener('keydown', kd);
  });

  if (!daily && intro.error && !(intro.error instanceof ApiError && intro.error.status === 409)) return <PlayerShell phase="kuis"><div className="player-error"><LoadError onRetry={() => intro.refetch()} /></div></PlayerShell>;
  const info = intro.data;
  if (!daily && !info) return <PlayerShell phase="kuis"><header className="player-top"><span /><Skel h={30} w="100%" style={{ maxWidth: 760, justifySelf: 'center' }} /><span /></header><main className="stage-wrap"><div className="stage"><Skel h={360} r={20} /></div></main></PlayerShell>;

  const exit = daily ? '/beranda' : `/bab/${id}`;
  const N = round?.questions.length || info?.round_size || 5;
  const center = daily || review
    ? <div className="row gap-3" style={{ justifySelf: 'center' }}><PhaseTag phase="kuis">{daily ? 'Kuis harian' : 'Kuis ulang · 3 soal'}</PhaseTag></div>
    : <PhaseBar phases={info!.phases as PhaseMeta[]} current="kuis" progress={stage === 'result' ? 1 : stage === 'play' ? k / N : undefined} />;

  return (
    <PlayerShell phase="kuis">
      <PlayerTop exitTo={exit} xp={info?.xp} mood={mood} bump={bump} center={center} />
      <main className="stage-wrap"><div className="stage">
        {stage === 'intro' && (
          <section className="scene scene-enter">
            <div className="row gap-6" style={{ alignItems: 'center' }}>
              <div className="grow">
                <PhaseTag>{daily ? 'Kuis harian' : review ? 'Kuis ulang' : 'Kuis · Fase 3'}</PhaseTag>
                <h1>{daily ? 'Pemanasan hari ini?' : 'Siap diuji cepat?'}</h1>
                <p className="lead">
                  {daily ? '5 soal acak dari bab yang sudah kamu pelajari. Jawab cepat untuk combo.'
                    : review ? '3 soal untuk konsep yang perlu diulang. Tidak memengaruhi gerbang Uji.'
                      : <>{info!.round_size} soal trivia tentang {info!.chapter.title.toLowerCase()}. Jawab cepat untuk combo. Nilai minimal <b>{info!.pass_pct}%</b> membuka fase Uji.</>}
                </p>
              </div>
              <Nosi size="lg" mood="cheer" className="hide-sm" />
            </div>
            <div className="intro-rules">
              <div><b>{daily ? 5 : review ? 3 : info!.round_size}</b><span className="t-sm t-muted">soal</span></div>
              <div><b>{info?.seconds ?? 20}<span style={{ fontSize: 18 }}>s</span></b><span className="t-sm t-muted">per soal</span></div>
              <div><b>×{info?.combo_max ?? 3}</b><span className="t-sm t-muted">combo maksimum</span></div>
            </div>
            {!daily && !review && info!.tries > 0 && !info!.passed && (
              <div className="callout callout-warning mt-6"><Icon name="rotate-ccw" /><div className="t-sm">Percobaan ke-{info!.tries + 1}. Terbaikmu {Math.round(info!.best || 0)}%. Soalnya diacak ulang dari bank.</div></div>
            )}
            <div className="callout mt-6"><Icon name="info" /><div className="t-sm">Petunjuk <b>tidak tersedia</b> selama kuis. Pembahasan lengkap muncul di akhir, benar ataupun salah.</div></div>
            <button className={cx('btn btn-phase btn-xl btn-press w-full mt-6', starting && 'is-loading')} onClick={start}>Mulai kuis<Icon name="play" /></button>
          </section>
        )}

        {stage === 'play' && q && (
          <section>
            <div className="quiz-top">
              <div className={cx('qtimer', left <= 5 && 'is-low')} aria-live={left === 10 || left === 5 ? 'polite' : 'off'}>
                <svg width="56" height="56"><circle className="t-trk" cx="28" cy="28" r="24" /><circle className="t-arc" cx="28" cy="28" r="24" strokeDasharray={C} strokeDashoffset={C * (1 - Math.max(0, left) / PER)} /></svg>
                <span className="t-num">{Math.max(0, left)}</span>
              </div>
              <div className="grow">
                <div className="qdots">{round!.questions.map((_, j) => <i key={j} className={j < answers.length ? (answers[j] ? 'ok' : 'no') : j === k ? 'now' : ''} />)}</div>
                <span className="t-xs t-faint">Soal {k + 1} dari {N}</span>
              </div>
              {combo > 1 && <span className="combo" ref={comboRef}><Icon name="zap" size={14} />×{combo}</span>}
              <span className="score-chip" ref={scoreRef}>{score}</span>
            </div>
            <div className="scene" ref={cardRef}>
              {q.trivia && <div className="trivia-tag mb-2"><Icon name="sparkles" size={14} />Fakta seru</div>}
              <Html as="h2" className="q-title" style={{ marginTop: 0 }} html={q.t} />
              {q.c && <div className="codecard mt-4"><div className="cc-body">{q.c.split('\n').map((l, j) => <div className="cc-line" key={j}><span className="cc-ln">{j + 1}</span><span dangerouslySetInnerHTML={{ __html: highlightLine(l) }} /></div>)}</div></div>}
              <div className={cx('choices cols-2', reveal && 'is-locked')} data-choices role="radiogroup">
                {q.o.map((o, j) => {
                  const cls = reveal ? (j === reveal.answer ? 'is-right' : j === picked ? 'is-wrong' : 'is-dim') : picked === j ? 'is-picked' : '';
                  return <button key={j} className={cx('choice', cls)} role="radio" aria-checked={picked === j} onClick={e => choose(j, e.currentTarget)}><span className="key abcd">{'ABCD'[j]}</span><span className="code">{o}</span></button>;
                })}
              </div>
            </div>
          </section>
        )}

        {stage === 'result' && res && <Results id={id} res={res} daily={daily} review={!!review} roundId={round?.round_id} onRetry={() => setStage('intro')} />}
      </div></main>
      {stage === 'count' && <div className="countdown"><span ref={cdRef} key={count}>{count || 'Mulai'}</span></div>}
    </PlayerShell>
  );
}

function Results({ id, res, daily, review, roundId, onRetry }: { id?: string; res: Result; daily: boolean; review: boolean; roundId?: number; onRetry: () => void }) {
  const pctRef = useRef<HTMLSpanElement>(null), rightRef = useRef<HTMLElement>(null), xpRef = useRef<HTMLSpanElement>(null);
  const [bar, setBar] = useState(0);
  const [open, setOpen] = useState(false);
  const gateRef = useRef<HTMLDivElement>(null);
  const gate = !daily && !review;
  useEffect(() => {
    ticker(pctRef.current, res.pct, { from: 0, dur: 1200 }); ticker(rightRef.current, res.correct, { from: 0 }); ticker(xpRef.current, res.xp, { from: 0 });
    const t0 = setTimeout(() => setBar(res.pct), 60);
    let t1 = 0;
    if (res.passed && gate) t1 = window.setTimeout(() => { setOpen(true); confetti(); sound('done'); requestAnimationFrame(() => burst(gateRef.current?.querySelector('.lock'), { count: 10, spread: 60 })); }, 1300);
    else if (!gate) sound('done');
    return () => { clearTimeout(t0); clearTimeout(t1); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const u = res.uji;
  return (
    <section className="scene scene-enter">
      <div className="t-center">
        <Nosi size="lg" mood={res.passed || !gate ? 'cheer' : 'think'} />
        <div className="eyebrow mt-3">{gate ? (res.passed ? 'Lulus kuis' : 'Belum lulus, belum masalah') : daily ? 'Kuis harian selesai' : 'Kuis ulang selesai'}</div>
        <div className="score-num mt-2"><span ref={pctRef}>0</span><span style={{ fontSize: '.4em' }} className="t-faint">%</span></div>
        <p className="t-muted mt-2">
          {gate ? (res.passed ? <>Fase Uji terbuka. Pilih <b>Ulangan</b> atau <b>Challenge</b>.</> : `Butuh ${res.pass_pct}% untuk membuka Uji. Kuis ulang memakai soal yang diacak, dan Perkuat mini dulu biasanya membantu.`)
            : daily ? (res.xp ? 'XP harian sudah masuk. Sampai besok!' : 'XP kuis harian sudah didapat hari ini. Latihan tetap berguna.') : 'Konsep yang benar tidak lagi ditandai perlu diulang.'}
        </p>
      </div>
      {gate && <div className="meter-pass"><span style={{ width: `${bar}%` }} /><i className="mark" style={{ left: `${res.pass_pct}%` }} data-label={`lulus ${res.pass_pct}%`} /></div>}
      <div className="result-grid"><div><b ref={rightRef}>0</b><span className="t-xs t-faint">benar</span></div><div><b>×{res.best_combo}</b><span className="t-xs t-faint">combo terbaik</span></div><div><b style={{ color: 'var(--xp)' }}>+<span ref={xpRef}>0</span></b><span className="t-xs t-faint">XP</span></div></div>
      {gate && <div className="mt-6"><Gate open={open} gateRef={gateRef} title="Uji · Ulangan atau Challenge" text={res.passed ? (open ? 'terbuka' : 'membuka…') : `terkunci · kurang ${res.missing}%`} /></div>}
      <div className="row gap-2 mt-6 wrap">
        {gate && res.passed && u?.ulangan && <Link className="btn btn-phase btn-xl btn-press grow" data-phase="uji" to={`/bab/${id}/uji/ulangan`}><Icon name="timer" />Ulangan</Link>}
        {gate && res.passed && u?.challenge && <Link className="btn btn-phase btn-xl btn-press grow" data-phase="uji" to={`/bab/${id}/uji/challenge`}><Icon name="swords" />Challenge</Link>}
        {gate && !res.passed && <Link className="btn btn-ok btn-xl btn-press grow" to={`/bab/${id}/perkuat?mini=${roundId}`}><Icon name="dumbbell" />Perkuat mini · 3 soal</Link>}
        {gate && !res.passed && <button className="btn btn-secondary btn-xl btn-press grow" onClick={onRetry}><Icon name="rotate-ccw" />Ulangi kuis</button>}
        {!gate && <Link className="btn btn-primary btn-xl btn-press grow" to={daily ? '/beranda' : `/bab/${id}`}>{daily ? 'Kembali ke beranda' : 'Kembali ke bab'}<Icon name="arrow-right" /></Link>}
        {!gate && <button className="btn btn-secondary btn-xl btn-press grow" onClick={onRetry}><Icon name="rotate-ccw" />Main lagi</button>}
      </div>
      <details className="mt-8" open>
        <summary className="t-h4" style={{ cursor: 'pointer' }}>Pembahasan · {res.total} soal</summary>
        <div className="mt-2">
          {res.review.map((r, j) => (
            <div className={cx('review-item', r.ok ? 'ok' : 'no')} key={j}>
              <span className="ri"><Icon name={r.ok ? 'check' : 'x'} size={14} /></span>
              <div>
                <Html as="div" className="t-sm" html={r.t} />
                <div className="t-xs mt-1"><span className="t-faint">Jawaban:</span> <span className="t-mono">{r.answer}</span>{!r.ok && <span className="t-faint"> · kamu: <span className="t-mono">{r.picked ?? 'waktu habis'}</span></span>}</div>
                <Html as="div" className="t-sm t-muted mt-1" html={r.e} />
              </div>
            </div>
          ))}
        </div>
      </details>
    </section>
  );
}

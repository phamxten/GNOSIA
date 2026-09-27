import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { get as idbGet, set as idbSet, del as idbDel } from 'idb-keyval';
import '../player/player.css';
import { api, ApiError } from '../api/client';
import { useRefreshMe } from '../api/hooks';
import type { ChapterRef, PlayerHeader } from '../api/types';
import { Icon } from '../design/Icon';
import { Nosi } from '../design/Nosi';
import { toast } from '../design/toast';
import { cx, LoadError, Modal, PhaseTag, SaveState, Skel } from '../design/ui';
import { confetti, pop, sound, ticker } from '../fx';
import { highlightLine } from '../lib/highlight';
import { Html } from '../lib/html';
import { useHeartbeat, useLockRedirect, useOnline } from '../lib/hooks';
import { PlayerFoot, PlayerShell, PlayerTop } from '../player/Player';

type Q = { id: string; t: string; code?: string; type: 'choice' | 'short' | 'code'; o?: string[]; pts: number; pre?: string; label?: string };
type Result = { score: number; passed: boolean; used: string; rows: { n: number; label: string; ok: boolean; pts: number; max: number; note: string }[] };
type Session = { id: number; deadline: string; server_now: string; answers: Record<string, unknown>; flags: string[]; submitted: boolean;
  questions: Q[]; minutes: number; pass_mark: number; result: Result | null };
type StartRes = PlayerHeader & { session: Session };
type SubmitRes = Session & { chapter_done?: boolean; xp?: number; next_chapter?: ChapterRef | null; mastery?: number };

const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

export default function UlanganPage() {
  const { id } = useParams();
  const qc = useQueryClient();
  const refreshMe = useRefreshMe();
  const online = useOnline();
  useHeartbeat(Number(id));
  const [data, setData] = useState<StartRes | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [flags, setFlags] = useState<string[]>([]);
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [cur, setCur] = useState(0);
  const [left, setLeft] = useState(0);
  const [save, setSave] = useState<'idle' | 'saving' | 'saved' | 'offline' | 'error'>('saved');
  const [confirm, setConfirm] = useState(false);
  const [result, setResult] = useState<SubmitRes | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const offset = useRef(0);
  const timers = useRef<Record<string, number>>({});
  const cardRef = useRef<HTMLElement>(null);
  const autoSubmitted = useRef(false);
  useLockRedirect(error);

  const s = data?.session;
  const key = s ? `gnosia-exam-${s.id}` : '';

  useEffect(() => {
    (async () => {
      try {
        const r = await api.post<StartRes>(`/api/chapters/${id}/ulangan/start`);
        offset.current = new Date(r.session.server_now).getTime() - Date.now();
        const local = (await idbGet<{ answers: Record<string, unknown>; pending: string[] }>(`gnosia-exam-${r.session.id}`).catch(() => undefined)) || null;
        setData(r);
        setAnswers({ ...r.session.answers, ...(local?.answers || {}) });
        setPending(new Set(local?.pending || []));
        setFlags(r.session.flags);
        if (r.session.submitted && r.session.result) setResult(r.session as SubmitRes);
      } catch (e) { setError(e); }
    })();
  }, [id]);

  // countdown against the server deadline
  useEffect(() => {
    if (!s || result) return;
    const tick = () => setLeft(Math.max(0, Math.round((new Date(s.deadline).getTime() - (Date.now() + offset.current)) / 1000)));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [s, result]);

  const persist = useCallback(async (a: Record<string, unknown>, p: Set<string>) => {
    if (key) await idbSet(key, { answers: a, pending: [...p] }).catch(() => undefined);
  }, [key]);

  const push = useCallback(async (qid: string, value: unknown) => {
    if (!s) return;
    try {
      await api.put(`/api/ulangan/${s.id}/answers`, { qid, answer: value });
      setPending(p => { const n = new Set(p); n.delete(qid); return n; });
      setSave('saved');
    } catch (e) {
      if (e instanceof ApiError && e.offline) setSave('offline');
      else setSave('error');
    }
  }, [s]);

  const answer = (qid: string, value: unknown, debounce = 600) => {
    const next = { ...answers, [qid]: value };
    if (value === '' || value === null || value === undefined) delete next[qid];
    const p = new Set(pending).add(qid);
    setAnswers(next); setPending(p); persist(next, p);
    setSave(online ? 'saving' : 'offline');
    clearTimeout(timers.current[qid]);
    timers.current[qid] = window.setTimeout(() => push(qid, value), debounce);
  };

  // sync answers kept on this device when the connection comes back
  useEffect(() => {
    if (!online || !s || !pending.size) return;
    pending.forEach(qid => push(qid, answers[qid] ?? null));
  }, [online]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!online) setSave('offline'); }, [online]);
  useEffect(() => { if (s) persist(answers, pending); }, [pending]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleFlag = async (qid: string) => {
    const next = flags.includes(qid) ? flags.filter(f => f !== qid) : [...flags, qid];
    setFlags(next);
    if (s) api.put(`/api/ulangan/${s.id}/flags`, { flags: next }).catch(() => undefined);
  };

  const submit = async (auto = false) => {
    if (!s || submitting) return;
    setSubmitting(true); setConfirm(false);
    try {
      const r = await api.post<SubmitRes>(`/api/ulangan/${s.id}/submit`, { answers });
      await idbDel(key).catch(() => undefined);
      setResult(r);
      qc.invalidateQueries({ queryKey: [`/api/chapters/${id}`] });
      refreshMe();
      if (auto) toast({ kind: 'accent', icon: 'alarm-clock', title: 'Waktu habis', body: 'Ulanganmu dikumpulkan otomatis.' });
    } catch (e) {
      toast({ kind: 'danger', icon: 'wifi-off', title: e instanceof ApiError && e.offline ? 'Koneksi terputus' : 'Gagal mengumpulkan', body: 'Jawabanmu aman di perangkat ini. Coba lagi saat tersambung.' });
    } finally { setSubmitting(false); }
  };
  useEffect(() => { if (s && !result && left === 0 && data && !autoSubmitted.current && new Date(s.deadline).getTime() <= Date.now() + offset.current) { autoSubmitted.current = true; submit(true); } }, [left]); // eslint-disable-line react-hooks/exhaustive-deps

  const qs = s?.questions || [];
  const q = qs[cur];
  useEffect(() => { const c = cardRef.current; if (c) { c.classList.remove('scene-enter'); void c.offsetWidth; c.classList.add('scene-enter'); } }, [cur]);
  const empty = useMemo(() => qs.map((x, i) => (answers[x.id] === undefined ? i + 1 : 0)).filter(Boolean), [qs, answers]);

  if (error && !(error instanceof ApiError && error.status === 409)) return <PlayerShell phase="uji"><div className="player-error"><LoadError onRetry={() => location.reload()} /></div></PlayerShell>;
  if (!data || !s) return <PlayerShell phase="uji"><header className="player-top"><span /><Skel h={30} w={300} style={{ justifySelf: 'center' }} /><span /></header><div className="exam"><Skel h={320} r={20} /><Skel h={420} r={20} /></div></PlayerShell>;

  if (result?.result) return <ExamResult id={id!} res={result} header={data} />;

  const low = left <= 300, critical = left <= 60;
  const center = <div className="row gap-3" style={{ justifySelf: 'center' }}><PhaseTag><Icon name="lock" size={14} />Ulangan<span className="hide-sm">&nbsp;· Bab {data.chapter.number} {data.chapter.title}</span></PhaseTag><span className="t-sm t-faint hide-sm">{qs.length} soal · lulus ≥ {s.pass_mark}</span></div>;
  const right = <div className="row gap-3"><span className={cx('timer-big', low && !critical && 'is-low', critical && 'is-critical')} role="timer" aria-label={`Sisa waktu ${fmt(left)}`}><Icon name="timer" size={20} /><span>{fmt(left)}</span></span></div>;

  return (
    <PlayerShell phase="uji">
      <PlayerTop exitTo={`/bab/${id}`} center={center} right={right} />
      <div className="exam">
        <aside className="qnav" aria-label="Navigasi soal">
          <div className="row between"><span className="eyebrow">Soal</span><span className="t-xs t-mono t-faint">{Object.keys(answers).length} / {qs.length} dijawab</span></div>
          <div className="qgrid">
            {qs.map((x, j) => (
              <button key={x.id} className={cx('qn', answers[x.id] !== undefined && 'is-answered', j === cur && 'is-current', flags.includes(x.id) && 'is-flag')} onClick={() => setCur(j)} aria-label={`Soal ${j + 1}${answers[x.id] !== undefined ? ', dijawab' : ''}${flags.includes(x.id) ? ', ditandai' : ''}`}>{j + 1}</button>
            ))}
          </div>
          <div className="legend"><span><i style={{ background: 'var(--uji-soft)', borderColor: 'var(--uji-line)' }} />Dijawab</span><span><i style={{ borderColor: 'var(--uji-fill)' }} />Sekarang</span><span><i style={{ background: 'var(--kuis-fill)', borderRadius: '50%', border: 0 }} />Ditandai untuk dicek</span></div>
          <hr style={{ margin: '18px 0' }} />
          <div className="t-xs t-muted" style={{ lineHeight: 1.6 }}><Icon name="shield" size={14} style={{ display: 'inline', verticalAlign: -2 }} /> Mode ulangan: petunjuk dan penjelasan <b>dimatikan</b>. Jawaban tersimpan otomatis.</div>
        </aside>
        <main style={{ minWidth: 0 }}>
          {!online && <div className="conn" role="status"><Icon name="wifi-off" size={14} /><span><b>Koneksi terputus.</b> Jawabanmu aman di perangkat ini dan akan dikirim saat tersambung lagi. Waktu tetap berjalan.</span></div>}
          {low && empty.length > 0 && <div className="callout callout-warning mb-4" role="alert"><Icon name="alarm-clock" /><div className="t-sm"><b>Sisa {Math.ceil(left / 60)} menit.</b> Soal {empty.join(', ').replace(/, (\d+)$/, ' dan $1')} masih kosong.</div></div>}
          <section className="scene" ref={cardRef}>
            <div className="row between"><span className="eyebrow">Soal {cur + 1} dari {qs.length} · {q.pts} poin</span>
              <button className={cx('btn btn-sm', flags.includes(q.id) ? 'btn-secondary' : 'btn-ghost')} onClick={() => toggleFlag(q.id)} aria-pressed={flags.includes(q.id)}><Icon name="flag" />{flags.includes(q.id) ? 'Ditandai' : 'Tandai'}</button></div>
            <Html as="h2" className="q-title" html={q.t} />
            {q.code && <div className="codecard mt-4"><div className="cc-body">{q.code.split('\n').map((l, j) => <div className="cc-line" key={j}><span className="cc-ln">{j + 1}</span><span dangerouslySetInnerHTML={{ __html: highlightLine(l) }} /></div>)}</div></div>}
            {q.type === 'choice' && (
              <div className="choices mt-2" role="radiogroup">
                {q.o!.map((o, j) => <button key={j} className={cx('choice', answers[q.id] === j && 'is-picked')} role="radio" aria-checked={answers[q.id] === j} onClick={e => { answer(q.id, j, 0); pop(e.currentTarget); }}><span className="key">{'ABCD'[j]}</span><span className="code">{o}</span></button>)}
              </div>
            )}
            {q.type === 'short' && (
              <div className="mt-6"><div className="t-mono t-sm t-faint mb-2">{q.pre}</div>
                <input className="short-input" placeholder="ketik kata yang hilang" value={String(answers[q.id] ?? '')} onChange={e => answer(q.id, e.target.value)} aria-label="Jawaban" /></div>
            )}
            {q.type === 'code' && (
              <>
                <textarea className="mini-code mt-6" spellCheck={false} aria-label="Kode" value={String(answers[q.id] ?? '')} onChange={e => answer(q.id, e.target.value)}
                  onKeyDown={e => { if (e.key === 'Tab') { e.preventDefault(); const t = e.currentTarget; const p = t.selectionStart; t.setRangeText('  ', p, t.selectionEnd, 'end'); answer(q.id, t.value); } }} />
                <p className="t-xs t-faint mt-2">Kode diuji otomatis setelah dikumpulkan. Tidak ada tombol jalankan selama ulangan.</p>
              </>
            )}
          </section>
          <div className="row between mt-4">
            <button className="btn btn-secondary btn-lg btn-press" disabled={cur === 0} onClick={() => setCur(c => c - 1)}><Icon name="arrow-left" />Sebelumnya</button>
            <SaveState state={save === 'saved' || save === 'idle' ? 'idle' : save} idle="Tersimpan" icon="check" />
            <button className="btn btn-secondary btn-lg btn-press" disabled={cur === qs.length - 1} onClick={() => setCur(c => c + 1)}>Berikutnya<Icon name="arrow-right" /></button>
          </div>
        </main>
      </div>
      <PlayerFoot>
        <div className="fb-idle"><Icon name="info" size={14} /><span>Kamu bisa kembali ke soal mana pun sebelum mengumpulkan.</span></div>
        <button className={cx('btn btn-no btn-xl btn-press', submitting && 'is-loading')} onClick={() => setConfirm(true)}>Kumpulkan<Icon name="send" /></button>
      </PlayerFoot>
      <Modal open={confirm} onClose={() => setConfirm(false)} title="Kumpulkan ulangan?" role="alertdialog"
        foot={<><button className="btn btn-ghost" onClick={() => setConfirm(false)}>Cek lagi</button><button className="btn btn-no btn-press" onClick={() => submit()}>Ya, kumpulkan</button></>}>
        <p>
          {empty.length ? <><b style={{ color: 'var(--text)' }}>{empty.length} soal belum dijawab</b> ({empty.join(', ')}){flags.length ? `, dan ${flags.length} soal ditandai` : ''}. </> : flags.length ? <><b style={{ color: 'var(--text)' }}>{flags.length} soal ditandai</b> untuk dicek. </> : 'Semua soal sudah dijawab. '}
          Setelah dikumpulkan, jawaban tidak bisa diubah.
        </p>
      </Modal>
    </PlayerShell>
  );
}

function ExamResult({ id, res, header }: { id: string; res: SubmitRes; header: PlayerHeader }) {
  const scoreRef = useRef<HTMLSpanElement>(null);
  const r = res.result!;
  useEffect(() => {
    ticker(scoreRef.current, r.score, { from: 0, dur: 1400 });
    if (r.passed) { const t = setTimeout(() => { confetti(); sound('done'); }, 900); return () => clearTimeout(t); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const center = <div className="row gap-3" style={{ justifySelf: 'center' }}><PhaseTag>Ulangan · Bab {header.chapter.number}</PhaseTag></div>;
  return (
    <PlayerShell phase="uji">
      <PlayerTop exitTo={`/bab/${id}`} center={center} right={<span />} />
      <div className="stage-wrap"><div className="stage">
        <section className="scene scene-enter">
          <div className="t-center">
            <Nosi size="lg" mood={r.passed ? 'cheer' : 'think'} />
            <div className="eyebrow mt-3">Ulangan terkirim · {r.used} digunakan</div>
            <div className="score-num mt-2"><span ref={scoreRef}>0</span><span className="t-faint" style={{ fontSize: '.35em' }}>/100</span></div>
            {r.passed
              ? <span className="badge badge-success mt-3" style={{ height: 26, fontSize: 13 }}><Icon name="check" />Lulus · minimal {res.pass_mark}</span>
              : <span className="badge badge-warning mt-3" style={{ height: 26, fontSize: 13 }}><Icon name="rotate-ccw" />Belum lulus · minimal {res.pass_mark}</span>}
          </div>
          {res.chapter_done && res.next_chapter && (
            <div className="callout callout-success mt-6"><Icon name="lock-open" /><div className="t-sm"><b>Bab {header.chapter.number} selesai.</b> {res.next_chapter.published ? <>Bab {res.next_chapter.number} · {res.next_chapter.title} sekarang terbuka.</> : <>Bab {res.next_chapter.number} · {res.next_chapter.title} sedang disiapkan.</>} +{res.xp} XP</div></div>
          )}
          <div className="mt-8">
            {r.rows.map(row => (
              <div className={cx('res-row', row.ok ? 'ok' : 'no')} key={row.n}>
                <span className="ri"><Icon name={row.ok ? 'check' : 'x'} size={14} /></span>
                <span className="t-sm"><Html html={`${row.n} · ${row.label}`} />{row.note && <Html as="div" className="t-xs t-faint mt-1" html={row.note} />}</span>
                <span className="t-mono t-xs">{row.pts}/{row.max}</span>
              </div>
            ))}
          </div>
          <div className="row gap-2 mt-8 wrap">
            <Link className="btn btn-secondary btn-xl btn-press grow" to="/progres">Lihat progres</Link>
            {!r.passed && <Link className="btn btn-phase btn-xl btn-press grow" data-phase="uji" to={`/bab/${id}#uji`}><Icon name="rotate-ccw" />Coba lagi atau Challenge</Link>}
            {r.passed && <Link className="btn btn-primary btn-xl btn-press grow" to={res.next_chapter?.published ? `/bab/${res.next_chapter.id}` : '/peta'}>{res.next_chapter?.published ? `Bab ${res.next_chapter.number} · ${res.next_chapter.title}` : 'Kembali ke peta'}<Icon name="arrow-right" /></Link>}
          </div>
        </section>
      </div></div>
    </PlayerShell>
  );
}

import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import '../player/player.css';
import { api, ApiError } from '../api/client';
import { useApi, useRefreshMe } from '../api/hooks';
import type { ChapterRef, PhaseMeta, PlayerHeader } from '../api/types';
import { CodeEditor } from '../code/CodeEditor';
import { TestRobots, type Robot } from '../code/TestRobots';
import { Icon } from '../design/Icon';
import { Nosi, type Mood } from '../design/Nosi';
import { PhaseRing } from '../design/PhaseRing';
import { toast } from '../design/toast';
import { cx, LoadError, PhaseTag, SaveState, Skel } from '../design/ui';
import { burst, confetti, motion, shake, sound, ticker } from '../fx';
import { Html } from '../lib/html';
import { useAutosave, useHeartbeat, useLockRedirect } from '../lib/hooks';
import { DoneOverlay, PhaseBar, PlayerShell, PlayerTop } from '../player/Player';

type Challenge = { title: string; minutes: number; difficulty: string; filename: string; story: string; steps: string[]; starter: string;
  art?: { kind: string; title: string; name: string; value: string }; tests: { id: string; name: string; hidden: boolean }[] };
type Data = PlayerHeader & { challenge: Challenge; code: string; attempts: number; solved: boolean; mentor: string | null; kuis_score: number | null };
type RunErr = { name: string; message: string; line: number | null } | null;
type Outcome = { passed: number; total: number; all_pass: boolean; attempt: number; chapter_done: boolean; xp: number; next_chapter?: ChapterRef | null; mastery?: number; xp_week?: number };
type Event = { type: 'queued'; tests: string[]; logs: string[]; error: RunErr } | { type: 'running'; id: string } | { type: 'result'; id: string; pass: boolean; detail: string; ms: number; name?: string }
  | ({ type: 'done' } & Outcome) | { type: 'error'; message: string };

const wait = (ms: number) => new Promise(r => setTimeout(r, motion() === 'off' ? 0 : ms));

function StoryArt({ art }: { art?: Challenge['art'] }) {
  const a = art || { title: 'CHALLENGE', name: 'program', value: '?' };
  return (
    <svg viewBox="0 0 360 150" preserveAspectRatio="xMidYMid slice">
      <rect x="95" y="28" width="170" height="92" rx="14" fill="var(--surface)" stroke="var(--uji-line)" strokeWidth="2" />
      <rect x="95" y="28" width="170" height="26" rx="14" fill="var(--uji-fill)" /><rect x="95" y="44" width="170" height="10" fill="var(--uji-fill)" />
      <text x="180" y="46" textAnchor="middle" fontFamily="Geist Variable, Geist, sans-serif" fontSize="12" fontWeight="700" fill="#fff">{a.title}</text>
      <text x="120" y="96" fontFamily="JetBrains Mono, monospace" fontSize="15" fill="var(--text)">{a.name}</text>
      <text x="238" y="100" textAnchor="end" fontFamily="Newsreader Variable, Newsreader, serif" fontSize="34" fill="var(--uji-ink)">{a.value}</text>
      <circle cx="60" cy="110" r="8" fill="var(--kuis-fill)" opacity=".5"><animate attributeName="cy" values="110;100;110" dur="3s" repeatCount="indefinite" /></circle>
      <circle cx="305" cy="40" r="6" fill="var(--pahami-fill)" opacity=".45"><animate attributeName="cy" values="40;50;40" dur="4s" repeatCount="indefinite" /></circle>
      <rect x="290" y="96" width="14" height="14" rx="3" fill="var(--perkuat-fill)" opacity=".45" transform="rotate(20 297 103)" />
    </svg>
  );
}

export default function ChallengePage() {
  const { id } = useParams();
  const qc = useQueryClient();
  const refreshMe = useRefreshMe();
  const q = useApi<Data>(`/api/chapters/${id}/challenge`, { staleTime: 0 });
  useLockRedirect(q.error);
  useHeartbeat(Number(id));
  const d = q.data;
  const [code, setCode] = useState<string | null>(null);
  const [robots, setRobots] = useState<Robot[]>([]);
  const [logs, setLogs] = useState<string[] | null>(null);
  const [err, setErr] = useState<RunErr>(null);
  const [running, setRunning] = useState(false);
  const [mood, setMood] = useState<Mood>('think');
  const [bump, setBump] = useState(0);
  const [attempt, setAttempt] = useState(1);
  const [done, setDone] = useState<Outcome | null>(null);
  const [progress, setProgress] = useState(0.4);
  const cardRef = useRef<HTMLDivElement>(null);
  const runBtn = useRef<HTMLButtonElement>(null);
  const ws = useRef<WebSocket | null>(null);
  const [saveState, scheduleSave] = useAutosave<string>(c => api.put(`/api/chapters/${id}/challenge/draft`, { code: c }), 700);

  useEffect(() => {
    if (!d) return;
    setCode(c => c ?? d.code);
    setRobots(d.challenge.tests.map(t => ({ id: t.id, name: t.name, hidden: t.hidden, state: 'idle' })));
    setAttempt(d.attempts + 1);
  }, [d]);

  useEffect(() => () => ws.current?.close(), []);

  const connect = () => new Promise<WebSocket>((resolve, reject) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) return resolve(ws.current);
    const sock = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws/challenge/${id}`);
    const t = setTimeout(() => { sock.close(); reject(new Error('timeout')); }, 3000);
    sock.onopen = () => { clearTimeout(t); ws.current = sock; resolve(sock); };
    sock.onerror = () => { clearTimeout(t); reject(new Error('ws')); };
  });

  /** Plays the robot sequence from server events: each test goes running → pass/fail with a short beat. */
  const play = async (events: Event[]) => {
    let names: Record<string, string> = {};
    for (const ev of events) {
      if (ev.type === 'error') { toast({ kind: 'danger', icon: 'circle-alert', title: 'Tes belum bisa dijalankan', body: ev.message }); return; }
      if (ev.type === 'queued') {
        setErr(ev.error); setLogs(ev.logs);
        setRobots(rs => rs.map(r => ({ ...r, state: 'queued', detail: undefined })));
      }
      if (ev.type === 'running') { setRobots(rs => rs.map(r => (r.id === ev.id ? { ...r, state: 'running' } : r))); await wait(420); }
      if (ev.type === 'result') {
        if (ev.name) names = { ...names, [ev.id]: ev.name };
        setRobots(rs => rs.map(r => (r.id === ev.id ? { ...r, name: r.hidden ? (names[ev.id] || r.name) : r.name, state: ev.pass ? 'pass' : 'fail', ms: ev.ms, detail: ev.detail } : r)));
      }
      if (ev.type === 'done') {
        setProgress(0.4 + (ev.passed / Math.max(1, ev.total)) * 0.6);
        setAttempt(ev.attempt + 1);
        if (ev.all_pass) {
          setMood('cheer'); setBump(b => b + 1); burst(runBtn.current); sound('ok');
          if (ev.chapter_done || ev.xp) setTimeout(() => setDone(ev), 700);
          else toast({ kind: 'success', icon: 'check', title: 'Semua tes lulus', body: 'Challenge ini sudah pernah kamu selesaikan.' });
          qc.invalidateQueries({ queryKey: [`/api/chapters/${id}`] });
          refreshMe();
        } else { setMood('oops'); setBump(b => b + 1); sound('no'); shake(cardRef.current); }
      }
    }
  };

  const run = async () => {
    if (!d || running || code === null) return;
    setRunning(true);
    try {
      let events: Event[] = [];
      try {
        const sock = await connect();
        events = await new Promise<Event[]>((resolve, reject) => {
          const got: Event[] = [];
          sock.onmessage = m => { const ev = JSON.parse(m.data) as Event; got.push(ev); if (ev.type === 'done' || ev.type === 'error') resolve(got); };
          sock.onclose = () => reject(new Error('closed'));
          sock.send(JSON.stringify({ code }));
        });
      } catch {
        // WebSocket unavailable (proxy/offline): same result over HTTP
        const r = await api.post<Outcome & { logs: string[]; error: RunErr; results: { id: string; pass: boolean; detail: string; ms: number; name: string }[] }>(`/api/chapters/${id}/challenge/run`, { code });
        events = [{ type: 'queued', tests: r.results.map(x => x.id), logs: r.logs, error: r.error },
          ...r.results.flatMap(x => [{ type: 'running', id: x.id } as Event, { type: 'result', ...x } as Event]), { type: 'done', ...r }];
      }
      await play(events);
    } catch (e) {
      toast({ kind: 'danger', icon: 'wifi-off', title: 'Tes belum bisa dijalankan', body: e instanceof ApiError ? e.message : 'Periksa koneksi, lalu coba lagi.' });
    } finally { setRunning(false); }
  };

  const report = async (testId: string) => {
    try { await api.post(`/api/chapters/${id}/challenge/report`, { test_id: testId, body: 'Output benar tapi gagal' }); toast({ kind: 'success', icon: 'send', title: 'Laporan terkirim', body: 'Tim kurikulum akan mengecek tes ini.' }); }
    catch { toast({ kind: 'danger', icon: 'circle-alert', title: 'Laporan gagal dikirim' }); }
  };

  if (q.error && !(q.error instanceof ApiError && q.error.status === 409)) return <PlayerShell phase="uji"><div className="player-error"><LoadError onRetry={() => q.refetch()} /></div></PlayerShell>;
  if (!d || code === null) return <PlayerShell phase="uji"><header className="player-top"><span /><Skel h={30} w="100%" style={{ maxWidth: 760, justifySelf: 'center' }} /><span /></header><div className="focus"><Skel h={460} r={20} /><Skel h={460} r={16} /></div></PlayerShell>;
  const ch = d.challenge;
  const bad = err?.line ?? null;

  return (
    <PlayerShell phase="uji">
      <PlayerTop exitTo={`/bab/${id}`} xp={d.xp} mood={mood} bump={bump}
        center={<PhaseBar phases={d.phases as PhaseMeta[]} current="uji" progress={d.solved ? 1 : progress} labels={{ kuis: d.kuis_score != null ? `Kuis ${Math.round(d.kuis_score)}%` : 'Kuis', uji: 'Challenge' }} />} />
      <div className="focus">
        <aside className="brief" aria-label="Brief challenge">
          <div className="story-art" aria-hidden="true"><StoryArt art={ch.art} /></div>
          <div className="row gap-2 wrap"><PhaseTag>Challenge</PhaseTag><span className="badge badge-mono">±{ch.minutes} menit</span><span className="badge badge-mono">percobaan {attempt}</span></div>
          <h1 className="big-serif mt-3" style={{ fontSize: 30 }}>{ch.title}</h1>
          <Html as="p" className="t-muted mt-2" style={{ lineHeight: 1.6 }} html={ch.story} />
          <div className="brief-steps">{ch.steps.map((s, i) => <div key={i}><Html html={s} /></div>)}</div>
          <div className="lock-note"><Icon name="lock" size={14} /><span>Bantuan terkunci selama Uji. Baris error tetap ditandai (L1).</span></div>
        </aside>
        <section className="stack gap-4" style={{ minWidth: 0 }}>
          <div className="codecard" ref={cardRef}>
            <div className="cc-head">
              <span className="cc-file"><span className="lang">JS</span>{ch.filename}</span>
              <span style={{ marginLeft: 'auto' }}><SaveState state={saveState === 'saved' ? 'idle' : saveState} /></span>
              <button className="btn btn-ghost btn-sm" onClick={() => { setCode(ch.starter); scheduleSave(ch.starter); setErr(null); setLogs(null); }}><Icon name="rotate-ccw" />Ulang</button>
            </div>
            <CodeEditor value={code} onChange={v => { setCode(v); setErr(null); scheduleSave(v); }} onRun={run} badLine={bad} minHeight={320} label={`Editor kode ${ch.filename}`} />
            <div className="cc-out" aria-live="polite">
              {logs === null && !err && <span className="t-xs t-faint">Output muncul di sini setelah kamu menjalankan tes.</span>}
              {logs?.map((l, i) => <span className="out-bubble" key={i + l} style={{ animationDelay: `${i * 120}ms` }}><span className="p">›</span>{l}</span>)}
              {err && <span className="out-bubble is-err"><Icon name="circle-x" size={14} />{err.name}: {err.message}{err.line ? ` · baris ${err.line}` : ''}</span>}
              {logs !== null && !logs.length && !err && <span className="t-xs t-faint">Program berjalan tanpa output.</span>}
            </div>
            <div className="cc-foot"><span className="kbdhint hide-sm"><kbd>Ctrl</kbd><kbd>↵</kbd> jalankan</span><span className="grow" />
              <button ref={runBtn} className={cx('btn btn-phase btn-xl btn-press', running && 'is-loading')} onClick={run}><Icon name="play" />Jalankan tes</button></div>
          </div>
          <TestRobots robots={robots} onReport={report} />
        </section>
      </div>
      {done && <ChapterDone id={id!} out={done} chapter={d.chapter} mentor={d.mentor} kuis={d.kuis_score} tests={`${done.passed}/${done.total}`} />}
    </PlayerShell>
  );
}

export function ChapterDone({ id, out, chapter, mentor, kuis, tests }: { id: string; out: Outcome; chapter: ChapterRef; mentor: string | null; kuis: number | null; tests: string }) {
  const xp = useRef<HTMLSpanElement>(null), m = useRef<HTMLSpanElement>(null);
  useEffect(() => { confetti(); sound('done'); ticker(xp.current, out.xp, { from: 0, dur: 1300 }); ticker(m.current, out.mastery ?? 0, { from: 0, dur: 1300 }); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const next = out.next_chapter;
  return (
    <DoneOverlay wide>
      <div className="badge-medal"><PhaseRing values={[1, 1, 1, 1]} size={132} stroke={9} /><Nosi size="lg" mood="cheer" style={{ width: 84, height: 84 }} /></div>
      <div className="eyebrow mt-4">Bab {chapter.number} selesai · 4 dari 4 fase</div>
      <h2 className="big-serif mt-2" style={{ fontSize: 44 }}>{chapter.title}: <em>dikuasai</em>.</h2>
      <p className="t-muted mt-3">Pahami → Perkuat → Kuis{kuis != null ? ` ${Math.round(kuis)}%` : ''} → Challenge {tests}.{mentor ? ` Mentor kamu, ${mentor}, akan melihat kode ini.` : ''}</p>
      <div className="row center gap-6 mt-6">
        <div className="stat"><span className="t-label">XP bab ini</span><span className="stat-value" style={{ color: 'var(--xp)' }}>+<span ref={xp}>0</span></span></div>
        <div className="stat"><span className="t-label">Penguasaan</span><span className="stat-value"><span ref={m}>0</span><small>%</small></span></div>
      </div>
      <div className="row gap-2 mt-8">
        <Link className="btn btn-secondary btn-xl btn-press grow" to="/peta">Lihat peta</Link>
        {next?.published
          ? <Link className="btn btn-primary btn-xl btn-press grow" to={`/bab/${next.id}`}>Bab {next.number} · {next.title}<Icon name="arrow-right" /></Link>
          : <Link className="btn btn-primary btn-xl btn-press grow" to={`/bab/${id}`}>{next ? `Bab ${next.number} segera hadir` : 'Kembali ke bab'}<Icon name="arrow-right" /></Link>}
      </div>
    </DoneOverlay>
  );
}

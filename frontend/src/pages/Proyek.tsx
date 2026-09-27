import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../api/client';
import { useApi } from '../api/hooks';
import type { Person } from '../api/types';
import { CodeEditor } from '../code/CodeEditor';
import { TestRobots, type Robot } from '../code/TestRobots';
import { Icon } from '../design/Icon';
import { toast } from '../design/toast';
import { Avatar, cx, EmptyState, LoadError, Modal, SaveState, Skel } from '../design/ui';
import { burst, confetti } from '../fx';
import { Html } from '../lib/html';
import { useAutosave, useHeartbeat, useLockRedirect } from '../lib/hooks';

type ProjectList = { id: number; title: string; number: number; unlocked: boolean; after: number; status: string | null; milestone: number; milestones: number }[];
type Project = {
  id: number; title: string; number: number; after: number; description: string; status: 'work' | 'waiting' | 'feedback' | 'portfolio'; milestone: number;
  milestones: { title: string; topic: string; state: 'done' | 'now' | 'next'; meta: string }[];
  current: { index: number; title: string; reqs: { text: string; done: boolean }[]; tests: { id: string; name: string; state: 'idle' | 'pass' | 'fail'; ms?: number; detail?: string }[]; filename: string };
  code: string; logs: string[]; error: { name: string; message: string; line: number | null } | null;
  thread: { id: number; author: Person; me: boolean; body: string; ago: string }[];
  comments: { line: number; body: string; author: Person }[]; new_comments: number; mentor: Person | null; learner: Person;
  portfolio: { published: boolean; summary: { headline?: string; caption?: string; pct?: number; warning?: string } };
};

/* from mockups/proyek.html */
const css = `
.proj-head { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 24px; align-items: end; }
.milestones { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0; margin-top: 28px; position: relative; }
.ms { position: relative; display: flex; flex-direction: column; align-items: center; gap: 10px; text-align: center; padding: 0 8px; }
.ms::before { content: ""; position: absolute; top: 22px; left: -50%; right: 50%; height: 3px; background: var(--border); z-index: 0; }
.ms:first-child::before { display: none; }
.ms.is-done::before, .ms.is-now::before { background: var(--mode-project); }
.ms .dot2 { position: relative; z-index: 1; width: 46px; height: 46px; border-radius: 50%; display: grid; place-items: center; background: var(--surface); border: 2px solid var(--border-strong); color: var(--text-faint); font-family: var(--font-mono); font-weight: 700; }
.ms.is-done .dot2 { background: var(--mode-project); border-color: var(--mode-project); color: #fff; }
.ms.is-now .dot2 { border-color: var(--mode-project); color: var(--mode-project); box-shadow: 0 0 0 6px color-mix(in srgb, var(--mode-project) 14%, transparent); }
.ms .t-sm { font-weight: 600; }
.proj { display: grid; grid-template-columns: 360px minmax(0, 1fr); gap: 28px; margin-top: 36px; }
.thread { display: flex; flex-direction: column; gap: 12px; }
.msg { display: grid; grid-template-columns: 32px 1fr; gap: 10px; }
.msg .bub { padding: 12px 14px; border-radius: 4px 16px 16px 16px; background: var(--surface); border: 1px solid var(--border); font-size: 14px; line-height: 1.55; }
.msg.is-me .bub { background: var(--pahami-soft); border-color: var(--pahami-line); }
.line-cmt { margin: 6px 14px; padding: 10px 12px; border-radius: 12px; background: var(--surface); border: 1px solid var(--accent-line); border-left: 3px solid var(--accent); font-family: var(--font-sans); font-size: 13px; white-space: normal; display: flex; gap: 10px; animation: rise 500ms var(--spring-gentle) both; }
.portfolio { border-radius: 24px; overflow: hidden; border: 1px solid var(--border); background: var(--surface); }
.portfolio .shot { height: 220px; background: var(--surface-sunken); display: grid; place-items: center; border-bottom: 1px solid var(--border); }
.app-mock { width: 260px; padding: 18px; border-radius: 18px; background: var(--surface); border: 1px solid var(--border); box-shadow: 0 20px 40px -24px rgba(0,0,0,.3); }
.proj-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 14px; }
@media (max-width: 1000px) { .proj, .proj-head { grid-template-columns: 1fr; } .milestones { grid-template-columns: repeat(2, 1fr); row-gap: 20px; } .ms::before { display: none; } }
`;

export default function Proyek() {
  const { projectId } = useParams();
  const list = useApi<ProjectList>(!projectId ? '/api/projects' : null);
  if (!projectId) {
    if (list.error) return <main className="page"><LoadError onRetry={() => list.refetch()} /></main>;
    if (!list.data) return <main className="page"><Skel h={44} w={300} /><Skel h={160} r={20} className="mt-6" /></main>;
    const open = list.data.filter(p => p.unlocked);
    if (open.length === 1) return <Navigate to={`/proyek/${open[0].id}`} replace />;
    return (
      <main className="page"><style>{css}</style>
        <div className="page-head"><div><div className="eyebrow">Proyek</div><h1 className="big-serif mt-2" style={{ fontSize: 44 }}>Bangun sesuatu yang <em>nyata</em>.</h1><p className="t-muted mt-2">Proyek menggabungkan beberapa bab, direview mentor, lalu masuk portofolio.</p></div></div>
        {list.data.length ? (
          <div className="proj-list">
            {list.data.map(p => p.unlocked ? (
              <Link key={p.id} className="card card-pad is-hover" to={`/proyek/${p.id}`} data-tilt>
                <span className="badge badge-mono">PROYEK {p.number}</span><div className="t-h3 mt-3">{p.title}</div>
                <div className="t-sm t-muted mt-1">{p.status === 'portfolio' ? 'Terbit di portofolio' : `Milestone ${p.milestone + 1} dari ${p.milestones}`}</div>
              </Link>
            ) : (
              <div key={p.id} className="card card-pad" style={{ borderStyle: 'dashed', opacity: .7 }}>
                <span className="badge badge-mono">PROYEK {p.number}</span><div className="t-h3 mt-3 t-muted">{p.title}</div>
                <div className="t-sm t-faint mt-1 row gap-1"><Icon name="lock" size={14} />Terbuka setelah Bab {p.after}</div>
              </div>
            ))}
          </div>
        ) : <div className="card"><EmptyState icon="folder-kanban" title="Belum ada proyek">Proyek akan muncul di sini.</EmptyState></div>}
      </main>
    );
  }
  return <ProjectView id={projectId} />;
}

function ProjectView({ id }: { id: string }) {
  const qc = useQueryClient();
  const q = useApi<Project>(`/api/projects/${id}`, { staleTime: 0 });
  useLockRedirect(q.error);
  useHeartbeat(null);
  const [p, setP] = useState<Project | null>(null);
  const [code, setCode] = useState('');
  const [running, setRunning] = useState(false);
  const [msg, setMsg] = useState('');
  const [askReview, setAskReview] = useState(false);
  const [reviewMsg, setReviewMsg] = useState('');
  const reviewBtn = useRef<HTMLButtonElement>(null);
  const [save, schedule] = useAutosave<string>(c => api.put(`/api/projects/${id}/code`, { code: c }), 700);
  useEffect(() => { if (q.data) { setP(q.data); setCode(q.data.code); } }, [q.data]);
  useEffect(() => { if (q.data?.status === 'portfolio') confetti(); }, [q.data?.status]);
  if (q.error && !(q.error instanceof ApiError && q.error.status === 409)) return <main className="page"><LoadError onRetry={() => q.refetch()} /></main>;
  if (!p) return <main className="page"><Skel h={48} w={380} /><Skel h={80} r={16} className="mt-6" /><div className="proj"><Skel h={360} r={16} /><Skel h={360} r={16} /></div></main>;
  const locked = p.status === 'waiting' || p.status === 'portfolio';
  const mentorName = p.mentor?.name.split(' ')[0] || 'Mentor';
  const robots: Robot[] = p.current.tests.map(t => ({ id: t.id, name: t.name, state: t.state === 'idle' ? 'idle' : t.state, ms: t.ms, detail: t.detail }));
  const words = p.title.split(' ');

  const run = async () => {
    setRunning(true);
    try { const r = await api.post<Project>(`/api/projects/${id}/run`, { code }); setP(r); }
    catch { toast({ kind: 'danger', icon: 'circle-alert', title: 'Gagal menjalankan', body: 'Periksa koneksi, lalu coba lagi.' }); }
    finally { setRunning(false); }
  };
  const requestReview = async () => {
    setAskReview(false);
    try {
      const r = await api.post<Project>(`/api/projects/${id}/review`, { message: reviewMsg });
      burst(reviewBtn.current);
      toast({ kind: 'accent', icon: 'send', title: 'Review diminta', body: `${mentorName} akan menerima notifikasi.` });
      setP(r); setReviewMsg('');
      qc.invalidateQueries({ queryKey: ['/api/home'] });
    } catch (e) { toast({ kind: 'danger', icon: 'circle-alert', title: e instanceof ApiError ? e.message : 'Gagal meminta review' }); }
  };
  const send = async () => {
    if (!msg.trim()) return;
    try { const r = await api.post<Project>(`/api/projects/${id}/messages`, { body: msg }); setP(r); setMsg(''); }
    catch { toast({ kind: 'danger', icon: 'circle-alert', title: 'Pesan belum terkirim' }); }
  };

  return (
    <main className="page">
      <style>{css}</style>
      <div className="proj-head">
        <div>
          <div className="row gap-2"><span className="badge badge-mono">PROYEK {p.number}</span><span className="t-sm t-faint">setelah Bab 1–{p.after} · portofolio</span></div>
          <h1 className="big-serif mt-3" style={{ fontSize: 48 }}>{words.slice(0, 1).join(' ')} <em>{words.slice(1).join(' ')}</em></h1>
          <p className="t-muted mt-2" style={{ maxWidth: '60ch' }}>{p.description}</p>
        </div>
        <div className="row gap-2">
          {(p.status === 'work' || p.status === 'feedback') && <button className="btn btn-secondary btn-lg btn-press" onClick={run}><Icon name="eye" />Pratinjau</button>}
          {(p.status === 'work' || p.status === 'feedback') && <button ref={reviewBtn} className="btn btn-primary btn-lg btn-press" onClick={() => setAskReview(true)}><Icon name="send" />Minta review mentor</button>}
          {p.status === 'waiting' && <span className="badge badge-accent" style={{ height: 36, padding: '0 14px', fontSize: 13 }}><Icon name="hourglass" />Menunggu review {mentorName}</span>}
        </div>
      </div>

      <div className="milestones" aria-label="Milestone">
        {p.milestones.map((m, i) => (
          <div key={i} className={cx('ms', m.state === 'done' && 'is-done', m.state === 'now' && 'is-now')}>
            <span className="dot2">{m.state === 'done' ? <Icon name="check" size={20} /> : i + 1}</span>
            <span className="t-sm">{m.title}</span><span className="t-xs t-faint">{m.topic} · {m.meta}</span>
          </div>
        ))}
      </div>

      {p.status === 'portfolio' ? (
        <section className="mt-12">
          <div className="portfolio">
            <div className="shot"><div className="app-mock">
              <div className="t-label">{p.portfolio.summary.caption || 'Uang saku minggu ini'}</div>
              <div className="big-serif mt-2" style={{ fontSize: 36 }}>{p.portfolio.summary.headline || 'Rp43.000'}</div>
              <div className="progress progress-lg mt-3"><span style={{ ['--value' as string]: `${p.portfolio.summary.pct ?? 43}%` }} /></div>
              <div className="row between t-xs t-faint mt-2"><span>sisa</span><span>dari Rp100.000</span></div>
              {p.portfolio.summary.warning && <div className="callout callout-warning mt-3" style={{ padding: '8px 10px' }}><Icon name="triangle-alert" /><span className="t-xs">{p.portfolio.summary.warning}</span></div>}
            </div></div>
            <div className="p-6 row between wrap gap-4">
              <div><div className="t-h3">{p.title}</div><div className="t-sm t-muted mt-1">{p.learner.name} · {p.milestones.length} milestone{p.mentor ? ` · direview oleh ${p.mentor.name}` : ''}</div></div>
              <div className="row gap-2"><span className="badge badge-success"><Icon name="check" />Terbit di portofolio</span>
                <button className="btn btn-secondary btn-sm btn-press" onClick={() => navigator.clipboard.writeText(location.href).then(() => toast({ kind: 'success', icon: 'link', title: 'Tautan disalin' }))}><Icon name="link" />Salin tautan</button></div>
            </div>
          </div>
        </section>
      ) : (
        <div className="proj">
          <aside className="stack gap-6">
            <section className="card card-pad">
              <div className="eyebrow">Milestone {p.current.index + 1} · {p.current.title}</div>
              <div className="stack gap-2 mt-3">{p.current.reqs.map((r, i) => <div key={i} className={cx('req', r.done ? 'done' : 'todo')}><Icon name={r.done ? 'circle-check' : 'circle'} /><Html html={r.text} /></div>)}</div>
              <div className="mt-4"><TestRobots robots={robots} /></div>
            </section>
            <section>
              <div className="row between mb-2"><span className="eyebrow">Diskusi dengan mentor</span>{p.new_comments > 0 && <span className="badge badge-accent">{p.new_comments} komentar baru</span>}</div>
              <div className="thread">
                {p.thread.length ? p.thread.map(m => (
                  <div key={m.id} className={cx('msg', m.me && 'is-me')}><Avatar p={m.author} size="sm" /><div className="bub">{m.body}<div className="t-xs t-faint mt-1">{m.ago}</div></div></div>
                )) : <p className="t-sm t-faint">Belum ada diskusi. Tanyakan apa saja ke {mentorName}.</p>}
              </div>
              <div className="row gap-2 mt-3">
                <input className="input" placeholder="Tulis pesan…" aria-label="Pesan untuk mentor" value={msg} onChange={e => setMsg(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') send(); }} />
                <button className="btn btn-secondary btn-icon btn-press" aria-label="Kirim" onClick={send}><Icon name="send" /></button>
              </div>
            </section>
          </aside>
          <section className="stack gap-4" style={{ minWidth: 0 }}>
            <div className="codecard" data-phase="uji">
              <div className="cc-head">
                <span className="cc-file"><span className="lang">JS</span>{p.current.filename}</span>
                <span style={{ marginLeft: 'auto' }}>{locked ? <span className="save-state"><Icon name="lock" size={14} />Terkunci selama review</span> : <SaveState state={save === 'saved' ? 'idle' : save} />}</span>
                <button className={cx('btn btn-phase btn-sm btn-press', running && 'is-loading')} data-phase="uji" onClick={run} style={{ marginLeft: 8 }}><Icon name="play" />Jalankan</button>
              </div>
              <CodeEditor value={code} readOnly={locked} onChange={v => { setCode(v); schedule(v); }} onRun={run} badLine={p.error?.line ?? null} minHeight={320} label={`Kode proyek ${p.current.filename}`} />
              {p.comments.length > 0 && <div style={{ padding: '6px 0', borderTop: '1px solid var(--divider)' }}>
                {p.comments.map((c, i) => <div className="line-cmt" key={i}><Avatar p={c.author} size="sm" /><span><b className="t-mono t-xs">baris {c.line}</b> · {c.body}</span></div>)}
              </div>}
              <div className="cc-out">
                {p.logs.map((l, i) => <span className="out-bubble" key={i + l}><span className="p">›</span>{l}</span>)}
                {p.error && <span className="out-bubble is-err"><Icon name="circle-x" size={14} />{p.error.name}: {p.error.message}{p.error.line ? ` · baris ${p.error.line}` : ''}</span>}
                {!p.logs.length && !p.error && <span className="t-xs t-faint">Tekan Jalankan untuk melihat output dan hasil tes.</span>}
              </div>
            </div>
            {p.status === 'waiting' && <div className="callout callout-accent"><Icon name="hourglass" /><div className="t-sm"><b>Review diminta.</b> {mentorName} biasanya membalas dalam 1 hari. Kamu tetap bisa lanjut belajar bab berikutnya sambil menunggu.</div></div>}
            {p.status === 'feedback' && <div className="callout callout-warning"><Icon name="message-square-code" /><div className="t-sm"><b>{mentorName} minta perbaikan.</b> Baca komentar barisnya, ubah kodenya, lalu minta review lagi.</div></div>}
          </section>
        </div>
      )}
      <Modal open={askReview} onClose={() => setAskReview(false)} title="Minta review mentor?"
        foot={<><button className="btn btn-ghost" onClick={() => setAskReview(false)}>Batal</button><button className="btn btn-primary btn-press" onClick={requestReview}><Icon name="send" />Kirim</button></>}>
        <p>Kode milestone {p.current.index + 1} akan dikunci sampai {mentorName} membalas. Tes dijalankan otomatis saat dikirim.</p>
        <div className="field mt-3"><label className="field-label" htmlFor="rmsg">Pesan untuk mentor <span className="opt">(opsional)</span></label>
          <textarea id="rmsg" className="textarea" placeholder="Misalnya: bagian mana yang masih bikin bingung?" value={reviewMsg} onChange={e => setReviewMsg(e.target.value)} /></div>
      </Modal>
    </main>
  );
}

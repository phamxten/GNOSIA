import { useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { useApi } from '../api/hooks';
import type { ChapterRef, Person } from '../api/types';
import { Icon } from '../design/Icon';
import { PhaseRing } from '../design/PhaseRing';
import { toast } from '../design/toast';
import { Attempts, Avatar, cx, EmptyState, LoadError, Mastery, Modal, PhaseTag, Skel } from '../design/ui';
import { burst, confetti } from '../fx';
import { highlightLine } from '../lib/highlight';
import { Html } from '../lib/html';

type Pattern = {
  phase: string; chapter: string; chapter_id: number; item_id: string; count: number; title: string; type: string; same: boolean; diagnosis: string;
  correct_lines?: string[]; wrong_lines?: { code: string; bad: boolean }[]; picked_line?: number; answer_line?: number; picked?: string | null; answer?: string | null;
};
type Student = {
  learner: Person & { class: string; joined: string; assist_cap: number; email: string; allow_wrong: boolean };
  position: { chapter: ChapterRef | null; phase: string; label: string; ring: number[]; number: number; total?: number };
  badge: { text: string; tone: string }; mastery_avg: number; patterns: Pattern[];
  submissions: { id: number; title: string; status: string; tests: string; attempt: number; ago: string }[];
  timeline: { phase: string; title: string; meta: string; when: string }[];
  concepts: { key: string; name: string; tier: number; weak: boolean }[];
};
type Sub = { id: number; learner: Person; title: string; filename: string; kind: string; code: string; attempt: number; tests: { passed: number; total: number };
  error_line: number | null; status: string; summary: string; comments: { id: number; line: number; body: string; author: Person }[]; ago: string };

const css = `
.st-grid { display: grid; grid-template-columns: minmax(0, 1fr) 300px; gap: 28px; }
.st-head { display: flex; gap: 20px; align-items: center; }
.attempt { display: grid; grid-template-columns: 90px 1fr; gap: 16px; padding: 16px 0; border-top: 1px solid var(--divider); }
.attempt .mini { display: flex; flex-direction: column; gap: 4px; }
.attempt .mini div { font-family: var(--font-mono); font-size: 12px; padding: 5px 10px; border-radius: 8px; border: 1px solid var(--border); background: var(--surface); white-space: pre; }
.attempt .mini div.bad { border-color: var(--uji-line); background: var(--uji-soft); color: var(--uji-ink); }
.attempt .mini div.ok { border-color: var(--perkuat-line); background: var(--perkuat-soft); color: var(--perkuat-ink); }
.review-code { font-family: var(--font-mono); font-size: 14px; line-height: 1.8; background: var(--editor-bg); padding: 14px 0; }
.rline { display: grid; grid-template-columns: 48px 1fr 36px; align-items: center; padding: 0 10px 0 0; cursor: pointer; white-space: pre; }
.rline .ln-no { text-align: right; padding-right: 14px; color: var(--text-faint); font-size: 12px; }
.rline .add { opacity: 0; width: 24px; height: 24px; border-radius: 7px; display: grid; place-items: center; background: var(--accent); color: var(--on-accent); transition: opacity var(--dur-120), transform var(--dur-200) var(--spring-bouncy); }
.rline:hover { background: var(--surface-hover); } .rline:hover .add, .rline:focus-visible .add { opacity: 1; }
.rline.is-bad { background: var(--uji-soft); }
.cbox { margin: 6px 16px 10px 48px; padding: 12px 14px; border-radius: 14px; background: var(--surface); border: 1px solid var(--accent-line); border-left: 3px solid var(--accent); font-family: var(--font-sans); white-space: normal; animation: rise 400ms var(--spring-gentle) both; }
.tl2 { position: relative; padding-left: 28px; }
.tl2::before { content: ""; position: absolute; left: 9px; top: 8px; bottom: 8px; width: 2px; background: var(--border); }
.tl2 .ev { position: relative; padding-bottom: 18px; }
.tl2 .ev::before { content: ""; position: absolute; left: -24px; top: 4px; width: 12px; height: 12px; border-radius: 50%; background: var(--ph-fill); box-shadow: 0 0 0 4px var(--surface); }
.sub-pick { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; }
@media (max-width: 1000px) { .st-grid { grid-template-columns: 1fr; } }
`;

const PHASE_NAME: Record<string, string> = { perkuat: 'Perkuat', kuis: 'Kuis', ulangan: 'Ulangan', pahami: 'Pahami', uji: 'Uji' };

function PatternCard({ p, uid }: { p: Pattern; uid: number }) {
  const [sent, setSent] = useState(false);
  const assign = async () => {
    try { const r = await api.post<{ title: string }>(`/api/mentor/students/${uid}/assign`, { chapter_id: p.chapter_id, kind: 'scene' }); setSent(true); toast({ kind: 'success', icon: 'send', title: 'Terkirim', body: r.title }); }
    catch { toast({ kind: 'danger', icon: 'circle-alert', title: 'Gagal menugaskan' }); }
  };
  const detailed = p.correct_lines && (p.wrong_lines || p.picked_line);
  if (!detailed) return (
    <div className="card card-pad mt-3"><div className="row between"><div><div className="eyebrow">{PHASE_NAME[p.phase] || p.phase} · {p.chapter} · {p.type}</div>
      <Html as="div" className="t-sm mt-1" html={`“${p.title}”${p.picked ? ` · dijawab <span class="t-mono t-danger">${p.picked}</span>` : ''}${p.answer ? ` · seharusnya <span class="t-mono">${p.answer}</span>` : ''}`} /></div>
      <span className="badge">{p.count}× salah</span></div></div>
  );
  return (
    <div className="card card-pad mt-3">
      <div className="row between"><div><div className="eyebrow">{PHASE_NAME[p.phase]} · {p.chapter} · {p.type}</div><Html as="div" className="t-h3 mt-1" html={p.title} /></div><Attempts fails={Math.min(p.count, 8)} total={Math.min(p.count + 1, 8)} /></div>
      <div className="attempt"><div className="t-xs t-faint">Jawaban benar</div><div className="mini">
        {p.correct_lines!.map((l, i) => <div key={i} className={p.answer_line === undefined || p.answer_line === i + 1 ? 'ok' : ''}>{l}</div>)}</div></div>
      <div className="attempt"><div className="t-xs t-faint">Percobaan 1–{p.count}<br />{p.same && <span className="t-danger">pola sama</span>}</div><div className="mini">
        {p.wrong_lines ? p.wrong_lines.map((l, i) => <div key={i} className={l.bad ? 'bad' : ''}>{l.code}</div>)
          : p.correct_lines!.map((l, i) => <div key={i} className={p.picked_line === i + 1 ? 'bad' : ''}>{l}</div>)}</div></div>
      {p.diagnosis && <div className="callout callout-accent mt-2"><Icon name="stethoscope" /><Html as="div" className="t-sm" html={`<b>Diagnosis:</b> ${p.diagnosis}`} /></div>}
      <div className="row gap-2 mt-4"><button className="btn btn-primary btn-press" disabled={sent} onClick={assign}>{sent ? 'Sudah ditugaskan' : 'Tugaskan scene + 3 soal'}</button><Link className="btn btn-ghost" to={`?tab=pesan`}>Tulis pesan sendiri</Link></div>
    </div>
  );
}

function CodeReview({ sid, onDecided }: { sid: number; onDecided: () => void }) {
  const q = useApi<Sub>(`/api/mentor/submissions/${sid}`, { staleTime: 0 });
  const [open, setOpen] = useState<number | null>(null);
  const [text, setText] = useState('');
  const [summary, setSummary] = useState('');
  const approveRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (q.data) setSummary(q.data.summary); }, [q.data?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (q.error) return <LoadError onRetry={() => q.refetch()} />;
  if (!q.data) return <Skel h={320} r={16} />;
  const s = q.data;
  const first = s.learner.name.split(' ')[0];
  const addComment = async (line: number) => {
    if (!text.trim()) { setOpen(null); return; }
    await api.post(`/api/mentor/submissions/${s.id}/comments`, { line, body: text });
    setText(''); setOpen(null); q.refetch();
  };
  const decide = async (decision: 'approve' | 'changes') => {
    try {
      const r = await api.post<{ status: string; xp: number; comments: number }>(`/api/mentor/submissions/${s.id}/decision`, { decision, summary });
      if (decision === 'approve') { burst(approveRef.current); confetti(); toast({ kind: 'success', icon: 'check', title: s.kind === 'challenge' ? 'Challenge disetujui' : 'Milestone disetujui', body: `${first} mendapat ${r.xp ? `+${r.xp} XP dan ` : ''}feedback-mu.` }); }
      else toast({ kind: 'accent', icon: 'rotate-ccw', title: 'Diminta perbaikan', body: `${first} menerima ${r.comments} komentar.` });
      q.refetch(); onDecided();
    } catch { toast({ kind: 'danger', icon: 'circle-alert', title: 'Gagal menyimpan keputusan' }); }
  };
  const chips = ['Nama variabel lebih jelas.', 'Coba pecah jadi fungsi.', 'Kerja bagus!'];
  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <div className="p-5 row between wrap gap-2">
        <div><div className="eyebrow">{s.title}</div><div className="t-h3 mt-1">{s.filename} · percobaan {s.attempt} · {s.tests.passed}/{s.tests.total} tes lulus</div></div>
        {s.status === 'pending' ? (
          <div className="row gap-2"><button className="btn btn-secondary btn-press" onClick={() => decide('changes')}>Minta perbaikan</button><button ref={approveRef} className="btn btn-ok btn-press" onClick={() => decide('approve')}>Setujui</button></div>
        ) : <span className={cx('badge', s.status === 'approved' ? 'badge-success' : 'badge-warning')}>{s.status === 'approved' ? 'Disetujui' : 'Perlu perbaikan'}</span>}
      </div>
      <div className="review-code">
        {s.code.replace(/\n$/, '').split('\n').map((l, i) => {
          const n = i + 1;
          return (
            <div key={i}>
              <div className={cx('rline', s.error_line === n && 'is-bad')} role="button" tabIndex={0} aria-label={`Baris ${n}, tambah komentar`}
                onClick={() => { setOpen(n); setText(''); }} onKeyDown={e => { if (e.key === 'Enter') { setOpen(n); setText(''); } }}>
                <span className="ln-no">{n}</span><span dangerouslySetInnerHTML={{ __html: highlightLine(l) || ' ' }} /><span className="add" title="Tambah komentar"><Icon name="plus" size={14} /></span>
              </div>
              {s.comments.filter(c => c.line === n).map(c => <div className="cbox" key={c.id}><div className="row gap-2"><Avatar p={c.author} size="sm" /><span className="t-sm">{c.body}</span></div></div>)}
              {open === n && (
                <div className="cbox"><textarea className="textarea" style={{ minHeight: 64 }} placeholder={`Komentar untuk baris ${n}…`} autoFocus value={text} onChange={e => setText(e.target.value)} />
                  <div className="row gap-2 mt-2"><button className="btn btn-primary btn-sm btn-press" onClick={() => addComment(n)}>Simpan</button><button className="btn btn-ghost btn-sm" onClick={() => setOpen(null)}>Batal</button></div></div>
              )}
            </div>
          );
        })}
      </div>
      <div className="p-5" style={{ borderTop: '1px solid var(--divider)' }}>
        <div className="field"><label className="field-label" htmlFor="sum">Ringkasan feedback</label>
          <textarea id="sum" className="textarea" placeholder="Apa yang sudah bagus? Apa satu hal yang perlu dicoba berikutnya?" value={summary} onChange={e => setSummary(e.target.value)} disabled={s.status !== 'pending'} /></div>
        {s.status === 'pending' && <div className="row gap-2 mt-3 wrap">{chips.map(c => <button key={c} className="chip" onClick={() => setSummary(x => (x ? `${x.trim()} ${c}` : c))}>+ “{c.replace(/\.$|!$/, '')}”</button>)}</div>}
      </div>
    </div>
  );
}

export default function SiswaPage() {
  const { userId } = useParams();
  const [params, setParams] = useSearchParams();
  const qc = useQueryClient();
  const q = useApi<Student>(`/api/mentor/students/${userId}`, { staleTime: 0 });
  const tab = params.get('tab') || 'wrong';
  const [msgOpen, setMsgOpen] = useState(false);
  const [msg, setMsg] = useState('');
  useEffect(() => { if (tab === 'pesan') { setMsgOpen(true); setParams({}, { replace: true }); } }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps
  if (q.error) return <main className="page page-wide"><LoadError onRetry={() => q.refetch()} /></main>;
  if (!q.data) return <main className="page page-wide"><style>{css}</style><Skel h={72} w={420} /><div className="st-grid mt-8"><Skel h={400} r={16} /><Skel h={400} r={16} /></div></main>;
  const d = q.data, L = d.learner;
  const pending = d.submissions.filter(s => s.status === 'pending');
  const subId = Number(params.get('sub')) || pending[0]?.id || d.submissions[0]?.id;
  const setTab = (t: string) => setParams(t === 'wrong' ? {} : { tab: t }, { replace: true });
  const cap = async (v: number) => { await api.patch(`/api/mentor/students/${L.id}`, { assist_cap: v }); q.refetch(); toast({ kind: 'success', icon: 'shield-check', title: `Batas petunjuk: L${v}` }); };
  const sendMsg = async () => { if (!msg.trim()) return; await api.post(`/api/mentor/students/${L.id}/messages`, { body: msg }); setMsg(''); setMsgOpen(false); toast({ kind: 'accent', icon: 'send', title: `Pesan terkirim ke ${L.name.split(' ')[0]}` }); };
  const assign = async () => { const r = await api.post<{ title: string }>(`/api/mentor/students/${L.id}/assign`, { kind: 'mini' }); toast({ kind: 'success', icon: 'clipboard-check', title: 'Tugas diberikan', body: r.title }); };
  return (
    <main className="page page-wide">
      <style>{css}</style>
      <Link className="link t-sm" to="/mentor">← Kelas {L.class}</Link>
      <div className="st-head mt-4">
        <Avatar p={L} style={{ width: 72, height: 72, fontSize: 22 }} />
        <div className="grow"><h1 className="big-serif" style={{ fontSize: 40 }}>{L.name}</h1>
          <div className="row gap-2 mt-1 wrap"><span className="t-sm t-muted">{L.class} · bergabung {L.joined}</span>
            {d.position.chapter && <PhaseTag phase={d.position.phase}>Bab {d.position.number} · {d.position.chapter.title} · {d.position.label}</PhaseTag>}
            {d.badge.text !== '–' && <span className={cx('badge', d.badge.tone && `badge-${d.badge.tone}`)}>{d.badge.text}</span>}</div></div>
        <div className="row gap-2 hide-sm"><button className="btn btn-secondary btn-lg btn-press" onClick={() => setMsgOpen(true)}><Icon name="message-circle" />Pesan</button><button className="btn btn-primary btn-lg btn-press" onClick={assign}>Beri tugas</button></div>
      </div>

      <div className="st-grid mt-8">
        <div>
          <div className="tabs" role="tablist">
            <button className="tab" role="tab" aria-selected={tab === 'wrong'} onClick={() => setTab('wrong')}>Jawaban salah <span className="count">{d.patterns.length}</span></button>
            <button className="tab" role="tab" aria-selected={tab === 'review'} onClick={() => setTab('review')}>Review kode <span className="count">{pending.length}</span></button>
            <button className="tab" role="tab" aria-selected={tab === 'tl'} onClick={() => setTab('tl')}>Timeline</button>
          </div>
          {tab === 'wrong' && (
            <section className="mt-4">
              {!L.allow_wrong ? <div className="card"><EmptyState icon="shield" title="Disembunyikan oleh siswa">Siswa memilih untuk tidak membagikan jawaban salah.</EmptyState></div>
                : d.patterns.length ? d.patterns.map((p, i) => <PatternCard key={i} p={p} uid={L.id} />)
                  : <div className="card"><EmptyState icon="sparkles" title="Belum ada jawaban salah">Pola jawaban salah akan muncul di sini.</EmptyState></div>}
            </section>
          )}
          {tab === 'review' && (
            <section className="mt-4">
              {d.submissions.length > 1 && <div className="sub-pick">{d.submissions.map(s => <button key={s.id} className="chip" aria-pressed={s.id === subId} onClick={() => setParams({ tab: 'review', sub: String(s.id) }, { replace: true })}>{s.title.split('·').slice(-1)[0].trim()} · {s.status === 'pending' ? 'menunggu' : s.status === 'approved' ? 'disetujui' : 'perbaikan'}</button>)}</div>}
              {subId ? <CodeReview sid={subId} onDecided={() => { q.refetch(); qc.invalidateQueries({ queryKey: ['/api/mentor/overview'] }); }} />
                : <div className="card"><EmptyState icon="message-square-code" title="Belum ada kode untuk direview">Challenge yang lulus dan milestone proyek akan muncul di sini.</EmptyState></div>}
            </section>
          )}
          {tab === 'tl' && (
            <section className="mt-4"><div className="card card-pad tl2">
              {d.timeline.length ? d.timeline.map((e, i) => <div className="ev" data-phase={e.phase} key={i}><b>{e.title}</b> <span className="t-muted">· {e.meta}</span><div className="t-xs t-faint">{e.when}</div></div>) : <p className="t-sm t-faint">Belum ada aktivitas.</p>}
            </div></section>
          )}
        </div>
        <aside className="stack gap-4">
          <section className="card card-pad"><div className="eyebrow">Posisi di jalur</div>
            <div className="row gap-4 mt-3"><PhaseRing values={d.position.ring} size={84} stroke={7} /><div className="t-sm">{d.position.chapter ? `Bab ${d.position.number} dari ${d.position.total ?? '?'}` : 'Semua bab selesai'}<br /><span className="t-muted">Penguasaan rata-rata {d.mastery_avg}%</span></div></div></section>
          <section className="card card-pad"><div className="eyebrow">Konsep</div>
            <div className="stack gap-2 mt-3 t-sm">{d.concepts.map(c => <div className="row between" key={c.key}><span>{c.name}</span><Mastery tier={c.tier} weak={c.weak} /></div>)}{!d.concepts.length && <span className="t-faint">Belum ada data.</span>}</div></section>
          <section className="card card-pad"><div className="eyebrow">Pengaturan bantuan untuk {L.name.split(' ')[0]}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12 }}><span className="t-sm">Batas petunjuk</span>
              <select className="select" style={{ width: 120 }} value={L.assist_cap} onChange={e => cap(Number(e.target.value))} aria-label="Batas petunjuk">
                <option value={6}>L6 (penuh)</option><option value={5}>L5</option><option value={4}>L4</option><option value={3}>L3</option><option value={2}>L2</option></select></div>
            <p className="t-xs t-faint mt-2">Berlaku di Perkuat dan Playground. Kuis dan Uji selalu terkunci.</p></section>
        </aside>
      </div>
      <Modal open={msgOpen} onClose={() => setMsgOpen(false)} title={`Pesan untuk ${L.name.split(' ')[0]}`}
        foot={<><button className="btn btn-ghost" onClick={() => setMsgOpen(false)}>Batal</button><button className="btn btn-primary btn-press" onClick={sendMsg}><Icon name="send" />Kirim</button></>}>
        <textarea className="textarea w-full" style={{ minHeight: 110 }} autoFocus value={msg} onChange={e => setMsg(e.target.value)} placeholder="Tulis dengan hangat dan singkat." aria-label="Pesan" />
      </Modal>
    </main>
  );
}

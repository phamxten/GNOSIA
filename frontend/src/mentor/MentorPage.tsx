import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { api } from '../api/client';
import { useApi } from '../api/hooks';
import type { ChapterRef, Person } from '../api/types';
import { Icon } from '../design/Icon';
import { toast } from '../design/toast';
import { EmptyState, LoadError, Modal, Skel } from '../design/ui';
import { ticker } from '../fx';
import { Html } from '../lib/html';
import { AttentionCard, mentorCss, RosterTable, type RosterRow, type Signal } from './common';

export type Overview = {
  mentor: Person; class: { id: number; name: string }; classes: { id: number; name: string }[]; path: { title: string }; week: number;
  kpis: { active: number; total: number; attention: number; stalled: number; review: number };
  attention: Signal[];
  funnel: { chapter: ChapterRef | null; counts?: Record<string, number>; total?: number; pile?: { phase: string; count: number; avg_days: number } | null; pile_text: string | null };
  hardest: { key: string; name: string; pct: number }[];
  roster: RosterRow[];
};

export function Tick({ to }: { to: number }) {
  const r = useRef<HTMLSpanElement>(null);
  useEffect(() => { ticker(r.current, to, { from: 0, dur: 1000 }); }, [to]);
  return <span ref={r}>0</span>;
}

export function AssignModal({ open, onClose, roster }: { open: boolean; onClose: () => void; roster: RosterRow[] }) {
  const [uid, setUid] = useState<number | ''>('');
  const [kind, setKind] = useState<'mini' | 'scene'>('mini');
  const [note, setNote] = useState('');
  const send = async () => {
    if (!uid) return;
    try {
      const r = await api.post<{ title: string }>(`/api/mentor/students/${uid}/assign`, { kind, note });
      toast({ kind: 'success', icon: 'clipboard-check', title: 'Tugas diberikan', body: r.title });
      onClose(); setNote('');
    } catch { toast({ kind: 'danger', icon: 'circle-alert', title: 'Gagal memberi tugas' }); }
  };
  return (
    <Modal open={open} onClose={onClose} title="Beri tugas"
      foot={<><button className="btn btn-ghost" onClick={onClose}>Batal</button><button className="btn btn-primary btn-press" disabled={!uid} onClick={send}><Icon name="send" />Kirim tugas</button></>}>
      <div className="stack gap-4">
        <div className="field"><label className="field-label" htmlFor="as-u">Siswa</label>
          <select id="as-u" className="select" value={uid} onChange={e => setUid(Number(e.target.value) || '')}><option value="">Pilih siswa…</option>{roster.map(r => <option key={r.learner.id} value={r.learner.id}>{r.learner.name} · {r.chapter}</option>)}</select></div>
        <div className="field"><span className="field-label">Jenis tugas</span>
          <div className="segmented">{([['mini', 'Perkuat mini · 3 soal'], ['scene', 'Ulas scene Pahami']] as const).map(([k, l]) => <button key={k} aria-pressed={kind === k} onClick={() => setKind(k)}>{l}</button>)}</div></div>
        <div className="field"><label className="field-label" htmlFor="as-n">Pesan <span className="opt">(opsional)</span></label><textarea id="as-n" className="textarea" value={note} onChange={e => setNote(e.target.value)} placeholder="Kerjakan pelan-pelan, ya." /></div>
      </div>
    </Modal>
  );
}

export default function MentorPage() {
  const [params, setParams] = useSearchParams();
  const cls = params.get('kelas');
  const q = useApi<Overview>(`/api/mentor/overview${cls ? `?class_id=${cls}` : ''}`);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [assign, setAssign] = useState(false);
  if (q.error) return <main className="page page-wide"><LoadError onRetry={() => q.refetch()} /></main>;
  if (!q.data) return <main className="page page-wide" aria-busy="true"><style>{mentorCss}</style><Skel h={48} w={320} /><div className="kpis mt-8">{[0, 1, 2, 3].map(i => <Skel key={i} h={110} r={18} />)}</div>{[0, 1, 2].map(i => <Skel key={i} h={80} r={18} className="mt-3" />)}</main>;
  const d = q.data, k = d.kpis;
  const counts = d.funnel.counts || {};
  const phases = [['pahami', 'Pahami'], ['perkuat', 'Perkuat'], ['kuis', 'Kuis'], ['uji', 'Uji']] as const;
  return (
    <main className="page page-wide">
      <style>{mentorCss}</style>
      <div className="page-head">
        <div><div className="eyebrow">Mentor · {d.mentor.name}</div><h1 className="big-serif mt-2" style={{ fontSize: 44 }}>Kelas <em>{d.class.name}</em></h1>
          <p className="t-muted mt-2">{k.total} siswa · {d.path.title} · minggu ke-{d.week}</p></div>
        <div className="row gap-2">
          <select className="select" style={{ width: 180 }} aria-label="Kelas" value={d.class.id} onChange={e => setParams({ kelas: e.target.value })}>{d.classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          <button className="btn btn-primary btn-lg btn-press" onClick={() => setAssign(true)}><Icon name="clipboard-plus" />Beri tugas</button>
        </div>
      </div>

      <div className="kpis">
        <div className="kpi"><span className="eyebrow">Siswa aktif minggu ini</span><div className="stat-value mt-2"><Tick to={k.active} /><small>/ {k.total}</small></div></div>
        <div className="kpi is-warn"><span className="eyebrow" style={{ color: 'var(--uji-ink)' }}>Perlu perhatian</span><div className="stat-value mt-2"><Tick to={k.attention} /></div></div>
        <div className="kpi"><span className="eyebrow">Kemungkinan macet</span><div className="stat-value mt-2"><Tick to={k.stalled} /></div><div className="t-xs t-faint">tidak maju &gt; 3 hari</div></div>
        <div className="kpi"><span className="eyebrow">Menunggu review</span><div className="stat-value mt-2"><Tick to={k.review} /></div><div className="t-xs t-faint">challenge &amp; proyek</div></div>
      </div>

      <div className="section-head section"><h2 className="big-serif" style={{ fontSize: 28, margin: 0 }}>Perlu perhatian sekarang</h2><span className="t-sm t-faint">diurutkan dari yang paling butuh bantuan</span></div>
      {d.attention.length ? <div className="stack gap-3">{d.attention.map((s, i) => <AttentionCard key={`${s.learner.id}-${s.kind}-${i}`} s={s} i={i} />)}</div>
        : <div className="card"><EmptyState icon="sparkles" title="Tidak ada yang perlu perhatian">Semua siswa berjalan lancar. Sinyal muncul saat ada yang salah berulang, gagal gerbang, atau macet.</EmptyState></div>}

      <div className="m-two mt-12">
        <section className="card card-pad">
          <div className="row between"><h2 className="t-h3">Posisi kelas{d.funnel.chapter ? ` · Bab ${d.funnel.chapter.number} ${d.funnel.chapter.title}` : ''}</h2><span className="t-xs t-faint">{d.funnel.total ?? 0} siswa</span></div>
          {d.funnel.total ? (
            <div className="funnel" role="img" aria-label={phases.map(([p, l]) => `${l} ${counts[p] || 0}`).join(', ')}>
              {phases.map(([p, l]) => (counts[p] || 0) > 0 && <div key={p} style={{ flexGrow: counts[p], background: `var(--${p}-fill)` }}><b>{counts[p]}</b>{l}</div>)}
            </div>
          ) : <p className="t-sm t-faint mt-3">Belum ada siswa yang mengerjakan bab ini.</p>}
          {d.funnel.pile_text && <div className="callout callout-warning mt-4"><Icon name="triangle-alert" /><Html as="div" className="t-sm" html={d.funnel.pile_text} /></div>}
        </section>
        <section className="card card-pad">
          <h2 className="t-h3">Konsep tersulit minggu ini</h2>
          <div className="mt-3">
            {d.hardest.map(h => (
              <div className="hard" key={h.key}><span>{h.name}</span><div className={`progress ${h.pct >= 50 ? 'is-danger' : h.pct >= 30 ? 'is-warning' : ''}`}><span style={{ ['--value' as string]: `${h.pct}%` }} /></div><span className="t-mono t-xs">{h.pct}%</span></div>
            ))}
            {!d.hardest.length && <p className="t-sm t-faint">Belum cukup data.</p>}
          </div>
          <p className="t-xs t-faint mt-2">% jawaban salah di percobaan pertama, dari Perkuat, Kuis, dan Uji.</p>
        </section>
      </div>

      <section className="card mt-6" id="students" style={{ overflow: 'hidden' }}>
        <div className="p-5 row between wrap gap-3"><h2 className="t-h3">Semua siswa</h2>
          <div className="row gap-2 wrap">
            <div className="input-group" style={{ width: 240 }}><Icon name="search" /><input placeholder="Cari siswa" value={search} onChange={e => setSearch(e.target.value)} aria-label="Cari siswa" /></div>
            <div className="row gap-1" role="radiogroup">{([['all', 'Semua'], ['stalled', 'Macet'], ['review', 'Review']] as const).map(([f, l]) => <button key={f} className="chip" aria-pressed={filter === f} onClick={() => setFilter(f)}>{l}</button>)}</div>
          </div></div>
        <RosterTable rows={d.roster} filter={filter} q={search} />
      </section>
      <AssignModal open={assign} onClose={() => setAssign(false)} roster={d.roster} />
    </main>
  );
}

import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { api } from '../api/client';
import { useApi } from '../api/hooks';
import { Icon } from '../design/Icon';
import { toast } from '../design/toast';
import { cx, EmptyState, LoadError, Modal, Skel } from '../design/ui';
import { iconNames } from '../design/Icon';

type Overview = {
  org: string;
  kpis: { active: number; spark: number[]; published: number; chapters: number; review: number; gate_first_try: number; avg_minutes: number };
  flags: { phase: string; icon: string; title: string; reason: string; href: string }[];
  distribution: Record<string, number>;
  status: { published: number; items: number; review: number; draft: number };
  recent: { id: number; title: string; path: string; summary: string; status: string; kind: string; by: string; ago: string }[];
};

export const adminCss = `
.kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
.kpi { padding: 18px 20px; border-radius: 18px; background: var(--surface); border: 1px solid var(--border); }
.kpi .stat-value { font-size: 36px; }
.spark { width: 100%; height: 36px; margin-top: 6px; }
.spark path { fill: none; stroke: var(--pahami-fill); stroke-width: 2; }
.a-two { display: grid; grid-template-columns: 1.4fr 1fr; gap: 16px; margin-top: 16px; }
.flag-row { display: grid; grid-template-columns: 34px minmax(0, 1fr) auto; gap: 12px; align-items: center; padding: 14px 0; border-top: 1px solid var(--divider); }
.flag-row .fi { width: 34px; height: 34px; border-radius: 10px; display: grid; place-items: center; background: var(--ph-soft); color: var(--ph-ink); }
.phase-dist { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-top: 12px; }
.phase-dist div { padding: 14px; border-radius: 14px; background: var(--ph-soft); }
.phase-dist b { display: block; font-family: var(--font-serif); font-weight: 400; font-size: 28px; color: var(--ph-ink); }
@media (max-width: 1100px) { .kpis { grid-template-columns: 1fr 1fr; } .a-two { grid-template-columns: 1fr; } }
`;

export const STATUS_BADGE: Record<string, [string, string]> = { published: ['badge-success', 'Terbit'], review: ['badge-warning', 'Review'], draft: ['', 'Draft'] };

export function NewChapterModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const nav = useNavigate();
  const [title, setTitle] = useState('');
  const [sub, setSub] = useState('');
  const [icon, setIcon] = useState('box');
  const create = async () => {
    if (!title.trim()) return;
    const r = await api.post<{ id: number }>('/api/admin/chapters', { title, subtitle: sub, icon });
    toast({ kind: 'success', icon: 'plus', title: 'Bab baru dibuat', body: 'Tulis scene, soal, kuis, dan uji, lalu terbitkan.' });
    onClose(); nav(`/admin/bab/${r.id}`);
  };
  return (
    <Modal open={open} onClose={onClose} title="Bab baru"
      foot={<><button className="btn btn-ghost" onClick={onClose}>Batal</button><button className="btn btn-primary btn-press" disabled={!title.trim()} onClick={create}>Buat draft</button></>}>
      <div className="stack gap-4">
        <div className="field"><label className="field-label" htmlFor="nb-t">Judul</label><input id="nb-t" className="input input-lg" value={title} onChange={e => setTitle(e.target.value)} placeholder="Misalnya: Objek" autoFocus /></div>
        <div className="field"><label className="field-label" htmlFor="nb-s">Subjudul</label><input id="nb-s" className="input" value={sub} onChange={e => setSub(e.target.value)} placeholder="properti, method" /></div>
        <div className="field"><label className="field-label" htmlFor="nb-i">Ikon</label><select id="nb-i" className="select" value={icon} onChange={e => setIcon(e.target.value)}>{iconNames.map(n => <option key={n}>{n}</option>)}</select></div>
      </div>
    </Modal>
  );
}

export default function AdminPage() {
  const q = useApi<Overview>('/api/admin/overview');
  const [creating, setCreating] = useState(false);
  if (q.error) return <div className="page page-wide"><LoadError onRetry={() => q.refetch()} /></div>;
  if (!q.data) return <div className="page page-wide" aria-busy="true"><style>{adminCss}</style><Skel h={44} w={380} /><div className="kpis mt-8">{[0, 1, 2, 3].map(i => <Skel key={i} h={110} r={18} />)}</div><Skel h={300} r={16} className="mt-4" /></div>;
  const d = q.data, k = d.kpis;
  const max = Math.max(1, ...k.spark);
  const spark = k.spark.map((v, i) => `${i ? 'L' : 'M'}${(i / Math.max(1, k.spark.length - 1)) * 100} ${28 - (v / max) * 24}`).join(' ');
  return (
    <div className="page page-wide">
      <style>{adminCss}</style>
      <div className="page-head"><div><div className="eyebrow">Admin · {d.org}</div><h1 className="big-serif mt-2" style={{ fontSize: 40 }}>Ringkasan <em>kurikulum</em></h1></div>
        <div className="row gap-2"><a className="btn btn-secondary btn-press" href="/api/admin/export"><Icon name="download" />Ekspor</a><button className="btn btn-primary btn-press" onClick={() => setCreating(true)}><Icon name="plus" />Bab baru</button></div></div>
      <div className="kpis">
        <div className="kpi"><span className="eyebrow">Siswa aktif (7 hari)</span><div className="stat-value mt-2">{k.active}</div><svg className="spark" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true"><path d={spark} /></svg></div>
        <div className="kpi"><span className="eyebrow">Bab terbit</span><div className="stat-value mt-2">{k.published}<small>/ {k.chapters}</small></div><div className="t-xs t-faint mt-2">{k.review} draft menunggu review</div></div>
        <div className="kpi"><span className="eyebrow">Lulus gerbang Kuis</span><div className="stat-value mt-2">{k.gate_first_try}<small>%</small></div><div className="t-xs t-faint mt-2">di percobaan pertama</div></div>
        <div className="kpi"><span className="eyebrow">Rata-rata waktu per bab</span><div className="stat-value mt-2">{k.avg_minutes}<small>mnt</small></div><div className="t-xs t-faint mt-2">target 25–35</div></div>
      </div>
      <div className="a-two">
        <section className="card card-pad">
          <div className="row between"><h2 className="t-h3">Konten yang perlu dicek</h2><span className="t-xs t-faint">dari data jawaban siswa</span></div>
          <div className="mt-2">
            {d.flags.map((f, i) => (
              <div className="flag-row" data-phase={f.phase} key={i}><span className="fi"><Icon name={f.icon} size={14} /></span>
                <div><div className="t-sm t-medium">{f.title}</div><div className="t-xs t-faint">{f.reason}</div></div>
                <Link className="btn btn-secondary btn-sm btn-press" to={f.href}>Buka</Link></div>
            ))}
            {!d.flags.length && <EmptyState icon="circle-check" title="Tidak ada yang mencurigakan">Flag muncul otomatis saat sebuah soal jauh lebih sulit dari rata-rata atau banyak siswa berhenti di satu scene.</EmptyState>}
          </div>
        </section>
        <section className="card card-pad">
          <h2 className="t-h3">Di mana siswa berada sekarang</h2>
          <div className="phase-dist">{(['pahami', 'perkuat', 'kuis', 'uji'] as const).map(p => <div data-phase={p} key={p}><b>{d.distribution[p] ?? 0}</b><span className="t-xs">{p[0].toUpperCase() + p.slice(1)}</span></div>)}</div>
          <div className="eyebrow mt-6 mb-2">Status konten</div>
          <div className="stack gap-2 t-sm">
            <div className="row between"><span className="row gap-2"><span className="dot dot-success" />Terbit</span><span className="t-mono">{d.status.published} bab · {d.status.items.toLocaleString('id-ID')} soal</span></div>
            <div className="row between"><span className="row gap-2"><span className="dot dot-warning" />Menunggu review</span><span className="t-mono">{d.status.review} bab</span></div>
            <div className="row between"><span className="row gap-2"><span className="dot" />Draft</span><span className="t-mono">{d.status.draft} bab</span></div>
          </div>
        </section>
      </div>
      <section className="card mt-4" style={{ overflow: 'hidden' }}>
        <div className="p-5 row between"><h2 className="t-h3">Bab terbaru diubah</h2><Link className="link t-sm" to="/admin/bab">Buka builder</Link></div>
        <div style={{ overflowX: 'auto' }}><table className="table"><thead><tr><th>Bab</th><th>Jalur</th><th>Isi</th><th>Status</th><th>Diubah</th></tr></thead><tbody>
          {d.recent.map(r => (
            <tr key={r.id}><td className="t-medium">{r.kind === 'chapter' ? <Link to={`/admin/bab/${r.id}`}>{r.title}</Link> : r.title}</td><td>{r.path}</td><td className="t-sm t-muted">{r.summary}</td>
              <td><span className={cx('badge', STATUS_BADGE[r.status]?.[0])}>{STATUS_BADGE[r.status]?.[1] || r.status}</span></td><td className="t-sm t-muted">{r.by} · {r.ago}</td></tr>
          ))}
        </tbody></table></div>
      </section>
      <NewChapterModal open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}

import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useApi } from '../api/hooks';
import { Icon } from '../design/Icon';
import { cx, LoadError, Skel } from '../design/ui';
import { NewChapterModal, STATUS_BADGE } from './AdminPage';

type Row = { id: number; number: number; kind: string; title: string; status: string; version: number; path: string; summary: string; ago: string };
const FOCUS: Record<string, string> = { perkuat: 'Bank soal Perkuat', kuis: 'Bank soal Kuis', challenge: 'Challenge', ulangan: 'Ulangan', proyek: 'Proyek' };

/** /admin/bab — every chapter with its content summary; opens the Builder. */
export default function ChapterList() {
  const q = useApi<Row[]>('/api/admin/chapters', { staleTime: 0 });
  const [params] = useSearchParams();
  const focus = params.get('fokus') || '';
  const [creating, setCreating] = useState(false);
  if (q.error) return <div className="page page-wide"><LoadError onRetry={() => q.refetch()} /></div>;
  const rows = (q.data || []).filter(r => (focus === 'proyek' ? r.kind === 'project' : r.kind === 'chapter' || !focus));
  const edit = focus && focus !== 'proyek' ? `?edit=${focus === 'perkuat' ? 'item:1' : focus}` : '';
  return (
    <div className="page page-wide">
      <div className="page-head"><div><div className="eyebrow">Konten{focus ? ` · ${FOCUS[focus] || ''}` : ''}</div><h1 className="big-serif mt-2" style={{ fontSize: 40 }}>Bab &amp; <em>scene</em></h1>
        <p className="t-muted mt-2">{focus && focus !== 'proyek' ? `Pilih bab untuk membuka ${FOCUS[focus]?.toLowerCase()} di builder.` : 'Setiap bab punya draft yang bisa diedit. Siswa melihat versi yang terakhir diterbitkan.'}</p></div>
        <button className="btn btn-primary btn-press" onClick={() => setCreating(true)}><Icon name="plus" />Bab baru</button></div>
      <section className="card" style={{ overflow: 'hidden' }}>
        {!q.data ? <div className="p-5"><Skel h={260} /></div> : (
          <div style={{ overflowX: 'auto' }}><table className="table">
            <thead><tr><th>Bab</th><th>Jalur</th><th>Isi (draft)</th><th>Versi</th><th>Status</th><th>Diubah</th><th /></tr></thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id}>
                  <td className="t-medium">{r.kind === 'chapter' ? `${r.number} · ${r.title}` : r.title}</td><td>{r.path}</td><td className="t-sm t-muted">{r.kind === 'chapter' ? r.summary : r.kind === 'project' ? '4 milestone · review mentor' : 'ujian akhir'}</td>
                  <td className="num">{r.version ? `v${r.version}` : '–'}</td>
                  <td><span className={cx('badge', STATUS_BADGE[r.status]?.[0])}>{STATUS_BADGE[r.status]?.[1] || r.status}</span></td>
                  <td className="t-sm t-muted">{r.ago}</td>
                  <td>{r.kind === 'chapter' ? <Link className="btn btn-secondary btn-sm btn-press" to={`/admin/bab/${r.id}${edit}`}>Buka</Link> : <span className="t-xs t-faint">segera</span>}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </section>
      <NewChapterModal open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}

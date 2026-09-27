import { Link } from 'react-router';
import { useApi } from '../api/hooks';
import type { Person } from '../api/types';
import { Icon } from '../design/Icon';
import { Avatar, cx, EmptyState, LoadError, Skel } from '../design/ui';

type Queue = { items: { id: number; learner: Person; title: string; status: string; tests: string; attempt: number; ago: string }[] };

/** /mentor/review — challenges and project milestones waiting for feedback. */
export default function ReviewQueue() {
  const q = useApi<Queue>('/api/mentor/review', { staleTime: 0 });
  if (q.error) return <main className="page"><LoadError onRetry={() => q.refetch()} /></main>;
  const pending = q.data?.items.filter(i => i.status === 'pending') || [];
  const done = q.data?.items.filter(i => i.status !== 'pending') || [];
  const row = (i: Queue['items'][number]) => (
    <Link key={i.id} className="list-row is-clickable" to={`/mentor/siswa/${i.learner.id}?tab=review&sub=${i.id}`}>
      <Avatar p={i.learner} /><div className="grow"><div className="t-sm t-medium">{i.learner.name} · {i.title.split('·').slice(1).join('·').trim() || i.title}</div>
        <div className="meta">{i.tests} tes lulus · percobaan {i.attempt} · {i.ago}</div></div>
      <span className={cx('badge', i.status === 'pending' ? 'badge-accent' : i.status === 'approved' ? 'badge-success' : 'badge-warning')}>{i.status === 'pending' ? 'menunggu' : i.status === 'approved' ? 'disetujui' : 'perbaikan'}</span>
      <Icon name="chevron-right" size={14} className="t-faint" />
    </Link>
  );
  return (
    <main className="page">
      <div className="page-head"><div><div className="eyebrow">Antrian review</div><h1 className="big-serif mt-2" style={{ fontSize: 44 }}>Kode yang <em>menunggu</em> feedback.</h1><p className="t-muted mt-2">Challenge yang lulus dan milestone proyek. Beri komentar per baris, lalu setujui atau minta perbaikan.</p></div></div>
      {!q.data ? <Skel h={240} r={16} /> : (
        <>
          <section className="card" style={{ overflow: 'hidden' }}>
            <div className="p-5 row between"><h2 className="t-h3">Menunggu</h2><span className="badge badge-accent">{pending.length}</span></div>
            {pending.length ? <div className="list">{pending.map(row)}</div> : <EmptyState icon="circle-check" title="Antrian kosong">Semua kiriman sudah direview.</EmptyState>}
          </section>
          {done.length > 0 && <section className="card mt-6" style={{ overflow: 'hidden' }}><div className="p-5"><h2 className="t-h3">Sudah direview</h2></div><div className="list">{done.map(row)}</div></section>}
        </>
      )}
    </main>
  );
}

import { useState } from 'react';
import { useApi } from '../api/hooks';
import { Icon } from '../design/Icon';
import { LoadError, Skel } from '../design/ui';
import { mentorCss, RosterTable } from './common';
import type { Overview } from './MentorPage';

/** /mentor/siswa — the full roster with filters. */
export default function RosterPage() {
  const q = useApi<Overview>('/api/mentor/overview');
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  if (q.error) return <main className="page page-wide"><LoadError onRetry={() => q.refetch()} /></main>;
  return (
    <main className="page page-wide">
      <style>{mentorCss}</style>
      <div className="page-head"><div><div className="eyebrow">Siswa</div><h1 className="big-serif mt-2" style={{ fontSize: 44 }}>Kelas <em>{q.data?.class.name ?? '…'}</em></h1><p className="t-muted mt-2">{q.data ? `${q.data.kpis.total} siswa · klik nama untuk detail, pola jawaban salah, dan review kode.` : ''}</p></div></div>
      <section className="card" style={{ overflow: 'hidden' }}>
        <div className="p-5 row between wrap gap-3"><h2 className="t-h3">Semua siswa</h2>
          <div className="row gap-2 wrap">
            <div className="input-group" style={{ width: 240 }}><Icon name="search" /><input placeholder="Cari siswa" value={search} onChange={e => setSearch(e.target.value)} aria-label="Cari siswa" /></div>
            <div className="row gap-1">{([['all', 'Semua'], ['attention', 'Perlu perhatian'], ['stalled', 'Macet'], ['review', 'Review']] as const).map(([f, l]) => <button key={f} className="chip" aria-pressed={filter === f} onClick={() => setFilter(f)}>{l}</button>)}</div>
          </div></div>
        {q.data ? <RosterTable rows={q.data.roster} filter={filter} q={search} /> : <div className="p-5"><Skel h={260} /></div>}
      </section>
    </main>
  );
}

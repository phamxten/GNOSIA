import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import type { Person } from '../api/types';
import { Icon } from '../design/Icon';
import { toast } from '../design/toast';
import { Attempts, Avatar, cx, Mastery, PhaseTag } from '../design/ui';
import { Html } from '../lib/html';

export type Signal = {
  kind: 'repeated' | 'gate' | 'hints' | 'stalled' | 'review'; phase: string; count: number; html: string; pattern: string; ago: string;
  learner: Person; chapter_id?: number; item_id?: string; submission_id?: number;
  action: { label: string; kind: 'assign' | 'mini' | 'cap' | 'remind' | 'review'; value?: number };
};
export type RosterRow = { learner: Person; chapter: string; phase: string; phase_label: string; tier: number; weak: boolean; activity: string; badge: { text: string; tone: string }; flags: string[] };

/** Runs a signal's contextual action (assign help, Perkuat mini, cap hints, reminder, open review). */
export function useSignalAction() {
  const qc = useQueryClient();
  const nav = useNavigate();
  return async (s: Signal) => {
    const uid = s.learner.id, first = s.learner.name.split(' ')[0];
    try {
      if (s.action.kind === 'review') { nav(`/mentor/siswa/${uid}?tab=review${s.submission_id ? `&sub=${s.submission_id}` : ''}`); return; }
      if (s.action.kind === 'cap') { await api.patch(`/api/mentor/students/${uid}`, { assist_cap: s.action.value ?? 3 }); toast({ kind: 'success', icon: 'shield-check', title: `Petunjuk ${first} dibatasi ke L${s.action.value ?? 3}`, body: 'Berlaku di Perkuat dan Playground.' }); }
      if (s.action.kind === 'remind') { await api.post(`/api/mentor/students/${uid}/remind`, {}); toast({ kind: 'accent', icon: 'send', title: `Pengingat terkirim ke ${first}` }); }
      if (s.action.kind === 'assign' || s.action.kind === 'mini') {
        const r = await api.post<{ title: string }>(`/api/mentor/students/${uid}/assign`, { chapter_id: s.chapter_id ?? null, kind: s.action.kind === 'assign' ? 'scene' : 'mini' });
        toast({ kind: 'accent', icon: 'send', title: `Bantuan terkirim ke ${first}`, body: r.title });
      }
      qc.invalidateQueries({ queryKey: ['/api/mentor/overview'] });
    } catch { toast({ kind: 'danger', icon: 'circle-alert', title: 'Aksi gagal', body: 'Coba lagi.' }); }
  };
}

export function AttentionCard({ s, i }: { s: Signal; i: number }) {
  const act = useSignalAction();
  const [busy, setBusy] = useState(false);
  return (
    <div className="attn rise" style={{ animationDelay: `${i * 70}ms` }}>
      <Avatar p={s.learner} size="lg" />
      <div>
        <Html as="div" className="why" html={s.html} />
        <div className="meta">
          <PhaseTag phase={s.phase === 'proyek' ? undefined : s.phase}>{s.phase === 'proyek' ? 'Proyek' : s.phase[0].toUpperCase() + s.phase.slice(1)}</PhaseTag>
          {(s.kind === 'repeated') && <Attempts fails={Math.min(s.count, 8)} />}
          {s.pattern && <span>{s.pattern}</span>}
          <span>· {s.ago}</span>
        </div>
      </div>
      <div className="row gap-2">
        {s.kind !== 'review' && s.kind !== 'stalled' && <Link className="btn btn-secondary btn-press" to={`/mentor/siswa/${s.learner.id}`}>{s.kind === 'hints' ? 'Lihat pola' : 'Lihat jawaban'}</Link>}
        <button className={cx('btn btn-press', s.kind === 'stalled' ? 'btn-secondary' : 'btn-primary', busy && 'is-loading')} onClick={async () => { setBusy(true); await act(s); setBusy(false); }}>{s.action.label}</button>
      </div>
    </div>
  );
}

export function RosterTable({ rows, filter, q }: { rows: RosterRow[]; filter: string; q: string }) {
  const needle = q.trim().toLowerCase();
  const shown = rows.filter(r => (!needle || r.learner.name.toLowerCase().includes(needle))
    && (filter === 'all' || (filter === 'stalled' && r.flags.includes('stalled')) || (filter === 'review' && r.flags.includes('review')) || (filter === 'attention' && r.flags.some(f => f !== 'review'))));
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="table">
        <thead><tr><th>Siswa</th><th>Bab</th><th>Fase</th><th>Penguasaan</th><th>Aktivitas</th><th>Sinyal</th></tr></thead>
        <tbody>
          {shown.map(r => (
            <tr key={r.learner.id}>
              <td><Link className="row" to={`/mentor/siswa/${r.learner.id}`}><Avatar p={r.learner} size="sm" />{r.learner.name}</Link></td>
              <td>{r.chapter}</td>
              <td><PhaseTag phase={r.phase}>{r.phase_label}</PhaseTag></td>
              <td><Mastery tier={r.tier} weak={r.weak} /></td>
              <td className="t-sm t-muted">{r.activity}</td>
              <td><span className={cx('badge', r.badge.tone && `badge-${r.badge.tone}`)}>{r.badge.text}</span></td>
            </tr>
          ))}
          {!shown.length && <tr><td colSpan={6} className="t-center t-faint" style={{ padding: 32 }}>Tidak ada siswa yang cocok.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

export const mentorCss = `
.kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
.kpi { padding: 18px 20px; border-radius: 18px; background: var(--surface); border: 1px solid var(--border); }
.kpi .stat-value { font-size: 40px; }
.kpi.is-warn { background: var(--uji-soft); border-color: var(--uji-line); }
.kpi.is-warn .stat-value { color: var(--uji-ink); }
.attn { display: grid; grid-template-columns: 44px minmax(0, 1fr) auto; gap: 16px; align-items: center; padding: 18px 20px; border-radius: 18px; background: var(--surface); border: 1px solid var(--border); transition: border-color var(--dur-200), transform var(--dur-320) var(--spring-gentle); }
.attn:hover { border-color: var(--border-strong); transform: translateX(3px); }
.attn .why { font-size: 15px; font-weight: 500; }
.attn .meta { font-size: 12px; color: var(--text-faint); margin-top: 4px; display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
.funnel { display: flex; height: 56px; border-radius: 14px; overflow: hidden; margin-top: 16px; }
.funnel > div { display: flex; flex-direction: column; justify-content: center; padding: 0 12px; color: #fff; font-size: 12px; font-weight: 600; min-width: 0; transition: flex-grow var(--dur-600) var(--spring-gentle); overflow: hidden; white-space: nowrap; }
:root[data-theme="ink"] .funnel > div { color: #16171B; }
.funnel > div b { font-family: var(--font-serif); font-weight: 400; font-size: 22px; line-height: 1; }
.hard { display: grid; grid-template-columns: 1fr 140px 44px; gap: 12px; align-items: center; padding: 10px 0; border-top: 1px solid var(--divider); font-size: 14px; }
.m-two { display: grid; grid-template-columns: 1.4fr 1fr; gap: 16px; }
@media (max-width: 1000px) { .kpis { grid-template-columns: 1fr 1fr; } .m-two { grid-template-columns: 1fr; } .attn { grid-template-columns: 44px 1fr; } .attn > .row { grid-column: 1 / -1; } }
`;

export { Icon };

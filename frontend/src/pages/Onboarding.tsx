import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import './auth.css';
import { api } from '../api/client';
import { useApi, useMe } from '../api/hooks';
import type { ChapterRef, Me } from '../api/types';
import { Icon } from '../design/Icon';
import { CodeLines } from '../design/ui';
import { pop } from '../fx';
import { AuthFrame } from './Auth';

const GOALS = [
  ['sekolah', 'school', 'Tugas sekolah', 'Materi RPL / informatika'],
  ['karier', 'briefcase', 'Karier', 'Jadi web developer'],
  ['bikin', 'gamepad-2', 'Bikin sesuatu', 'Game, bot, web sendiri'],
  ['penasaran', 'sparkles', 'Penasaran saja', 'Coba dulu'],
] as const;
const STEPS = ['tujuan', 'cek', 'waktu'] as const;
const KEY = 'gnosia-onboarding';

type Draft = { goal: string; placement: '' | 'a' | 'b' | 'c'; minutes: number };
const load = (): Draft => { try { return { goal: 'sekolah', placement: '', minutes: 20, ...JSON.parse(sessionStorage.getItem(KEY) || '{}') }; } catch { return { goal: 'sekolah', placement: '', minutes: 20 }; } };

/** /mulai/:step — goal → placement check → daily goal (login.html states goal/level/time). */
export default function Onboarding() {
  const { step = 'tujuan' } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { data: me } = useMe();
  const [d, setD] = useState<Draft>(load);
  const [busy, setBusy] = useState(false);
  useEffect(() => { try { sessionStorage.setItem(KEY, JSON.stringify(d)); } catch { /* ignore */ } }, [d]);
  const preview = useApi<{ start: ChapterRef | null; skipped: ChapterRef | null }>(step === 'waktu' && d.placement ? `/api/onboarding/preview?placement=${d.placement}` : null);
  if (me?.onboarded) return <Navigate to="/beranda" replace />;
  if (!STEPS.includes(step as (typeof STEPS)[number])) return <Navigate to="/mulai/tujuan" replace />;
  const idx = STEPS.indexOf(step as (typeof STEPS)[number]);
  const dots = <div className="onb-dots">{STEPS.map((s, i) => <i key={s} className={i <= idx ? 'on' : ''} />)}</div>;

  const finish = async () => {
    setBusy(true);
    try {
      const r = await api.post<{ me: Me }>('/api/onboarding', { goal: d.goal, placement: d.placement || 'c', daily_goal_min: d.minutes });
      qc.setQueryData(['/api/me'], r.me);
      sessionStorage.removeItem(KEY);
      nav('/beranda', { replace: true });
    } finally { setBusy(false); }
  };

  return (
    <AuthFrame>
      {step === 'tujuan' && (
        <div className="auth-form">
          {dots}
          <h1 className="big-serif mt-6" style={{ fontSize: 36 }}>Apa tujuanmu belajar ngoding?</h1>
          <div className="goal-grid" role="radiogroup">
            {GOALS.map(([id, ic, t, s]) => (
              <button key={id} className="goal" role="radio" aria-checked={d.goal === id} aria-pressed={d.goal === id}
                onClick={e => { setD({ ...d, goal: id }); pop(e.currentTarget); }}>
                <Icon name={ic} /><b>{t}</b><span className="t-xs t-muted">{s}</span>
              </button>
            ))}
          </div>
          <button className="btn btn-primary btn-xl btn-press w-full mt-8" onClick={() => nav('/mulai/cek')}>Lanjut</button>
        </div>
      )}
      {step === 'cek' && (
        <div className="auth-form">
          {dots}
          <h1 className="big-serif mt-6" style={{ fontSize: 36 }}>Cek kecil: sudah pernah lihat ini?</h1>
          <p className="t-muted mt-2">Tidak dinilai. Jawabanmu hanya menentukan dari bab mana kamu mulai.</p>
          <div className="codecard mt-6"><div className="cc-body"><CodeLines code={'let x = 4;\nx = x * 2;'} numbers={false} /></div></div>
          <div className="choices" role="radiogroup">
            {([['a', 'A', 'x bernilai 8'], ['b', 'B', 'x bernilai 4'], ['c', 'C', 'Belum pernah lihat kode seperti ini']] as const).map(([v, k, t]) => (
              <button key={v} className={`choice${d.placement === v ? ' is-picked' : ''}`} role="radio" aria-checked={d.placement === v}
                onClick={e => { setD({ ...d, placement: v }); pop(e.currentTarget); }}>
                <span className="key">{k}</span>{t}
              </button>
            ))}
          </div>
          <p className="t-sm mt-4" aria-live="polite">
            {d.placement === 'a' && <><span className="t-success">Mantap.</span> <span className="t-muted">Kamu akan mulai sedikit lebih jauh.</span></>}
            {(d.placement === 'b' || d.placement === 'c') && <span className="t-muted">Tidak apa-apa. Kita mulai dari dasar.</span>}
          </p>
          <div className="row gap-2 mt-4">
            <button className="btn btn-ghost btn-xl" onClick={() => nav('/mulai/tujuan')}><Icon name="arrow-left" /></button>
            <button className="btn btn-primary btn-xl btn-press grow" onClick={() => { if (!d.placement) setD({ ...d, placement: 'c' }); nav('/mulai/waktu'); }}>Lanjut</button>
          </div>
        </div>
      )}
      {step === 'waktu' && (
        <div className="auth-form">
          {dots}
          <h1 className="big-serif mt-6" style={{ fontSize: 36 }}>Berapa menit sehari?</h1>
          <div className="minutes" role="radiogroup">
            {[5, 10, 20, 30].map(m => (
              <button key={m} className="chip" role="radio" aria-checked={d.minutes === m} aria-pressed={d.minutes === m}
                onClick={e => { setD({ ...d, minutes: m }); pop(e.currentTarget); }}>{m}</button>
            ))}
          </div>
          <p className="t-sm t-muted mt-3">Satu fase biasanya 5–10 menit. Target bisa diubah kapan saja.</p>
          {preview.data?.start && (
            <div className="callout callout-accent mt-6"><Icon name="map" /><div className="t-sm">
              Kamu mulai dari <b>Bab {preview.data.start.number} · {preview.data.start.title}</b>.
              {preview.data.skipped && <> Bab {preview.data.skipped.number} ditandai selesai karena kamu sudah mengenal <span className="t-mono">console.log</span>.</>}
            </div></div>
          )}
          <div className="row gap-2 mt-6">
            <button className="btn btn-ghost btn-xl" onClick={() => nav('/mulai/cek')}><Icon name="arrow-left" /></button>
            <button className={`btn btn-primary btn-xl btn-press grow${busy ? ' is-loading' : ''}`} onClick={finish}>Masuk ke Beranda<Icon name="arrow-right" /></button>
          </div>
        </div>
      )}
    </AuthFrame>
  );
}

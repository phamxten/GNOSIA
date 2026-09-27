import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import '../player/player.css';
import { api } from '../api/client';
import { useApi, useRefreshMe } from '../api/hooks';
import type { PhaseMeta, PlayerHeader, Scene } from '../api/types';
import { Icon } from '../design/Icon';
import { Nosi, type Mood } from '../design/Nosi';
import { PhaseRing } from '../design/PhaseRing';
import { toast } from '../design/toast';
import { LoadError, Skel } from '../design/ui';
import { burst, confetti, pop, shake, sound, ticker } from '../fx';
import { useHeartbeat, useLockRedirect } from '../lib/hooks';
import { DoneOverlay, Gate, PhaseBar, PlayerFoot, PlayerShell, PlayerTop } from '../player/Player';
import { SceneView } from './Scene';

type PahamiData = PlayerHeader & { scenes: Scene[]; scene: number; done: boolean; minutes: number; next: { items: number } };
type DoneRes = { xp: number; phases: Record<string, { state: string }>; xp_week: number; next: { items: number } };

export default function PahamiPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const refreshMe = useRefreshMe();
  const q = useApi<PahamiData>(`/api/chapters/${id}/pahami`, { staleTime: 0 });
  useLockRedirect(q.error);
  useHeartbeat(Number(id));
  const d = q.data;
  const N = d?.scenes.length || 0;
  const [cur, setCur] = useState(0);
  const [mood, setMood] = useState<Mood>('think');
  const [bump, setBump] = useState(0);
  const [pips, setPips] = useState<Record<number, [number, number]>>({});
  const [done, setDone] = useState<DoneRes | null>(null);
  const [busy, setBusy] = useState(false);
  const sceneRef = useRef<HTMLElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const dir = useRef(1);

  // Resume where the learner stopped; ?scene=n or ?konsep=key deep-link into a scene.
  useEffect(() => {
    if (!d || cur) return;
    const byConcept = params.get('konsep') ? d.scenes.findIndex(s => s.concepts?.includes(params.get('konsep')!)) + 1 : 0;
    const start = Number(params.get('scene')) || byConcept || (d.done ? 1 : d.scene) || 1;
    setCur(Math.min(Math.max(1, start), N));
  }, [d]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!d || !cur) return;
    setMood(cur === N ? 'cheer' : 'think');
    setBump(b => b + 1);
    scrollTo({ top: 0, behavior: 'smooth' });
    if (!d.done) api.post(`/api/chapters/${id}/pahami/scene`, { scene: cur }).catch(() => { /* resumable later */ });
  }, [cur]); // eslint-disable-line react-hooks/exhaustive-deps

  const scene = d && cur ? d.scenes[cur - 1] : null;
  const kicker = useMemo(() => {
    if (!d || !scene) return '';
    return scene.kicker || `Bab ${d.chapter.number} · ${d.chapter.title} · ±${d.minutes} menit`;
  }, [d, scene]);
  const gated = scene?.advance === 'all_tokens' && (pips[cur]?.[0] ?? 0) < (pips[cur]?.[1] ?? 1) && !d?.done;

  const go = (n: number) => { dir.current = n > cur ? 1 : -1; setCur(n); };
  const next = async () => {
    if (!d || busy) return;
    pop(nextRef.current);
    if (gated) {
      shake(document.querySelector('[data-tok-progress]'));
      toast({ kind: 'accent', icon: 'hand', title: 'Ketuk semua bagian dulu', body: 'Setiap bagian kode punya tugasnya sendiri.' });
      return;
    }
    if (cur < N) { go(cur + 1); return; }
    if (d.done) { nav(`/bab/${id}`); return; }
    setBusy(true);
    try {
      const r = await api.post<DoneRes>(`/api/chapters/${id}/pahami/complete`);
      setDone(r);
      qc.invalidateQueries({ queryKey: [`/api/chapters/${id}`] });
      refreshMe();
    } catch {
      toast({ kind: 'danger', icon: 'circle-alert', title: 'Gagal menyimpan', body: 'Periksa koneksi, lalu coba lagi.' });
    } finally { setBusy(false); }
  };
  const prev = () => cur > 1 && go(cur - 1);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.target as Element).closest('input,textarea,[contenteditable],.knob,button,.reveal')) return;
      if (e.key === 'Enter') next();
      if (e.key === 'ArrowLeft') prev();
    };
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  });

  if (q.error) return <PlayerShell phase="pahami"><div className="player-error"><LoadError onRetry={() => q.refetch()} /></div></PlayerShell>;
  if (!d || !scene) return (
    <PlayerShell phase="pahami">
      <header className="player-top"><span /><Skel h={30} w="100%" style={{ maxWidth: 760, justifySelf: 'center' }} /><span /></header>
      <main className="stage-wrap"><div className="stage"><Skel h={420} r={20} /></div></main>
    </PlayerShell>
  );
  const phases = d.phases as PhaseMeta[];

  return (
    <PlayerShell phase="pahami">
      <PlayerTop exitTo={`/bab/${id}`} xp={d.xp} mood={mood} bump={bump}
        center={<PhaseBar phases={phases} current="pahami" progress={d.done ? 1 : cur / N} />} />
      <main className="stage-wrap">
        <div className="stage">
          <SceneView key={scene.id + cur} scene={scene} kicker={kicker} className="scene-enter" sceneRef={sceneRef}
            setMood={m => { setMood(m); setBump(b => b + 1); }}
            onProgress={(s, t) => setPips(p => ({ ...p, [cur]: [s, t] }))} />
        </div>
      </main>
      <PlayerFoot>
        <button className="btn btn-ghost btn-lg" onClick={prev} disabled={cur === 1} aria-label="Kembali"><Icon name="arrow-left" /><span className="hide-sm">Kembali</span></button>
        <div className="fb-idle"><span className="kbdhint hide-sm"><kbd>↵</kbd> lanjut · <kbd>←</kbd> kembali</span><span className="grow" /><span className="t-mono t-xs">{cur} / {N}</span></div>
        <button ref={nextRef} className={`btn btn-primary btn-xl btn-press${busy ? ' is-loading' : ''}`} style={{ minWidth: 180 }} onClick={next} aria-disabled={gated || undefined}>
          {cur === N ? (d.done ? <>Kembali ke bab<Icon name="arrow-right" /></> : <>Selesaikan Pahami<Icon name="check" /></>) : <>Lanjut<Icon name="arrow-right" /></>}
        </button>
      </PlayerFoot>
      {done && <PahamiDone id={id!} res={done} scenes={N} minutes={d.minutes} />}
    </PlayerShell>
  );
}

function PahamiDone({ id, res, scenes, minutes }: { id: string; res: DoneRes; scenes: number; minutes: number }) {
  const xpRef = useRef<HTMLSpanElement>(null);
  const gateRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    confetti(); sound('done');
    ticker(xpRef.current, res.xp, { from: 0, dur: 1200 });
    const t = setTimeout(() => { setOpen(true); requestAnimationFrame(() => burst(gateRef.current?.querySelector('.lock'), { count: 10, spread: 60 })); }, 1100);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <DoneOverlay labelledBy="done-t">
      <Nosi size="xl" mood="cheer" />
      <div className="eyebrow mt-4">Fase 1 dari 4 selesai</div>
      <h2 id="done-t" className="big-serif mt-2" style={{ fontSize: 44 }}>Kamu sudah <em>paham</em>.</h2>
      <p className="t-muted mt-3">{scenes} scene · {minutes} menit · <b style={{ color: 'var(--xp)' }}>+<span ref={xpRef}>0</span> XP</b></p>
      <div className="unlock-row">
        <PhaseRing values={[1, 0, 0, 0]} size={84} stroke={8}><Icon name="check" size={20} className="t-accent" /></PhaseRing>
        <Icon name="chevrons-right" className="arrow" />
        <Gate open={open} title="Perkuat" text={open ? `terbuka · ${res.next.items} latihan` : 'terkunci'} gateRef={gateRef} />
      </div>
      <Link className="btn btn-ok btn-xl btn-press w-full mt-8" to={`/bab/${id}/perkuat`}>Mulai Perkuat<Icon name="arrow-right" /></Link>
      <Link className="btn btn-ghost mt-2" to={`/bab/${id}`}>Nanti saja</Link>
    </DoneOverlay>
  );
}

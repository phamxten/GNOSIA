import { useEffect, useRef, useState } from 'react';
import { PhaseRing } from '../design/PhaseRing';
import { Nosi, type Mood } from '../design/Nosi';
import { motion, rise } from '../fx';

const STEPS: [string, string, string, number[], Mood][] = [
  ['pahami', 'Fase 1', 'Pahami dulu.', [1, 0, 0, 0], 'think'],
  ['perkuat', 'Fase 2', 'Perkuat pelan-pelan.', [1, 1, 0, 0], 'happy'],
  ['kuis', 'Fase 3', 'Kuis sebentar.', [1, 1, 1, 0], 'cheer'],
  ['uji', 'Fase 4', 'Lalu buktikan.', [1, 1, 1, 1], 'cheer'],
];

/** Right panel of the auth screens: cycles phase colour, ring and Nosi every 3.2 s. */
export function AuthOrbit() {
  const [k, setK] = useState(0);
  const title = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (motion() === 'off') return;
    const t = setInterval(() => setK(x => x + 1), 3200);
    return () => clearInterval(t);
  }, []);
  useEffect(() => { rise(title.current); }, [k]);
  const [ph, key, t, ring, mood] = STEPS[k % 4];
  return (
    <aside className="auth-right" data-phase={ph} aria-hidden="true">
      <div className="orbit">
        <PhaseRing values={ring} size={360} stroke={14} />
        <Nosi mood={mood} bump={k} style={{ width: 170, height: 170 }} force />
      </div>
      <div className="orbit-cap"><div className="eyebrow">{key}</div><div className="big-serif mt-2" style={{ fontSize: 34 }} ref={title}>{t}</div></div>
    </aside>
  );
}

import { useLayoutEffect, useRef, type CSSProperties } from 'react';
import { usePrefs } from '../state/prefs';

export type Mood = 'think' | 'happy' | 'cheer' | 'oops' | '';

/** Nosi, the owl made of braces. Mood changes (or a new `bump`) retrigger the hop/tilt animation. */
export function Nosi({ mood = '', size, bump = 0, style, className, force }: {
  mood?: Mood; size?: 'sm' | 'lg' | 'xl'; bump?: number; style?: CSSProperties; className?: string; force?: boolean;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const show = usePrefs(s => s.nosi);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.dataset.mood = '';
    void el.offsetWidth;
    el.dataset.mood = mood;
  }, [mood, bump]);
  if (!show && !force) return null;
  return (
    <span ref={ref} className={['nosi', size ? `nosi-${size}` : '', className || ''].join(' ')} style={style} role="img" aria-label="Nosi">
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <g className="n-body">
          <text className="n-brace l" x="1" y="47">{'{'}</text><text className="n-brace r" x="51" y="47">{'}'}</text>
          <path d="M18 9 L25 18 L15 20 Z" fill="var(--nosi-body)" /><path d="M46 9 L39 18 L49 20 Z" fill="var(--nosi-body)" />
          <rect x="13" y="14" width="38" height="44" rx="17" fill="var(--nosi-body)" />
          <path d="M22 50 C22 41 42 41 42 50 C42 55 22 55 22 50Z" fill="var(--nosi-belly)" opacity=".9" />
          <g className="n-eyes-open">
            <circle cx="25" cy="30" r="7.5" fill="var(--nosi-eye)" /><circle cx="39" cy="30" r="7.5" fill="var(--nosi-eye)" />
            <circle className="n-pupil" cx="25.5" cy="30.5" r="3.4" fill="var(--nosi-pupil)" /><circle className="n-pupil" cx="39.5" cy="30.5" r="3.4" fill="var(--nosi-pupil)" />
            <rect className="n-lid" x="17" y="22" width="30" height="16" rx="8" fill="var(--nosi-body)" />
          </g>
          <g className="n-eyes-happy" fill="none" stroke="var(--nosi-eye)" strokeWidth="2.6" strokeLinecap="round"><path d="M20 31 Q25 25 30 31" /><path d="M34 31 Q39 25 44 31" /></g>
          <g className="n-brow" stroke="var(--nosi-eye)" strokeWidth="2.2" strokeLinecap="round"><path d="M19 20 L29 22" /><path d="M45 19 L36 22" /></g>
          <path d="M30 37 L34 37 L32 41 Z" fill="var(--kuis-fill)" />
        </g>
      </svg>
    </span>
  );
}

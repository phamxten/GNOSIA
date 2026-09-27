import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { ease, motion } from '../fx';

/** Four arcs (Pahami · Perkuat · Kuis · Uji) with 3.5% gaps; zero arcs are not drawn. Arcs draw in with stagger. */
export function PhaseRing({ values, size = 96, stroke = 7, children, className, style }: {
  values: number[]; size?: number; stroke?: number; children?: ReactNode; className?: string; style?: React.CSSProperties;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const r = (size - stroke) / 2, C = 2 * Math.PI * r, gap = 0.035 * C, seg = C / 4 - gap;
  const key = values.map(v => v.toFixed(3)).join(',');
  useLayoutEffect(() => {
    const arcs = ref.current?.querySelectorAll<SVGCircleElement>('.arc');
    arcs?.forEach((a, i) => {
      const len = +(a.dataset.len || 0);
      if (motion() === 'off') { a.setAttribute('stroke-dasharray', `${len} ${C}`); return; }
      a.setAttribute('stroke-dasharray', `0 ${C}`);
      a.animate([{ strokeDasharray: `0 ${C}` }, { strokeDasharray: `${len} ${C}` }], { duration: 900, delay: 150 + i * 160, easing: ease.gentle, fill: 'forwards' });
    });
  }, [key, C]);
  return (
    <span className={['pring', className || ''].join(' ')} style={style}>
      <svg ref={ref} width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        {[0, 1, 2, 3].map(i => {
          const rot = (i * C) / 4 + gap / 2;
          const common = { cx: size / 2, cy: size / 2, r, strokeWidth: stroke, strokeDashoffset: -rot };
          const v = Math.max(0, Math.min(1, values[i] || 0));
          return (
            <g key={i}>
              <circle className="trk" {...common} strokeDasharray={`${seg} ${C - seg}`} strokeLinecap="round" />
              {v > 0 && <circle className={`arc a${i + 1}`} {...common} data-len={seg * v} strokeDasharray={`0 ${C}`} />}
            </g>
          );
        })}
      </svg>
      {children !== undefined && <span className="pring-center">{children}</span>}
    </span>
  );
}

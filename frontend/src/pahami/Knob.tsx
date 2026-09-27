import { useRef } from 'react';

/** Scrubbable number (Bret-Victor style): drag horizontally (6 px per step) or ←/→ when focused. */
export function Knob({ value, min, max, step = 1, label, onChange }: {
  value: number; min: number; max: number; step?: number; label: string; onChange: (v: number) => void;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const clamp = (v: number) => Math.max(min, Math.min(max, Math.round(v / step) * step));
  const set = (v: number) => { const c = clamp(v); if (c !== value) onChange(c); };
  return (
    <span ref={ref} className="knob" tabIndex={0} role="slider" aria-label={label} aria-valuemin={min} aria-valuemax={max} aria-valuenow={value}
      onPointerDown={e => {
        e.preventDefault();
        const el = ref.current!;
        el.setPointerCapture(e.pointerId);
        el.classList.add('is-drag');
        const sx = e.clientX, sv = value;
        const mv = (ev: PointerEvent) => set(sv + Math.round((ev.clientX - sx) / 6) * step);
        const up = () => { el.classList.remove('is-drag'); el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', up); };
        el.addEventListener('pointermove', mv);
        el.addEventListener('pointerup', up);
      }}
      onKeyDown={e => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { set(value + step); e.preventDefault(); e.stopPropagation(); }
        if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { set(value - step); e.preventDefault(); e.stopPropagation(); }
      }}>
      {value}
    </span>
  );
}

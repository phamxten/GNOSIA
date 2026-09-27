/* GNOSIA effect kit — a typed port of design/mockups/motion.js (see MOTION.md).
   Built on the Web Animations API. Intensity (html[data-motion]):
     full → everything · calm → no particles, confetti, tilt or ambient drift · off → state changes only */
import confettiLib from 'canvas-confetti';

export type MotionLevel = 'full' | 'calm' | 'off';

const root = () => document.documentElement;
const store = {
  get(k: string) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k: string, v: string) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};

function readMotion(): MotionLevel {
  const v = (root().dataset.motion || store.get('gnosia-motion')) as MotionLevel | null;
  if (v === 'full' || v === 'calm' || v === 'off') return v;
  return matchMedia('(prefers-reduced-motion: reduce)').matches ? 'off' : 'full';
}

let level: MotionLevel = readMotion();
root().dataset.motion = level;

export const motion = () => level;
export const isFull = () => level === 'full';
const on = () => level !== 'off';

export function setMotion(v: MotionLevel) {
  level = v;
  root().dataset.motion = v;
  store.set('gnosia-motion', v);
}

export const ease = {
  gentle: 'cubic-bezier(.34, 1.25, .64, 1)',
  bouncy: 'cubic-bezier(.34, 1.56, .64, 1)',
  snappy: 'cubic-bezier(.2, .9, .3, 1.08)',
  out: 'cubic-bezier(.2, .8, .2, 1)',
  exit: 'cubic-bezier(.4, 0, 1, 1)',
};

type El = Element | null | undefined;
const done = { finished: Promise.resolve() } as unknown as Animation;
const anim = (el: El, frames: Keyframe[], opts: KeyframeAnimationOptions): Animation =>
  on() && el && (el as HTMLElement).animate ? (el as HTMLElement).animate(frames, opts) : done;

export const pop = (el: El) => anim(el, [{ transform: 'scale(1)' }, { transform: 'scale(1.12)' }, { transform: 'scale(1)' }], { duration: 380, easing: ease.bouncy });
export const shake = (el: El) => anim(el, [0, -7, 7, -5, 4, 0].map(x => ({ transform: `translateX(${x}px)` })), { duration: 380, easing: ease.out });
export const rise = (el: El, delay = 0) => anim(el, [{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }], { duration: 520, delay, easing: ease.gentle, fill: 'both' });

/** Number ticker (XP, scores). */
export function ticker(el: HTMLElement | null, to: number, { from, dur = 900, suffix = '' }: { from?: number; dur?: number; suffix?: string } = {}) {
  if (!el) return;
  const start = from ?? (parseFloat(el.textContent || '') || 0);
  if (!on()) { el.textContent = to + suffix; return; }
  const t0 = performance.now();
  const step = (t: number) => {
    const k = Math.min(1, (t - t0) / dur);
    const e = 1 - Math.pow(1 - k, 3);
    el.textContent = Math.round(start + (to - start) * e) + suffix;
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

const cssVar = (v: string) => getComputedStyle(root()).getPropertyValue(v).trim();
const phaseColors = () => ['--perkuat-fill', '--kuis-fill', '--pahami-fill', '--uji-fill'].map(cssVar);

/** Particle burst from an element (correct answer). Full motion only. */
export function burst(el: El, { colors, count = 14, spread = 90 }: { colors?: string[]; count?: number; spread?: number } = {}) {
  if (!isFull() || !el) return;
  const r = el.getBoundingClientRect();
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  const pal = colors || phaseColors();
  for (let i = 0; i < count; i++) {
    const p = document.createElement('i');
    p.className = 'particle';
    p.style.left = cx + 'px'; p.style.top = cy + 'px'; p.style.background = pal[i % pal.length];
    if (i % 3 === 0) p.style.borderRadius = '50%';
    document.body.appendChild(p);
    const a = (Math.PI * 2 * i) / count + Math.random() * .5, d = spread * (.55 + Math.random() * .6);
    p.animate([{ transform: 'translate(-50%,-50%) scale(1) rotate(0)', opacity: 1 },
      { transform: `translate(calc(-50% + ${Math.cos(a) * d}px), calc(-50% + ${Math.sin(a) * d}px)) scale(.4) rotate(${Math.random() * 360}deg)`, opacity: 0 }],
      { duration: 700 + Math.random() * 300, easing: 'cubic-bezier(.1,.7,.3,1)' }).finished.then(() => p.remove());
  }
}

/** Floating "+10 XP". */
export function xpFloat(el: El, text = '+10 XP') {
  if (!on() || !el) return;
  const r = el.getBoundingClientRect();
  const f = document.createElement('div');
  f.className = 'xp-float'; f.textContent = text;
  f.style.left = r.left + r.width / 2 - 30 + 'px'; f.style.top = r.top - 10 + 'px';
  document.body.appendChild(f);
  f.animate([{ opacity: 0, transform: 'translateY(6px) scale(.8)' }, { opacity: 1, transform: 'translateY(-14px) scale(1.05)', offset: .3 }, { opacity: 0, transform: 'translateY(-46px) scale(1)' }],
    { duration: 1100, easing: ease.out }).finished.then(() => f.remove());
}

/** Confetti — only for phase completion or passing a gate. */
export function confetti() {
  if (!isFull()) return;
  const colors = ['--pahami-fill', '--perkuat-fill', '--kuis-fill', '--uji-fill'].map(cssVar);
  const shoot = (x: number, angle: number) => confettiLib({ particleCount: 60, spread: 70, startVelocity: 42, angle, origin: { x, y: .75 }, colors, scalar: .9, ticks: 180, disableForReducedMotion: true });
  shoot(.2, 60); setTimeout(() => shoot(.8, 120), 150);
}

/** Fly a clone of `src` into `dst` (a value flying into a variable box). */
export function flyTo(src: El, dst: El, { dur = 700 } = {}): Promise<void> {
  if (!src || !dst || !on()) return Promise.resolve();
  const a = src.getBoundingClientRect(), b = dst.getBoundingClientRect();
  const c = src.cloneNode(true) as HTMLElement;
  Object.assign(c.style, { position: 'fixed', left: a.left + 'px', top: a.top + 'px', margin: '0', zIndex: '90', pointerEvents: 'none' });
  document.body.appendChild(c);
  const dx = b.left + b.width / 2 - (a.left + a.width / 2), dy = b.top + b.height / 2 - (a.top + a.height / 2);
  return c.animate([{ transform: 'translate(0,0) scale(1)' }, { transform: `translate(${dx * .5}px, ${dy * .5 - 60}px) scale(1.15)`, offset: .5 }, { transform: `translate(${dx}px, ${dy}px) scale(1)` }],
    { duration: dur, easing: 'cubic-bezier(.45,.05,.3,1)' }).finished.then(() => c.remove());
}

// ---------- Sound (off by default; Pengaturan › Suara) ----------
let ctx: AudioContext | null = null;
export const soundOn = () => store.get('gnosia-sound') === 'on';
export function setSound(onOff: boolean) { store.set('gnosia-sound', onOff ? 'on' : 'off'); }
export function sound(kind: 'ok' | 'no' | 'done' | 'tick') {
  if (!soundOn()) return;
  try {
    ctx = ctx || new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const notes = { ok: [660, 880], no: [300, 240], done: [523, 659, 784, 1046], tick: [1200] }[kind] || [440];
    notes.forEach((f, i) => {
      const o = ctx!.createOscillator(), g = ctx!.createGain(), t = ctx!.currentTime + i * .09;
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.08, t + .02); g.gain.exponentialRampToValueAtTime(.0001, t + .22);
      o.connect(g).connect(ctx!.destination); o.start(t); o.stop(t + .25);
    });
  } catch { /* audio not available */ }
}

// ---------- Answer-check choreography (MOTION §3.2) ----------
export function correct({ button, xpEl, xp }: { button?: El; xpEl?: HTMLElement | null; xp?: number } = {}) {
  if (button) { burst(button); pop(button); }
  if (xpEl && xp) { ticker(xpEl, (parseInt(xpEl.textContent || '0', 10) || 0) + xp); xpFloat(xpEl, `+${xp} XP`); }
  sound('ok');
}
export function wrong({ target }: { target?: El } = {}) {
  if (target) shake(target);
  sound('no');
}

// ---------- Global behaviours: hover tilt on [data-tilt], Nosi eye-follow ----------
let installed = false;
export function installGlobalFx() {
  if (installed) return;
  installed = true;
  document.addEventListener('pointermove', e => {
    if (!isFull()) return;
    const t = (e.target as Element | null)?.closest?.('[data-tilt]') as HTMLElement | null;
    if (t) {
      const r = t.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
      t.style.transform = `perspective(900px) rotateX(${(-y * 5).toFixed(2)}deg) rotateY(${(x * 6).toFixed(2)}deg) translateY(-2px)`;
    }
    document.querySelectorAll<SVGSVGElement>('.nosi:not([data-mood="happy"]):not([data-mood="cheer"]) svg').forEach(svg => {
      const r = svg.getBoundingClientRect();
      if (!r.width) return;
      const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2), d = Math.hypot(dx, dy) || 1;
      const k = Math.min(1, d / 300) * 2.2;
      svg.querySelectorAll<SVGElement>('.n-pupil').forEach(p => (p.style.transform = `translate(${(dx / d) * k}px, ${(dy / d) * k}px)`));
    });
  }, { passive: true });
  document.addEventListener('pointerout', e => {
    const t = (e.target as Element | null)?.closest?.('[data-tilt]') as HTMLElement | null;
    if (t && !t.contains(e.relatedTarget as Node | null)) t.style.transform = '';
  });
}

/* =========================================================================
   GNOSIA v2 — motion.js
   Tiny effect kit built on the Web Animations API (no dependencies except the
   optional canvas-confetti for phase completion). Every effect here is
   specified in MOTION.md; in the React app use `motion` (Framer Motion)
   springs with the same names and values.

   Intensity (html[data-motion]):  full | calm | off
     full → everything
     calm → no particles, no confetti, no tilt, no ambient drift; transitions kept
     off  → state changes only (colour + text); honours prefers-reduced-motion
   ========================================================================= */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  // ---------- intensity -----------------------------------------------------
  function readIntensity() {
    let v = null; try { v = localStorage.getItem('gnosia-motion'); } catch (_) {}
    const q = new URLSearchParams(location.search).get('motion'); if (q) v = q;
    if (!v) v = matchMedia('(prefers-reduced-motion: reduce)').matches ? 'off' : 'full';
    return v;
  }
  G.motion = readIntensity();
  document.documentElement.dataset.motion = G.motion;
  G.setMotion = v => { G.motion = v; document.documentElement.dataset.motion = v; try { localStorage.setItem('gnosia-motion', v); } catch (_) {} };
  const full = () => G.motion === 'full';
  const on = () => G.motion !== 'off';

  // ---------- springs (CSS easing approximations) ---------------------------
  G.ease = {
    gentle: 'cubic-bezier(.34, 1.25, .64, 1)',
    bouncy: 'cubic-bezier(.34, 1.56, .64, 1)',
    snappy: 'cubic-bezier(.2, .9, .3, 1.08)',
    out: 'cubic-bezier(.2, .8, .2, 1)',
    exit: 'cubic-bezier(.4, 0, 1, 1)',
  };
  const anim = (el, frames, opts) => (on() && el && el.animate ? el.animate(frames, opts) : { finished: Promise.resolve() });

  // ---------- primitives ------------------------------------------------------
  G.pop = el => anim(el, [{ transform: 'scale(1)' }, { transform: 'scale(1.12)' }, { transform: 'scale(1)' }], { duration: 380, easing: G.ease.bouncy });
  G.shake = el => anim(el, [0, -7, 7, -5, 4, 0].map(x => ({ transform: `translateX(${x}px)` })), { duration: 380, easing: G.ease.out });
  G.rise = (el, delay = 0) => anim(el, [{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }], { duration: 520, delay, easing: G.ease.gentle, fill: 'both' });
  G.fadeOut = el => anim(el, [{ opacity: 1 }, { opacity: 0, transform: 'translateX(-30px)' }], { duration: 200, easing: G.ease.exit, fill: 'forwards' });

  // Number ticker (XP, scores). Real app: motion's animate() on a MotionValue.
  G.ticker = (el, to, { from, dur = 900, suffix = '' } = {}) => {
    const start = from ?? (parseFloat(el.textContent) || 0);
    if (!on()) { el.textContent = to + suffix; return; }
    const t0 = performance.now();
    const step = t => { const k = Math.min(1, (t - t0) / dur); const e = 1 - Math.pow(1 - k, 3); el.textContent = Math.round(start + (to - start) * e) + suffix; if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  };

  // Particle burst from an element (correct answer). 14 pieces, phase colours.
  G.burst = (el, { colors, count = 14, spread = 90 } = {}) => {
    if (!full() || !el) return;
    const r = el.getBoundingClientRect(); const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const cs = getComputedStyle(document.documentElement);
    const pal = colors || ['--perkuat-fill', '--kuis-fill', '--pahami-fill', '--uji-fill'].map(v => cs.getPropertyValue(v).trim());
    for (let i = 0; i < count; i++) {
      const p = document.createElement('i'); p.className = 'particle';
      p.style.left = cx + 'px'; p.style.top = cy + 'px'; p.style.background = pal[i % pal.length];
      if (i % 3 === 0) p.style.borderRadius = '50%';
      document.body.appendChild(p);
      const a = (Math.PI * 2 * i) / count + Math.random() * .5, d = spread * (.55 + Math.random() * .6);
      p.animate([{ transform: 'translate(-50%,-50%) scale(1) rotate(0)', opacity: 1 },
        { transform: `translate(calc(-50% + ${Math.cos(a) * d}px), calc(-50% + ${Math.sin(a) * d}px)) scale(.4) rotate(${Math.random() * 360}deg)`, opacity: 0 }],
        { duration: 700 + Math.random() * 300, easing: 'cubic-bezier(.1,.7,.3,1)' }).finished.then(() => p.remove());
    }
  };

  // Floating "+10 XP"
  G.xpFloat = (el, text = '+10 XP') => {
    if (!on() || !el) return;
    const r = el.getBoundingClientRect(); const f = document.createElement('div'); f.className = 'xp-float'; f.textContent = text;
    f.style.left = r.left + r.width / 2 - 30 + 'px'; f.style.top = r.top - 10 + 'px'; document.body.appendChild(f);
    f.animate([{ opacity: 0, transform: 'translateY(6px) scale(.8)' }, { opacity: 1, transform: 'translateY(-14px) scale(1.05)', offset: .3 }, { opacity: 0, transform: 'translateY(-46px) scale(1)' }], { duration: 1100, easing: G.ease.out }).finished.then(() => f.remove());
  };

  // Confetti — ONLY for phase completion / passing a gate.
  G.confetti = () => {
    if (!full() || typeof window.confetti !== 'function') return;
    const cs = getComputedStyle(document.documentElement);
    const colors = ['--pahami-fill', '--perkuat-fill', '--kuis-fill', '--uji-fill'].map(v => cs.getPropertyValue(v).trim());
    const shoot = (x, angle) => window.confetti({ particleCount: 60, spread: 70, startVelocity: 42, angle, origin: { x, y: .75 }, colors, scalar: .9, ticks: 180, disableForReducedMotion: true });
    shoot(.2, 60); setTimeout(() => shoot(.8, 120), 150);
  };

  // Hover tilt for [data-tilt] cards (max 3°)
  function initTilt() {
    $$('[data-tilt]').forEach(el => {
      el.addEventListener('pointermove', e => {
        if (!full()) return; const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
        el.style.transform = `perspective(900px) rotateX(${(-y * 5).toFixed(2)}deg) rotateY(${(x * 6).toFixed(2)}deg) translateY(-2px)`;
      });
      el.addEventListener('pointerleave', () => (el.style.transform = ''));
    });
  }

  // Typewriter for code lines: <span data-type>text</span>
  G.type = (el, text, { speed = 22 } = {}) => new Promise(res => {
    if (!on()) { el.textContent = text; return res(); }
    el.textContent = ''; el.classList.add('typing'); let i = 0;
    const t = setInterval(() => { el.textContent = text.slice(0, ++i); if (i >= text.length) { clearInterval(t); el.classList.remove('typing'); res(); } }, speed);
  });

  // Fly a clone of `src` into `dst` (e.g. a value flying into a variable box)
  G.flyTo = (src, dst, { dur = 700 } = {}) => {
    const a = src.getBoundingClientRect(), b = dst.getBoundingClientRect();
    if (!on()) return Promise.resolve();
    const c = src.cloneNode(true); Object.assign(c.style, { position: 'fixed', left: a.left + 'px', top: a.top + 'px', margin: 0, zIndex: 90, pointerEvents: 'none' });
    document.body.appendChild(c);
    const dx = b.left + b.width / 2 - (a.left + a.width / 2), dy = b.top + b.height / 2 - (a.top + a.height / 2);
    return c.animate([{ transform: 'translate(0,0) scale(1)' }, { transform: `translate(${dx * .5}px, ${dy * .5 - 60}px) scale(1.15)`, offset: .5 }, { transform: `translate(${dx}px, ${dy}px) scale(1)` }],
      { duration: dur, easing: 'cubic-bezier(.45,.05,.3,1)' }).finished.then(() => c.remove());
  };

  // ---------- Phase ring ------------------------------------------------------
  // <span class="pring" data-ring="1,1,.4,0" data-size="96" data-stroke="7"></span>
  G.ring = el => {
    const vals = (el.dataset.ring || '0,0,0,0').split(',').map(Number);
    const size = +el.dataset.size || 96, sw = +el.dataset.stroke || 7, r = (size - sw) / 2, C = 2 * Math.PI * r;
    const gap = 0.035 * C, seg = C / 4 - gap;
    let svg = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">`;
    for (let i = 0; i < 4; i++) {
      const rot = (i * C) / 4 + gap / 2;
      const attrs = `cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${sw}" stroke-dashoffset="${-rot}"`;
      svg += `<circle class="trk" ${attrs} stroke-dasharray="${seg} ${C - seg}" stroke-linecap="round"/>`;
      if (vals[i] > 0) svg += `<circle class="arc a${i + 1}" ${attrs} data-len="${seg * vals[i]}" stroke-dasharray="0 ${C}"/>`;
    }
    svg += '</svg>';
    const center = el.querySelector('.pring-center');
    el.innerHTML = svg; if (center) el.appendChild(center);
    const arcs = el.querySelectorAll('.arc');
    requestAnimationFrame(() => arcs.forEach((a, i) => {
      const len = +a.dataset.len; const C2 = C;
      if (!on()) { a.setAttribute('stroke-dasharray', `${len} ${C2}`); return; }
      a.animate([{ strokeDasharray: `0 ${C2}` }, { strokeDasharray: `${len} ${C2}` }], { duration: 900, delay: 150 + i * 160, easing: G.ease.gentle, fill: 'forwards' });
    }));
  };

  // ---------- Nosi ------------------------------------------------------------
  const NOSI = `<svg viewBox="0 0 64 64" role="img" aria-label="Nosi">
    <g class="n-body">
      <text class="n-brace l" x="1" y="47">{</text><text class="n-brace r" x="51" y="47">}</text>
      <path d="M18 9 L25 18 L15 20 Z" fill="var(--nosi-body)"/><path d="M46 9 L39 18 L49 20 Z" fill="var(--nosi-body)"/>
      <rect x="13" y="14" width="38" height="44" rx="17" fill="var(--nosi-body)"/>
      <path d="M22 50 C22 41 42 41 42 50 C42 55 22 55 22 50Z" fill="var(--nosi-belly)" opacity=".9"/>
      <g class="n-eyes-open">
        <circle cx="25" cy="30" r="7.5" fill="var(--nosi-eye)"/><circle cx="39" cy="30" r="7.5" fill="var(--nosi-eye)"/>
        <circle class="n-pupil" cx="25.5" cy="30.5" r="3.4" fill="var(--nosi-pupil)"/><circle class="n-pupil" cx="39.5" cy="30.5" r="3.4" fill="var(--nosi-pupil)"/>
        <rect class="n-lid" x="17" y="22" width="30" height="16" rx="8" fill="var(--nosi-body)"/>
      </g>
      <g class="n-eyes-happy" fill="none" stroke="var(--nosi-eye)" stroke-width="2.6" stroke-linecap="round"><path d="M20 31 Q25 25 30 31"/><path d="M34 31 Q39 25 44 31"/></g>
      <g class="n-brow" stroke="var(--nosi-eye)" stroke-width="2.2" stroke-linecap="round"><path d="M19 20 L29 22"/><path d="M45 19 L36 22"/></g>
      <path d="M30 37 L34 37 L32 41 Z" fill="var(--kuis-fill)"/>
    </g></svg>`;
  G.nosi = (el, mood) => {
    if (!el) return;
    if (!el.querySelector('svg')) el.innerHTML = NOSI;
    if (mood) { el.dataset.mood = ''; void el.offsetWidth; el.dataset.mood = mood; }
  };
  // Pupils follow the pointer (subtle, full motion only)
  document.addEventListener('pointermove', e => {
    if (!full()) return;
    $$('.nosi:not([data-mood="happy"]):not([data-mood="cheer"]) svg').forEach(svg => {
      const r = svg.getBoundingClientRect(); if (!r.width) return;
      const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2), d = Math.hypot(dx, dy) || 1;
      const k = Math.min(1, d / 300) * 2.2;
      svg.querySelectorAll('.n-pupil').forEach(p => (p.style.transform = `translate(${(dx / d) * k}px, ${(dy / d) * k}px)`));
    });
  }, { passive: true });

  // ---------- Sound (off by default; Settings › Suara) -----------------------
  let ctx = null;
  G.sound = kind => {
    let enabled = false; try { enabled = localStorage.getItem('gnosia-sound') === 'on'; } catch (_) {}
    if (!enabled) return;
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    const notes = { ok: [660, 880], no: [300, 240], done: [523, 659, 784, 1046], tick: [1200] }[kind] || [440];
    notes.forEach((f, i) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.value = f; g.gain.setValueAtTime(.0001, ctx.currentTime + i * .09); g.gain.exponentialRampToValueAtTime(.08, ctx.currentTime + i * .09 + .02); g.gain.exponentialRampToValueAtTime(.0001, ctx.currentTime + i * .09 + .22); o.connect(g).connect(ctx.destination); o.start(ctx.currentTime + i * .09); o.stop(ctx.currentTime + i * .09 + .25); });
  };

  // ---------- Feedback helpers (the answer-check choreography) ---------------
  // correct: foot turns sage + burst from primary button + Nosi happy + XP float
  G.correct = ({ foot, button, nosi, xpEl, xp = 10 } = {}) => {
    if (foot) { foot.classList.remove('is-no'); foot.classList.add('is-ok'); }
    if (button) { G.burst(button); G.pop(button); }
    if (nosi) G.nosi(nosi, 'happy');
    if (xpEl) { G.ticker(xpEl, (parseInt(xpEl.textContent, 10) || 0) + xp); G.xpFloat(xpEl, `+${xp} XP`); }
    G.sound('ok');
  };
  // wrong: foot turns clay + shake the answer area + Nosi "oops" (never punishing)
  G.wrong = ({ foot, target, nosi } = {}) => {
    if (foot) { foot.classList.remove('is-ok'); foot.classList.add('is-no'); }
    if (target) G.shake(target);
    if (nosi) G.nosi(nosi, 'oops');
    G.sound('no');
  };
  G.resetFoot = foot => foot && foot.classList.remove('is-ok', 'is-no');

  // ---------- Pointer drag (tokens, Parsons blocks) --------------------------
  // G.draggable(el, { onDrop(el, target) , targets: () => [els] })
  G.draggable = (el, { targets = () => [], onDrop, axis } = {}) => {
    el.addEventListener('pointerdown', e => {
      if (e.button !== 0) return; e.preventDefault(); el.setPointerCapture(e.pointerId);
      const sx = e.clientX, sy = e.clientY; let over = null; el.classList.add('is-drag');
      const move = ev => {
        const dx = axis === 'y' ? 0 : ev.clientX - sx, dy = axis === 'x' ? 0 : ev.clientY - sy;
        el.style.transform = `translate(${dx}px, ${dy}px)` + (axis ? '' : ' rotate(-3deg) scale(1.06)');
        const hit = targets().find(t => { const r = t.getBoundingClientRect(); return ev.clientX > r.left && ev.clientX < r.right && ev.clientY > r.top && ev.clientY < r.bottom; });
        if (hit !== over) { over && over.classList.remove('is-over'); over = hit; over && over.classList.add('is-over'); }
        if (axis === 'y' && onDrop) onDrop(el, null, ev, true);
      };
      const up = ev => {
        el.releasePointerCapture(e.pointerId); el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up);
        el.classList.remove('is-drag'); el.style.transform = ''; over && over.classList.remove('is-over');
        const moved = Math.hypot(ev.clientX - sx, ev.clientY - sy) > 4;
        onDrop && onDrop(el, over, ev, false, moved);
      };
      el.addEventListener('pointermove', move); el.addEventListener('pointerup', up);
    });
  };

  // ---------- Tiny JS highlighter for mockup code editors --------------------
  // Real app: CodeMirror 6 with the Gnosia Paper/Ink theme (see DESIGN-SYSTEM.md).
  G.highlight = (src, badLine = -1) => {
    const esc = t => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
    return src.split('\n').map((line, i) => {
      let h = esc(line);
      if (/^\s*\/\//.test(line)) h = `<span class="c">${h}</span>`;
      else h = h.replace(/("[^"]*"|'[^']*'|`[^`]*`)|\b(\d+)\b|\b(const|let|var|function|return|if|else|for|of|in|while|new|typeof|true|false|null|undefined)\b|\b(console|Math|JSON)\b|\.(\w+)(?=\()|(\/\/.*$)/g,
        (m, st, n, k, o, f, c) => st ? `<span class="s">${st}</span>` : n ? `<span class="n">${n}</span>` : k ? `<span class="k">${k}</span>` : o ? `<span class="p">${o}</span>` : f ? `.<span class="f">${f}</span>` : `<span class="c">${c}</span>`);
      return `<span class="gl${badLine === i ? ' is-bad' : ''}" data-n="${i + 1}">${h || ' '}</span>`;
    }).join('');
  };
  // Run JS in-page and capture console.log (mockup only; real app uses the sandbox)
  G.runJS = src => { const logs = []; const con = { log: (...a) => logs.push(a.map(v => typeof v === 'object' ? JSON.stringify(v) : String(v)).join(' ')) };
    try { new Function('console', src)(con); return { logs }; } catch (err) { return { logs, err }; } };

  // ---------- Boot -----------------------------------------------------------
  function boot() {
    $$('.nosi').forEach(n => G.nosi(n, n.dataset.mood));
    $$('.pring[data-ring]').forEach(G.ring);
    initTilt();
    // Rise-in for [data-rise] groups (staggered)
    $$('[data-rise]').forEach((el, i) => G.rise(el, (+el.dataset.rise || i) * 70));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();

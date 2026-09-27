# GNOSIA Motion Spec

GNOSIA is meant to feel **alive and playful**, but every motion must **report a state change**. This file is the contract. The mockup implementation is `mockups/motion.js` (Web Animations API). In React, use **`motion`** (Framer Motion) with the values below.

## 1. Intensity levels (user setting, `Settings › Animasi & suara`)

| Level | `html[data-motion]` | What runs |
|---|---|---|
| **Penuh** (full, default) | `full` | Everything below: particles, confetti, card tilt, ambient aura drift, Nosi eye-follow, typewriter |
| **Kalem** (calm) | `calm` | Transitions, springs, rings, tickers, shake. **No** particles, confetti, tilt, aura drift or eye-follow |
| **Mati** (off) | `off` | No movement. State is shown through colour, icon and text only. Default when `prefers-reduced-motion: reduce` |

Persist the setting in `localStorage["gnosia-motion"]` (and the user profile). Every effect function must early-return according to the level. See `full()` / `on()` in `motion.js`.

## 2. Tokens

| Name | CSS approximation | Framer Motion | Use |
|---|---|---|---|
| `spring-gentle` | `cubic-bezier(.34,1.25,.64,1)` | `{type:"spring", stiffness:170, damping:22}` | scene enter, rings, progress, cards, map nodes |
| `spring-bouncy` | `cubic-bezier(.34,1.56,.64,1)` | `{type:"spring", stiffness:300, damping:14}` | pop, feedback bar, combo, lock opening, badges |
| `spring-snappy` | `cubic-bezier(.2,.9,.3,1.08)` | `{type:"spring", stiffness:500, damping:30}` | buttons, chips, drop settle |
| `ease-out` | `cubic-bezier(.2,.8,.2,1)` | `easeOut` | fades, shake |
| `ease-exit` | `cubic-bezier(.4,0,1,1)` | `easeIn` | leaving elements (≈ 40% shorter than enter) |
| durations | 120 / 200 / 320 / 600 ms | — | hover / state / overlay / celebration |

Animate **only `transform` and `opacity`**. The exceptions are SVG `stroke-dash*` for rings and paths, and `width` on progress bars that are already composited. Never animate layout properties inside scrolling lists.

## 3. Choreography (implement each exactly)

### 3.1 Lesson player
| Moment | Motion | Duration / curve | Level |
|---|---|---|---|
| Scene enter | from `x:+40, scale:.98, opacity:0` to rest | 600 gentle | calm+ |
| Scene leave | to `x:−40, opacity:0` | 220 exit | calm+ |
| Staggered content in a scene (`[data-rise]`) | `y:+14 → 0`, fade | 520 gentle, stagger 90 | calm+ |
| PhaseBar segment fill | width to the new % | 600 bouncy | calm+ |
| "Lanjut" press | 1 scale pop 1 → 1.12 → 1 | 380 bouncy | calm+ |
| Ambient aura | two blobs drift `translate(6vw,4vh) scale(1.08)` alternating | 22 s / 28 s ease-in-out, infinite | full |

### 3.2 Answer check (Perkuat, Kuis) — the most important choreography
**Correct**, in order, starting together:
1. The feedback bar background cross-fades to `--perkuat-soft` (320). Icon + title slide up `y:14→0` (320 bouncy).
2. The chosen option gets the `is-right` style. Other options dim to 50% opacity (Perkuat) or show right/wrong (Kuis).
3. **Particle burst** from the primary button: 14 pieces in the 4 phase colours, radius 50–100px, 700–1000 ms, `cubic-bezier(.1,.7,.3,1)`, fading out. (full)
4. The button pops (380 bouncy).
5. The XP chip ticks up (900 ease-out cubic) and a floating "+10 XP" rises 46px and fades (1100). (calm+ for the ticker, full for the float)
6. Nosi → `happy` (eyes ^ ^, hop 600 bouncy).
7. Optional sound: two sine notes, 660→880 Hz (Settings › Suara, off by default).

**Wrong**:
1. The feedback bar goes to `--uji-soft`; the title reads "Belum tepat, tidak apa-apa."
2. The answer area **shakes**: x = 0, −7, 7, −5, 4, 0 over 380 ms ease-out. (calm+)
3. Wrong parts are outlined in coral (choice / slot / line / block).
4. Nosi → `oops` (brows appear, tilt −8° → 4° → 0, 700 gentle).
5. The button turns into "Coba lagi" (coral), and the hint ladder pips fill one more step (200).
6. Never: screen flash, red overlay, life lost, or a buzzer louder than the correct sound.

### 3.3 Hints
- The hint balloon enters from Nosi: `y:+8, scale:.9 → 1` (320 bouncy), with a 16px radius and one sharp corner toward Nosi.
- Each deeper level replaces the balloon content with a cross-fade (200). Do not stack balloons.

### 3.4 Phase complete / gate unlock / chapter complete (celebrations)
1. The overlay backdrop fades in (300).
2. The card rises `y:14 → 0` (600 bouncy). Nosi is `cheer` (braces raised).
3. The phase ring arcs draw one by one: stroke length 0 → value, 900 gentle, **stagger 160 ms** per arc. The first arc starts 150 ms after the card.
4. The XP number ticks from 0 (1200).
5. **Confetti**: two cannons from x = 20% and 80% (60 particles each, 150 ms apart), phase colours. **Only** here, at the Kuis pass gate, at chapter completion, and at portfolio publish. (full)
6. After about 1100 ms the **gate unlocks**: the lock tile pops (600 bouncy), the icon swaps lock → lock-open, and a small burst of 10 particles plays. The label changes to "terbuka".

### 3.5 Kuis
| Moment | Motion |
|---|---|
| Start | 3-2-1 countdown, each digit pops (380 bouncy), 700 ms apart, optional tick sound |
| Per-question timer | SVG ring `stroke-dashoffset` linear per second. At ≤ 5 s it turns coral and the number pulses (scale 1.12, 1 s loop) |
| Combo change | chip pops with `rotate(-4°) scale(1.35)` → 1 (420 bouncy) |
| Question dots | current dot scales 1.35; answered dots turn sage/coral (200) |
| Auto-advance | 1300 ms after answering; card re-enters (scene enter) |
| Results | % ticker 0 → value (1200), pass-meter bar grows (1200 gentle), then the gate sequence (§3.4) if passed |

### 3.6 Code & tests
- **Scrubbable number (`.knob`)**: dragging horizontally changes the value by 1 step per 6px. The bound visual (box value, total) pops on each change (380 bouncy). Keyboard: ←/→ changes by one step.
- **Value flies into a box (`G.flyTo`)**: a clone travels along an arc, up 60px at the midpoint and 1.15× scale, in 700 ms `cubic-bezier(.45,.05,.3,1)`. The box pops when it lands.
- **Output bubbles**: each log line appears `y:+8, scale:.9 → 1` (320 bouncy), staggered 90–120 ms.
- **Test robots**:
  - Tests run strictly in sequence.
  - Each test goes queued → running (spinner, accent tint) → pass/fail.
  - The icon tile pops with `scale .4 → 1.15 → 1` (320 bouncy).
  - 420 ms between tests (0 when motion is off).
  - The counter "n / 4" updates per test.
  - After the last test: all pass → burst + Nosi cheer + celebration; any fail → the code card shakes once.
- **Error line**: coral background fades in (200). Never blink.
- **Typewriter** (optional, scene code): 22 ms per character with a caret in the phase colour. Skip at calm/off.

### 3.7 Navigation & surfaces
| Element | Motion |
|---|---|
| Top-nav pill | slides to the hovered link (`left/width` 320 gentle) and returns on leave |
| Cards with `[data-tilt]` | `perspective(900) rotateX(±2.5°) rotateY(±3°) translateY(-2)` following the pointer; resets on leave (full) |
| Map route | the "done" path draws to the current node (1400 gentle); nodes pop in with stagger 70 ms; the "Kamu di sini" badge bobs 4px (2.4 s loop) |
| Constellation | stars pop in (stagger 80), edges draw (800), lit stars glow-pulse (3 s loop, full) |
| Drag (tokens, Parsons) | lifted item `rotate(-3°) scale(1.06)` + shadow. Siblings reflow with FLIP (280 gentle). Drop targets scale 1.06 on hover (200 bouncy). Settle 200 snappy |
| Toast | rise in (240); leave fade + `y:4` (140 exit) |
| Page → lesson | *shared element*: the "Lanjutkan" card morphs into the scene card (use `layoutId`), 600 gentle |

## 4. Sound (optional, off by default)
Web Audio sine blips at gain ≤ 0.08:

| Event | Notes |
|---|---|
| ok | 660 → 880 Hz |
| no | 300 → 240 Hz |
| done | C–E–G–C arpeggio |
| tick | 1200 Hz |

Sound never plays without a user gesture and never plays in Uji.

## 5. Performance & accessibility
- Target 60 fps on a mid-range Android phone. Hard limits: at most 40 particles alive at once, and at most 2 infinite animations per screen (aura + one badge).
- Use `will-change` only while animating, and remove it afterwards.
- Every animated state also has a static representation (colour + icon + text). Test with intensity **Mati**.
- No motion is required to complete a task. The celebration overlays have a visible primary button immediately; nothing auto-dismisses before 5 s.
- Respect `prefers-reduced-motion` on first run; the user can still pick another level explicitly.

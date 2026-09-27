# GNOSIA — Design Handoff Package (v2 · "Jalan Pemahaman")

This folder is the **complete design** for GNOSIA, an interactive coding-learning platform. It contains no production code. You (the implementing AI/developer) will build the React + Vite + TypeScript app from it.

> **Core idea:** each chapter is a locked 4-phase journey: **Pahami** (fundamentals, animated) → **Perkuat** (adaptive practice) → **Kuis** (timed trivia gate, ≥ 70%) → **Uji** (exam *or* coding challenge). It is playful and animated, and it is deliberately **not** an IDE clone. Read `CONCEPT.md` first.

## 1. Quick start
1. Open `mockups/index.html` in a browser. No build is needed and everything is vendored locally; only Google Fonts load from the network.
2. Try the flagship flow: `pahami.html` → `perkuat.html` → `kuis.html` → `challenge.html`.
3. Every mockup has:
   - a **state switcher** (top-right, dark pill)
   - a **flow navigator** (bottom pill)
   - theme toggle (Paper/Ink)
   - `?state=…`, `?theme=ink`, `?motion=off`, `?clean=1` (hides mock chrome) URL params

   The switcher and navigator are **mockup-only**. Do not build them.

## 2. Reading order
| # | File | What it gives you |
|---|---|---|
| 1 | `CONCEPT.md` | Learning model, phase rules, gates, adaptivity, assistance ladder, mastery/XP, mentor signals, tone |
| 2 | `DESIGN-SYSTEM.md` | Themes, colours (incl. the phase palette), type, shape, icons, Nosi, syntax theme, anti-patterns, checklist |
| 3 | `MOTION.md` | Every animation: tokens, springs, choreography, intensity levels, performance |
| 4 | `INFORMATION-ARCHITECTURE.md` | Object model, unlock state machine, routes, navigation, shortcuts, system wiring |
| 5 | `COMPONENTS.md` | Component-by-component spec with states, mapped to mockup classes |
| 6 | `SCREENS.md` | All 18 screens: purpose, primary action, layout, states |
| 7 | `STATES.md` | The 23 UI states (empty/loading/error/…) with final copy |
| — | `tokens.css` / `tokens.json` | Source of truth for tokens (JSON is generated) |
| — | `mockups/` | Hi-fi interactive HTML. `base.css` (foundation), `components.css` (GNOSIA components), `motion.js` (effects kit), `app.js` (shell) |

## 3. Folder map
```
gnosia-design/
├─ README.md  CONCEPT.md  DESIGN-SYSTEM.md  MOTION.md  COMPONENTS.md
├─ INFORMATION-ARCHITECTURE.md  SCREENS.md  STATES.md
├─ tokens.css  tokens.json
├─ mockups/
│  ├─ index.html  styleguide.html
│  ├─ landing  login  dashboard  peta  bab                  (learner, around learning)
│  ├─ pahami  perkuat  kuis  ulangan  challenge             (learner, the 4 phases)
│  ├─ playground  proyek  progress  settings
│  ├─ mentor  siswa  admin  builder                         (mentor / admin)
│  ├─ base.css  components.css  motion.js  app.js
│  └─ vendor/ (lucide, canvas-confetti)
├─ scripts/
│  ├─ contrast.py            WCAG check of all token pairs (must pass)
│  ├─ build-tokens-json.py   regenerate tokens.json from tokens.css
│  └─ shot.mjs               Playwright screenshots (one page per run)
└─ _archive-v1-ide/          rejected v1 (IDE-style) — do NOT implement, reference only
```

## 4. Recommended implementation (React + Vite + TypeScript)

### 4.1 Libraries
| Need | Use | Why |
|---|---|---|
| Routing | `react-router` v7 | Routes in IA §2 |
| Server state / mock API | `@tanstack/react-query` + MSW (mock service worker) | Swap to the FastAPI backend later without touching UI |
| Client state | `zustand` | player session, settings (theme, motion, sound) |
| Animation | **`motion`** (Framer Motion) | springs/`layoutId` per MOTION.md |
| Drag & drop | **`@dnd-kit/core` + `sortable`** | TokenFill, Parsons, MatchPairs with keyboard sensors |
| Code editor | **CodeMirror 6** (`@uiw/react-codemirror` or raw) | Styleable to *not* look like VS Code. **Do not use Monaco** |
| Icons | `lucide-react` (strokeWidth 1.75) | Same set as the mockups |
| Confetti | `canvas-confetti` | Celebrations only |
| Fonts | `@fontsource-variable/newsreader`, `geist`, `@fontsource/jetbrains-mono` | Self-host |
| Styling | Plain CSS modules or Tailwind **mapped to the CSS variables** | Tokens stay in `tokens.css` |

### 4.2 Structure
```
src/
  app/            router, providers (theme, motion intensity, query), AppShell
  styles/         tokens.css (copy), base.css, global.css
  design/         Button, Badge, Card, Field, Switch, Segmented, Chip, Toast, Modal, EmptyState, Skeleton, Table
  learning/       PhaseRing, PhaseBar, PhaseSteps, PhaseTag, Gate, MasteryMeter, Nosi, Aura, Celebration
  player/         LessonPlayer, PlayerTop, Scene, FeedbackBar, useAnswerCheck()
  pahami/         VarBox, Shelf, TokenExplainer, Reveal, LiveCodeCard, Knob, sceneRegistry
  perkuat/        exercises/{Choice,TokenFill,PredictOutput,Parsons,BugPick,SliderTask,MatchPairs}, HintBalloon, runner
  kuis/           QuizIntro, Countdown, QuizTimer, Combo, QuizResults
  uji/            ExamShell, QuestionNav, SubmitDialog, ExamResult, FocusCoder, TestRobots
  code/           CodeEditor (CM6 + gnosia theme), OutputBubble, runner client (sandbox/WebSocket later)
  playground/ proyek/ progress/ map/ mentor/ admin/   feature screens
  domain/         types.ts (see INFORMATION-ARCHITECTURE §1), unlock machine, scoring (CONCEPT §3–5)
  mocks/          MSW handlers + fixtures (reuse the mockup data: Nadia, Bab 2 Variabel, Alex, XII RPL…)
```

### 4.3 Key implementation notes
- **Phase theming**: put `data-phase` on the player root (or any card); components read `--ph-ink/-fill/-soft/-line` (see `components.css` top).
- **Theme**: an inline script in `index.html` sets `data-theme` before paint (copy it from any mockup `<head>`).
- **Motion intensity**:
  - Provide `useMotionLevel()` returning `'full'|'calm'|'off'`.
  - Wrap `MotionConfig reducedMotion` for `off`.
  - Gate particles, confetti, tilt, aura and eye-follow on `full`.
- **Answer-check choreography** (MOTION §3.2) should be one reusable hook (`useAnswerCheck`) used by every exercise and by Kuis, so right/wrong feel identical everywhere.
- **Unlock logic** lives in `domain/unlock.ts` as a pure function of `ChapterProgress` (IA §1). Guards on player routes redirect locked phases.
- **Code execution**: the mockups run code in-page for demo purposes. The real app sends code to the sandbox and streams per-test results (`queued → running → pass/fail`) into `TestRobots`.
- **Nosi**: port the SVG from `mockups/motion.js` (`NOSI` constant) into `<Nosi mood size/>`; moods are CSS classes (see `components.css › NOSI`).
- **Accessibility**:
  - Every drag interaction has a tap and a keyboard path.
  - Right/wrong always shows icon + text.
  - Focus rings are visible.
  - Quiz timers use `aria-live` sparingly.
- **i18n**: UI copy is Indonesian. Extract strings into `id.json` (and later `en.json`). Code and error messages stay in English.

### 4.4 Build order (milestones)
1. Tokens + base components + theme/motion providers → port `styleguide.html` as a Storybook or `/dev/styleguide` route.
2. `LessonPlayer` + `FeedbackBar` + `useAnswerCheck` + `PhaseRing/PhaseBar` + `Nosi` + `Celebration`.
3. **Pahami** (scene registry + 3 visuals + knob) → **Perkuat** (7 exercise types + adaptivity + hints) → **Kuis** → **Uji** (exam, then challenge with CodeMirror + robots).
4. Beranda, Peta, Bab, Progres (all read `ChapterProgress`).
5. Playground, Proyek.
6. Mentor (signals from `Attempt[]`), Admin + Builder (live preview reuses player components).
7. Landing (reuses player components for the demo) + onboarding.

### 4.5 Definition of done (per screen)
- [ ] Matches the mockup in Paper and Ink at 1440px and 390px (use `scripts/shot.mjs` for reference shots).
- [ ] All states from `SCREENS.md` / `STATES.md` implemented with the given copy.
- [ ] Motion per `MOTION.md`, and correct at intensity Full / Calm / Off.
- [ ] Keyboard map from IA §4 works; no drag-only interactions.
- [ ] Only tokens used; `python3 scripts/contrast.py` passes if tokens changed.
- [ ] No IDE chrome, no emoji, no decorative gradients, and one primary action per screen.

## 5. Scripts
```bash
python3 scripts/contrast.py            # must print no FAIL
python3 scripts/build-tokens-json.py   # after editing tokens.css
node scripts/shot.mjs pahami ink 390 scene=4    # screenshot → shots/  (env: WAIT, CLICK="sel;sel", FULL=1, TAG)
```
`shot.mjs` needs a local Playwright install. Set `PW_PATH` to `node_modules/playwright` if it is not at the default path.

## 6. Why v2 (context)
The v1 concept (a persistent VS Code-like Learning IDE, archived in `_archive-v1-ide/`) was rejected as "too much like VS Code". v2 keeps the soft paper/ink visual identity and changes the core:
- **explanation-first pedagogy**, with a quiz gate before assessment
- **playful, meaningful animation**
- **cards instead of IDE panels**

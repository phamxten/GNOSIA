# GNOSIA Component Spec (v2)

Every component below exists in the mockups. The "Mockup" column tells you which class or file to inspect. The names are the suggested React component names. Props are TypeScript-flavoured. Styling uses tokens only (`tokens.css`, plus `--ph-*` scoped by `data-phase`).

Legend for states: **D** default · **H** hover · **F** focus-visible · **A** active/pressed · **X** disabled · **L** loading · **E** error/wrong · **OK** correct.

---

## 1. Shell

| Component | Mockup | Spec |
|---|---|---|
| `AppNav` (learner/mentor) | `app.js › renderNav`, `.nav` | 64px sticky bar on `--bg` at 88% opacity; gains a bottom border after 4px of scroll. Contents: logo (glyph + italic wordmark), segmented links (`.nav-links`) with a sliding `.nav-pill` (320 gentle), then right-side chips: streak flame, XP, search (⌘K), avatar. Mentor variant: `MENTOR` badge instead of streak/XP. |
| `TabBar` (≤ 760px) | `.tabbar` | Fixed bottom, 64px, 5 items with icon (20) + 10px label. Active item uses `--accent-soft` bg and `--accent` text. Add `body{padding-bottom:64px}`. |
| `AdminSidebar` | `renderAdminSidebar`, `.sidebar` | 248px, grouped (`Ringkasan`, `Konten`, `Orang`, `Sistem`), counts in mono. Footer shows the user and a theme toggle. |
| `CommandPalette` | `.palette` | ⌘K / Ctrl+K. 640px wide, top 14vh, groups "Lanjutkan / Pergi ke / Aksi", ↑↓↵ esc. Empty state: "Tidak ada hasil untuk …". |
| `Toast` | `.toast` | Bottom-right stack, 360px, icon tinted by kind, auto-dismiss 4.2 s, `aria-live=polite`. |
| `PageStateSwitcher` | `.mock-states` | **Mockup only. Do not build.** |

## 2. Lesson player (Pahami · Perkuat · Kuis · Ulangan)

### `LessonPlayer`
```ts
{ chapterId; phase: 'pahami'|'perkuat'|'kuis'|'uji'; steps: Step[]; onExit(); onPhaseComplete() }
```
- **Layout**: `grid-rows: auto 1fr auto`, full viewport, no AppNav.
- Sets `data-phase` on the root, which colours everything inside.
- Contains `Aura`, `PlayerTop`, `Stage`, and `FeedbackBar`.
- **Keyboard**:
  - Enter = primary action.
  - ← = previous scene (Pahami only).
  - 1–4 / A–D = choose an answer.

### `Aura`
Two fixed radial blobs of `--ph-fill` at 16% / 10%, drifting (see MOTION §3.1). `aria-hidden`.

### `PlayerTop`
- **Layout**: close button (X → chapter page) · `PhaseBar` · right cluster (streak, XP chip, `Nosi` 40px).
- **Mobile**: grid `auto 1fr auto`; the right cluster is hidden.

### `PhaseBar`
```ts
{ phases: {id, label, icon, state:'done'|'now'|'locked', progress:0..1}[] }
```
- 4 segments with an 8px track and a spring-animated fill in each phase's `--ph-fill`, plus a 2px highlight line.
- Labels: done ✓, now = phase icon, locked = lock icon.
- Labels collapse to icons on mobile.

### `Scene`
```ts
{ kicker, title, say?, visual?: VisualSpec, reveals?: Reveal[] }
```
- Card on `--surface`, radius 20, padding 40/44 (24/20 on mobile), float shadow. Title in serif 36.
- **Enter / leave**: MOTION §3.1.
- **Variants**: intro (objectives list), explain, summary (2×2 cards).

### `FeedbackBar`
```ts
{ state:'idle'|'ok'|'no'; primary:{label, onClick, disabled}; secondary?; message?: {title, body} }
```
- Fixed bottom, max-width 760, min-height 88.
- **idle**: shows keyboard hints.
- **ok**: sage bg, check icon, rotating praise ("Mantap!", "Tepat sekali!", "Keren!", "Betul!") + explanation.
- **no**: coral bg, rotate-ccw icon, "Belum tepat, tidak apa-apa." + hint text.
- The primary button changes label and colour per state: Periksa (sage) → Lanjut (sage) / Coba lagi (coral).
- On mobile the primary button spans the full width in ok/no.

### `PhaseComplete` / `ChapterComplete`
Modal overlay (bg 86%), radius-28 card containing:
- Nosi xl (cheer)
- eyebrow ("Fase 1 dari 4 selesai")
- serif headline with an italic key word
- stats with tickers
- `PhaseRing`
- `Gate` for the next phase
- one full-width primary button + a ghost "Nanti saja"

Confetti per MOTION §3.4.

## 3. Pahami visuals

| Component | Props | Behaviour |
|---|---|---|
| `VarBox` | `{label, value, type?, const?: boolean}` | Tag pill (phase fill) above a 132×92 box with an inner soft bottom band. Const adds a lock badge. **States**: empty, filled (pop), changed (pop), rejected (shake + error bubble). |
| `Shelf` (array) | `{items, hotIndex?}` | Slots with dashed separators and the index below. The hot slot is tinted. |
| `TokenExplainer` | `{tokens:{text, kind, explain}[]}` | Big mono line. Each token is a button (hover lift −2px, selected = phase soft + fill border). The explanation box below updates with a rise animation. Progress pips count explored tokens. Tokens may trigger visual steps (e.g. value flies into `VarBox`). |
| `Reveal` | `{question, answer}` | Dashed card; click/Enter expands with a rise animation; `aria-expanded`. Not graded. |
| `Objectives` | `{items}` | Numbered sunken rows, staggered rise. |

## 4. Code

| Component | Spec |
|---|---|
| `LiveCodeCard` | Read-only code with editable parts. **Header**: file chip with a language badge ("JS" amber) + optional status. **Body**: mono 14/1.75, faint line numbers, `.cc-line.is-lit` highlight. **Knobs** (`.knob`) are scrubbable numbers: dotted underline in phase fill, `role=slider`, drag horizontally (6px per step), ←/→ keys, min/max/step. The **output** area holds `OutputBubble`s. |
| `CodeEditor` | **CodeMirror 6** in a code card (mockup: `.editor2`, a transparent textarea over a highlighted `<pre>`). Features: line numbers, Tab = 2 spaces, ⌘/Ctrl+Enter = run, error line tint (`.is-bad`), autosave indicator ("Menyimpan… / Tersimpan"). No minimap, no tabs, no gutter icons. |
| `OutputBubble` | Chat-like bubble (radius 12/12/12/4) with a `›` prompt, mono 13. The error variant uses coral soft and shows the raw error name + message. Enters with the bubble animation. |
| `TestRobots` | List of `Robot {name, state:'queued'|'running'|'pass'|'fail', ms?, diff?}`. Each row: 28px icon tile (bot / spinner / check / x) + name + meta. Fail shows a mono diff line. Runs sequentially (MOTION §3.6). A counter "n / N" sits in the header. |
| `FocusCoder` | 2-column layout: `Brief` (sticky; story art 150px in phase soft; tags; serif title; numbered steps; lock note in Uji) + `CodeEditor` + `TestRobots`. Stacks at ≤ 1000px. |
| `NotebookCell` | Gutter (run button 32px + `[n]`) + code card. Cells share scope in order. Note cells are contenteditable prose. The "add cell" affordance appears between cells on hover. `DiagnosticPanel` (Nosi + L2 explanation + quick fix) attaches under a failing cell. |

## 5. Exercises (Perkuat) — shared contract
```ts
interface Exercise { id; type; prompt; explain; hints: [L3, L4?, L5?]; similarItemId?; conceptIds[] }
evaluate(answer) → { correct: boolean; wrongParts?: string[] }
```
Common flow: answer → Periksa → `FeedbackBar` ok/no (MOTION §3.2). Every type must support pointer, touch **and** keyboard.

| Type | Mockup | Interaction | States |
|---|---|---|---|
| `Choice` | `.choice` | Big tappable rows (min 60px, radius 14, 4px bottom lip, key badge 1–4/A–D). Single select. | D, H, A (lip compresses), picked (phase), OK (sage), E (coral), dim (50%) |
| `PredictOutput` | `.choice` + code card | Same as Choice with a code prompt above. | as Choice |
| `TokenFill` | `.slot`, `.token`, `.token-tray` | Drag a token to a dashed slot, or tap a token to fill the next empty slot. Tap a filled slot to return its token. Used tokens fade to 30%. | slot: empty, over (scale 1.06), filled, OK, E |
| `Parsons` | `.pblock` | Drag blocks vertically; siblings reflow with FLIP. Alt+↑/↓ with keyboard focus. Optional indentation (`--indent`). | D, dragging (lift + shadow), OK, E per block |
| `BugPick` | `.bugline` | Click one line (radio semantics, `role=option`). An error bubble may be shown as a clue. | D, H, picked (phase inset bar), OK, E |
| `SliderTask` | `.range` | Range input drives a code value and live readouts. Correct when the value equals the target. The readout turns sage when the target is met. | — |
| `MatchPairs` | `.mitem` | Pick left then right. A correct pair locks as done and draws a dashed connector (path draw 400). A wrong pair shakes both. Periksa is enabled when all pairs are done. | D, picked (scale 1.02), done, E |
| `HintBalloon` | `.balloon`, `.hint-ladder` | Nosi + balloon. The ladder pips (3) show levels used. | — |
| `SimilarChip` | `.similar-chip` | Amber pill "Soal serupa" on adaptively inserted items. | — |

## 6. Kuis

| Component | Spec |
|---|---|
| `QuizIntro` | Rules tiles (N soal / detik per soal / combo), callout "no hints", start button → `Countdown` (3-2-1 serif 180px, pop each). |
| `QuizTimer` | 56px SVG ring, stroke in amber; coral + pulse at ≤ 5 s. `aria-live` announces only at 10 s and 5 s. |
| `QuestionDots` | N dots: answered sage/coral, current amber scaled 1.35. |
| `Combo` | Amber pill "×2/×3" with a flame icon, bump animation, hidden at ×1. |
| `ScoreChip` | Mono 18 ticker; floating "+325" on a correct answer. |
| `QuizResults` | Serif % (96px ticker), `PassMeter` (track + amber fill + 70% mark line with label), 3 stat tiles, `Gate`, actions (pass: Ulangan / Challenge; fail: Perkuat mini / Ulangi kuis), `Review` list (✓/✗ + answer + explanation). |
| `Gate` | Tile with a 44px lock square. Locked = coral soft. Open = sage soft with a pop + burst. The label shows the reason ("kurang 10%", "terbuka · lulus minimal 70%"). |

## 7. Ulangan (exam)

| Component | Spec |
|---|---|
| `ExamShell` | Player variant: top shows a locked phase tag + exam meta + `Countdown` (mono 18 in a 44px pill; amber at ≤ 5 min, coral + pulse at ≤ 1 min). Body: `QuestionNav` (sticky, 4-col grid of 1…N; answered = coral soft, current = coral ring, flagged = amber dot) + question card + prev/next + autosave indicator. The footer holds "Kumpulkan". |
| `SubmitDialog` | Alert dialog listing unanswered and flagged questions; buttons "Cek lagi" (ghost) / "Ya, kumpulkan" (coral). |
| `ExamResult` | Serif score /100 ticker, pass badge, per-question rows (✓/✗, points, a one-line reason for wrong answers that also feeds "Perlu diulang"). |
| `OfflineBanner` | Amber callout: answers are kept locally and the timer keeps running. |

## 8. Progress & navigation widgets

| Component | Spec |
|---|---|
| `PhaseRing` | `{values:[p1,p2,p3,p4], size, stroke}` → 4 arcs with 3.5% gaps and round caps. Tracks use `--viz-track`. Arcs are coloured per phase and drawn with stagger (MOTION §3.4). Zero-value arcs are not rendered, to avoid dots. Optional centre slot. |
| `PhaseSteps` / `PhaseCard` | 4 cards: number/meta (mono 11), serif phase name, 6px bar. States: done (phase soft), now (phase ring + lift −4px), locked (dashed, faint). Clickable when not locked. Chapter page variant: bigger cards with feature list + footer. |
| `PhaseTag` | Pill with a dot, phase soft/ink/line; `is-locked` variant. |
| `MasteryMeter` | 5 segments (Dilihat → Dikuasai); `is-weak` makes the filled segments amber. |
| `StreakChip`, `XPChip` | Stat chips; the flame SVG flickers (full only). |
| `DailyGoalRing` | 76px ring in sage, "15/20" centre. |
| `MapPath` + `MapNode` | Nodes absolutely positioned on a dotted canvas. Route = Catmull-Rom → Bézier path; dashed background path + solid done path drawn up to the current node. Node: 96px disc with `PhaseRing` + 56px icon circle + name + subtitle; states done / now ("Kamu di sini" bobbing badge) / locked (dashed, 55% opacity, shake + toast on click). Click opens a `ChapterPopover` (4 phase mini-tiles + primary). |
| `Constellation` | SVG stars sized and lit by mastery. States: mastered = indigo, weak = amber, locked = dashed hollow. Prerequisite edges; hover tooltip. |
| `TrendChart` | Simple line + soft area, 5 gridlines, the last point emphasised; path-draw animation. |

## 9. Nosi
`<Nosi mood="think|happy|cheer|oops" size="sm|md|lg|xl" />`. SVG from `motion.js` (`G.nosi`):
- body = rounded rect in `--nosi-body`
- ear tufts
- belly
- eyes with pupils (eye-follow in full motion)
- lids (blink every 5 s)
- happy-eye arcs
- brows (oops)
- amber beak
- `{` `}` text braces as wings (they rise on cheer)

Mood changes retrigger the hop/tilt animation. `role="img" aria-label="Nosi"`.

## 10. Mentor

| Component | Spec |
|---|---|
| `AttentionCard` | Avatar 40 + a **sentence** (the signal, with bold numbers) + meta row (phase tag, attempts strip, pattern text, time) + actions (secondary "Lihat jawaban", primary contextual action). Hover nudges x+3. |
| `KpiTile` | Eyebrow + serif number ticker; warn variant (coral soft) for "Perlu perhatian". |
| `PhaseFunnel` | Horizontal stacked bar (56px) in phase fills, flex-grow = count, serif counts. Callout below for the detected pile-up. |
| `HardConcepts` | Rows: concept, progress bar (danger/warning/accent by %), mono %. |
| `WrongPattern` | Side-by-side mini code blocks: correct (sage) vs the learner's repeated attempt (coral lines), attempts strip, diagnosis callout, "assign scene + 3 items" action. |
| `CodeReview` | Read-only code lines; hovering a line reveals a "+" button → inline comment composer (textarea, Simpan/Batal). Saved comments render as `LineComment` (accent left border, avatar). Header actions: "Minta perbaikan" / "Setujui" (burst + confetti). Summary textarea with quick-insert chips. |
| `AssistCapSetting` | Select L2/L4/L6 per learner; note that Kuis/Uji are always locked. |

## 11. Admin

| Component | Spec |
|---|---|
| `ContentFlag` | Row: phase-tinted icon tile + title + data-driven reason ("58% salah di percobaan 1…") + open button. |
| `ChapterOutline` | Tree grouped by phase (coloured headers with counts). Items have drag handles (appear on hover) and a type label (mono 10). The selected item has a phase inset bar. The warning icon marks flagged items. |
| `SceneEditor` | Title (serif input), narration, visual type picker (cards: VarBox, Shelf, LiveCode, CallStack), code line, **StepList** (grip, number badge, description, trigger select: on token click / auto / on next, per-step preview ▶), advance rule, quick check. |
| `ExerciseEditor` | Type picker (7 + "new type"), prompt, type-specific answer editor (e.g. BugPick: lines with a radio for the faulty one), hint ladder fields L3–L5, explanation, "insert similar item if wrong" select, a **data insight** callout. |
| `QuizBankEditor` | Round settings (count, seconds, pass %, combo max) + table (question, type badge incl. trivia, % correct with danger highlighting, edit/review). |
| `ChallengeEditor` | Title, difficulty (segmented), story markdown, time limit, pass rule, assistance cap, related scene, starter code card, **TestCaseTable** (learner-facing name, check expression, hidden switch, weight). |
| `LivePreview` | Right column: device toggle (desktop/phone), a real player preview in the correct `data-phase`, "Putar semua langkah". Uses the same components as the learner app. |
| `PublishBar` | Breadcrumb, published version badge, draft autosave, "Pratinjau sebagai siswa", "Terbitkan vN". Publishing never swaps content under a learner mid-phase (they keep version N−1 until the phase ends). |

## 12. Foundation (from `base.css`)
Buttons (`.btn`, `-primary/-secondary/-ghost/-danger`, `-sm/-lg/-xl`, `-icon`, `.is-loading`, `.btn-press`, `.btn-phase/-ok/-no`), form fields (label always visible, help/error under the field), switch, segmented control, chips (single-select groups via `[data-single]`), badges, avatars, callouts, tables, empty state (dashed glyph + title + one action), skeletons (match the final layout), modal, menu. Specs match the styleguide (`mockups/styleguide.html`).

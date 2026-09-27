# GNOSIA Design System v2 — "Soft Playful Intellect"

Source of truth: `tokens.css` (with `tokens.json` generated from it by `scripts/build-tokens-json.py`). Live reference: `mockups/styleguide.html`.

## 1. Principles

1. **Understand before doing.** The UI always makes the current phase obvious through colour, label and position (see `CONCEPT.md`).
2. **One primary action per screen.** In the lesson player it lives in the bottom feedback bar, always in the same place.
3. **Every animation means something.** Examples: you understood, you are right, not yet, you levelled up, something unlocked. Nothing moves just to decorate (`MOTION.md`).
4. **Soft, not sloppy.** Warm paper neutrals, rounded shapes and tactile buttons, on top of strict typography and a 4px grid.
5. **Facts first, help second.** Errors are shown verbatim, then explained on request (assistance ladder).
6. **Never punish.** No lives, no red screens, no shaming copy. Coral means "not yet".
7. **Not an IDE.** No file trees, editor tabs, status bars or panel docks. Code lives in cards.

## 2. Themes

| Theme | When | Selector |
|---|---|---|
| **Paper** (default) | light, warm | `:root`, `[data-theme="paper"]` |
| **Ink** | dark, warm-neutral (not navy) | `:root[data-theme="ink"]`, `[data-theme="ink"]` |

- **Resolution order:** saved preference (`localStorage["gnosia-theme"]`), then `prefers-color-scheme`, then Paper. Set the attribute in an inline `<head>` script before CSS paints to avoid a flash.
- **Islands:** any element can force a theme with `data-theme="…"`, e.g. a dark preview inside a light page.

## 3. Colour

### 3.1 Neutrals (Paper / Ink)
| Token | Paper | Ink | Use |
|---|---|---|---|
| `--bg` | `#F7F6F2` | `#16171B` | page canvas (with grain overlay) |
| `--surface` | `#FFFFFF` | `#1C1D22` | cards, scenes, inputs |
| `--surface-raised` | `#FFFFFF` | `#23242A` | modals, popovers |
| `--surface-sunken` | `#F0EEE8` | `#121316` | wells, token trays, viz stages |
| `--surface-hover` | `#F3F1EC` | `#222329` | row hover |
| `--border` / `--border-strong` / `--divider` | `#E6E3DB` / `#D3CFC4` / `#EDEBE5` | `#2B2D34` / `#3A3C44` / `#25272D` | lines |
| `--text` | `#1F1E1B` | `#E9E7E2` | body (never pure black/white) |
| `--text-muted` | `#5C5A53` | `#A6A39B` | secondary |
| `--text-faint` | `#8A877E` | `#7C7A73` | meta only (≥ 3:1), never body copy |
| `--accent` | `#3E4C8A` | `#9AA6E6` | ink indigo: links, primary buttons, "you" |
| `--editor-bg` | `#FDFCFA` | `#18191D` | code cards |

### 3.2 Phase palette (the brand's main colour language)
Each phase has four tokens. Components never hard-code a phase. They read `--ph-ink / --ph-fill / --ph-soft / --ph-line`, which are set by `[data-phase="pahami|perkuat|kuis|uji"]` on any ancestor.

| Phase | `-ink` (text ≥ 4.5:1) | `-fill` (shapes ≥ 3:1) | `-soft` (bg) | `-line` (border) |
|---|---|---|---|---|
| **Pahami** indigo | `#3E4C8A` / `#A9B3F0` | `#5563C9` / `#7F8CE6` | `#EAECF8` / `#23274A` | `#C9CEEE` / `#3A4178` |
| **Perkuat** sage | `#2F6843` / `#8CCB9F` | `#4A9265` / `#5FAF79` | `#E3F0E7` / `#1C2E23` | `#BCD9C4` / `#2F4D39` |
| **Kuis** amber | `#83550A` / `#EBBC62` | `#B7790C` / `#D9A13A` | `#FAF0DB` / `#33280F` | `#EDD6A6` / `#56431C` |
| **Uji** coral | `#A23E28` / `#F29479` | `#D0603F` / `#E0704F` | `#FBE9E3` / `#3A221B` | `#F0C6B9` / `#5E3427` |

Values are Paper / Ink.

**Semantic reuse (deliberate):**
- Correct = Perkuat sage; wrong / not-yet = Uji coral; hints, XP and streak = Kuis amber. This holds in every phase.
- Right/wrong is never shown by colour alone: always add an icon (check / rotate-ccw / x) and text.
- Project accent (slate teal): `--mode-project` `#2F6773` / `#7FB8C2`.

### 3.3 Contrast (verified by `python3 scripts/contrast.py`)
All 94 checked pairs pass in both themes. The script covers:
- text on bg/surface/sunken: ≥ 4.5
- faint meta: ≥ 3
- accent and signal colours on their `-soft` backgrounds
- every phase `-ink` on surface/soft/bg
- every phase `-fill` on surface/bg: ≥ 3
- the syntax colours on `--editor-bg`

Re-run the script whenever a colour changes.

### 3.4 Where gradients are allowed
Nowhere decorative. Four functional exceptions exist:
- the ambient **aura**: two blurred radial blobs of the current phase colour at 10–16% opacity, drifting slowly
- the highlighter underline (`.hl`)
- the range track fill
- skeleton shimmer

Purple→blue gradients, glassmorphism and glowing "AI" orbs are banned.

## 4. Typography

| Role | Font | Size / line-height | Notes |
|---|---|---|---|
| Display | **Newsreader** 400 (serif, `opsz`) | 56–80 / 1.02–1.05, −0.02em | `em` = italic in accent colour |
| Scene / page title | Newsreader 400 | 36–48 / 1.15 | |
| Question title | Newsreader 400 | 28 / 1.25 (22 mobile) | |
| Score numbers | Newsreader | 72–96, tabular | results, stats |
| Narration ("say") | **Geist** 400 | 17 / 1.65, max 60ch | lesson reading |
| UI | Geist 400/500/600 | 14 / 1.45 (13, 12 for meta) | |
| Eyebrow / label | **JetBrains Mono** 500 | 11, uppercase, +0.08em | |
| Code | JetBrains Mono 400 | 14–15 / 1.75 | **ligatures OFF globally** (`font-variant-ligatures: no-contextual`), because `==` must look like what learners type |

The serif carries the "intellectual" voice. Geist handles every control. Mono is used for code, facts and labels.

## 5. Shape, space, elevation

- **Spacing:** 4px base. Tokens `--space-1…--space-24` = 4…96.
  - Inside components: 8–24.
  - Between sections: 40–56 (app), 96–130 (landing).
- **Radius:**

  | Size | Used on |
  |---|---|
  | 4 | chip |
  | 6 | input |
  | 10–12 | button |
  | 14 | answer choice, token tray |
  | 16 | card, code card |
  | 20 | scene, widget |
  | 24–28 | hero cards, celebration modal |
  | 999 | pills |
- **Elevation:**
  - Static cards: 1px border only.
  - Scenes in the player float: `0 24px 60px -32px rgba(31,30,27,.25)`.
  - Modals/popovers: `--shadow-modal`.
  - Toasts/menus: `--shadow-pop`.
- **Paper grain:** fixed SVG noise overlay, 3.5% (Paper) / 5% (Ink), `pointer-events:none`.
- **Tactile buttons (`.btn-press`):** a 3px darker "lip" under the button, which disappears on `:active` while the button moves down 3px. Answer choices and tokens use the same idea with a 3.5–4px bottom border.

## 6. Iconography

- **Lucide**, stroke 1.75 in the app. Sizes:
  - 16 in controls
  - 14 in dense rows
  - 20 in navigation
  - 24 in feedback icons
- Icon-only buttons need `aria-label` and a tooltip.
- **No emoji anywhere** in product UI.
- Phase icons:

  | Phase | Icon |
  |---|---|
  | Pahami | `book-open` |
  | Perkuat | `dumbbell` |
  | Kuis | `zap` |
  | Uji | `swords` (challenge) / `timer` (exam) |
  | Locked | `lock` |

## 7. Nosi — the guide

- A small owl whose "wings" are `{` `}` braces. It is pure SVG (`motion.js → G.nosi`) and themeable via `--nosi-body/-belly/-eye/-pupil`.
- **Moods:**

  | Mood | When | Visual |
  |---|---|---|
  | `think` | waiting | pupils up-right |
  | `happy` | correct | ^ ^ eyes + hop |
  | `cheer` | phase complete | braces raised + hop |
  | `oops` | wrong | brows + tilt |
- **Behaviour:** blinks every 5s. Pupils follow the pointer (full motion only).
- **Sizes:** 40 (top bar), 64 (hint row), 120 (intro), 180 (celebration).
- **Rules:**
  - Nosi reacts to events and never interrupts.
  - Nosi never gives the answer unprompted.
  - Nosi can be hidden in Settings; hints still work.

## 8. Code styling ("Gnosia Paper / Ink" syntax)

| Scope | Paper | Ink |
|---|---|---|
| keyword | `#3E4C8A` | `#9AA6E6` |
| string | `#36704B` | `#8CC49B` |
| number | `#8F6414` | `#DDB05F` |
| function | `#A2442C` | `#E8907A` |
| property / builtin | `#2F6773` | `#7FB8C2` |
| comment (italic) | `#858279` | `#7C7A73` |
| punctuation | `#6B6860` | `#9A978F` |

Implementation: **CodeMirror 6** with a custom `EditorView.theme` + `HighlightStyle` using these CSS variables. Monaco is avoided because it reads as "VS Code". Code cards have no minimap, no tabs, and no gutter chrome beyond faint line numbers.

## 9. Layout

- **Learner/mentor top nav** (64px):
  - logo on the left
  - segmented nav pill with a sliding indicator in the centre-left
  - streak, XP, search and avatar on the right
  - on phones it becomes a 5-item bottom tab bar
- **Admin:** 248px grouped sidebar.
- **Lesson player** (full screen, no app nav):
  - top: close button, 4-segment PhaseBar, XP chip and Nosi
  - centre: the scene card (max 760px)
  - bottom: a fixed feedback bar
- **Focus Coder:** brief on the left (sticky) and the code card with robots on the right. Stacks on narrow screens.
- **Breakpoints:** 1000px (grids collapse), 760px (phone: tab bar, compact player). Always test at 390px.

## 10. Anti-patterns (reject in review)

- IDE-like chrome: file tree, editor tabs, status bar, bottom panel dock.
- A question before its concept has been explained.
- Confetti on every correct answer (only for phase complete, gate unlock and chapter complete).
- Hearts or lives, or any penalty for being wrong.
- A floating chatbot, "AI-powered" labels, or glowing orbs.
- Gradient backgrounds, glassmorphism, emoji icons.
- Two primary buttons on one screen.
- Animations that ignore the "Mati" (off) intensity or `prefers-reduced-motion`.

## 11. Pre-delivery checklist

- [ ] Colours only via tokens; `python3 scripts/contrast.py` passes.
- [ ] Every screen tested in Paper and Ink, at 1440 and 390 wide.
- [ ] Keyboard:
  - [ ] Enter = check/next
  - [ ] 1–4 / A–D pick answers
  - [ ] ←/→ on scrubbable numbers
  - [ ] Alt+↑/↓ to reorder Parsons blocks
  - [ ] ⌘K opens the palette
  - [ ] visible focus rings
- [ ] Drag interactions all have a tap/keyboard alternative.
- [ ] Motion intensity Full / Calm / Off respected; nothing essential depends on animation.
- [ ] Right/wrong always has an icon plus text, not only colour.
- [ ] Copy follows `CONCEPT.md §7`.

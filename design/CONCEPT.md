# GNOSIA — Product Concept v2: "Jalan Pemahaman" (The Path of Understanding)

> Read this first. Every screen, component and animation in this package exists to serve the learning model below.

## 1. The one idea

Most interactive coding platforms (Brilliant-style) drop learners straight into practice and let them infer the concept. GNOSIA does the opposite on purpose:

**Understand the fundamentals first → reinforce → quick trivia check → prove it.**

Every chapter (**Bab**) is a fixed, ordered journey through four phases. A phase unlocks only when the previous one is complete. Nothing can be skipped. Nothing punishes being wrong.

| # | Phase | Indonesian UI name | Purpose | Graded? | Assistance cap |
|---|---|---|---|---|---|
| 1 | Fundamentals | **Pahami** ("understand") | Explain the concept with animated scenes and live code | No | L0–L6 (explanations are the content) |
| 2 | Reinforcement | **Perkuat** ("strengthen") | Short, varied, adaptive practice items | Accuracy tracked, never blocks | L0–L5 (hints are a ladder; full solution only after 3 tries) |
| 3 | Trivia quiz | **Kuis** | Fast timed round and the gate to the test | Yes, must reach **≥ 70%** | **Locked**. No hints, full explanations at the end |
| 4 | Test / assignment | **Uji** ("test") | Learner picks **Ulangan** (timed exam) *or* **Challenge** (coding task) | Yes, passing unlocks next Bab | **L1 only**: the error line is marked, never explained |

The four phases have four colours. Those colours are the product's primary visual language: see `DESIGN-SYSTEM.md §3`.

## 2. Content hierarchy

```
Path (Jalur)           e.g. "JavaScript Dasar"           — shown on the Map (peta.html)
 └─ Module (Modul)     e.g. "Fondasi"                     — grouping label on the map only
     └─ Chapter (Bab)  e.g. "Bab 2 · Variabel"            — the unit of the 4-phase journey
         ├─ Pahami     ordered Scenes (5–9)
         ├─ Perkuat    ordered Items (6–10) + "similar" items for adaptivity
         ├─ Kuis       Question bank (≥ 2× round size), round = N random questions
         └─ Uji        Ulangan (exam: 6–10 questions) AND/OR Challenge (coding task with tests)
 └─ Project (Proyek)   placed between chapters on the map; milestones + mentor review → portfolio
```

The Playground (free coding notebook) is outside the hierarchy. It can optionally be attached to a chapter so that hints refer to that chapter.

## 3. Phase rules (implement exactly)

### 3.1 Pahami (fundamentals)
- A sequence of **Scenes**, one idea per screen. Each scene contains: a kicker, a serif title, a short narration, and one **visual**:
  - `VarBox`: a variable as a labelled box
  - `Shelf`: an array as a shelf
  - `LiveCodeCard`: code with scrubbable numbers
  - `TokenExplainer`: tap each token of a line
  - `CallStack`: planned, not mocked
- A scene may define **animation steps** (ordered). Triggers: `onEnter`, `onTokenClick(token)`, `onNext`. Admins author these in the builder.
- A scene may require an interaction before "Lanjut" is meaningful (e.g. "all tokens clicked"). Never block silently: show progress pips ("Bagian dipahami ●●●○").
- Optional **tap-to-reveal checks** (`Reveal`). They are not graded.
- Last scene = summary cards. Completing Pahami sets mastery for the chapter's concepts to at least tier 1 ("Dilihat").
- Completion → **PhaseComplete** celebration (the only place confetti is allowed besides the gate and chapter end), then the Perkuat gate unlocks.

### 3.2 Perkuat (reinforcement)
- 6–10 items drawn from 7 item types (see `COMPONENTS.md §Exercises`):
  1. Choice
  2. TokenFill (fill-in-the-blank)
  3. PredictOutput
  4. Parsons (reorder lines)
  5. BugPick (tap the faulty line)
  6. SliderTask (set a value until a condition holds)
  7. MatchPairs
- Flow per item: answer → **Periksa** (check) → feedback bar → **Lanjut** (next) or **Coba lagi** (try again).
- **Wrong answer**:
  - The answer area shakes and wrong parts are outlined in coral.
  - The feedback bar shows the level-3 hint text.
  - The hint ladder advances one step.
  - No lives, no hearts, no score penalty. XP for that item drops from 10 to 5.
- **Adaptivity**: an item may declare `similarItemId`. On the *first* wrong answer to such an item, the similar item is inserted immediately after it (once per item). Show a toast "Soal serupa ditambahkan" and the chip "Soal serupa" on the inserted item.
- **Hints** ("Petunjuk" button, always available): L3 concept hint → L4 step-by-step → L5 related example. L6 (full solution) appears only after 3 attempts on the same item and must be confirmed.
- Completion requires every item answered correctly once (retries allowed). Show accuracy = first-try-correct / items.

### 3.3 Kuis (trivia gate)
- Intro screen with the rules (N questions, seconds per question, combo, 70% pass) → a 3-2-1 countdown → the round.
- Each question has a per-question timer (default 20 s). Answering reveals right/wrong instantly (no separate check button). Auto-advance after ~1.3 s.
- **Score** = `100 × combo + remainingSeconds × 5`. Combo starts ×1, increments on each correct answer up to ×3, and resets on a wrong answer or timeout. The score only feeds XP. **Pass/fail uses accuracy (correct/N), not score.**
- Around 20% of questions may be flagged `trivia: true` ("Fakta seru"): light history or culture facts related to the topic. They count like the rest.
- **No hints during the round.** Results show the percentage, the pass meter with a 70% mark, best combo, XP, and a full **Pembahasan** (explanation for every question, right or wrong).
- **Fail (< 70%)**:
  - The Uji gate stays locked and shows "kurang X%".
  - Offer "Perkuat mini" (3 items targeting the missed concepts) and "Ulangi kuis" (a new random draw from the bank).
  - No cooldown.
- **Pass**: gate unlock animation + confetti, then offer the two Uji options.

### 3.4 Uji (test / assignment)
- The learner chooses **Ulangan** or **Challenge**. Passing either one completes the chapter. Admins may require a specific one per chapter.
- **Ulangan (exam)**:
  - Mixed question types (choice, short text, short code).
  - Countdown for the whole exam, a question navigator, a flag-for-review option, and autosave per answer.
  - At ≤ 5 minutes left, show a warning with the unanswered questions.
  - Submit needs confirmation and lists unanswered and flagged questions.
  - Pass mark set per exam (default 75/100). Code questions are auto-tested after submission. Offline answers are kept locally and synced.
- **Challenge (coding)**:
  - Focus Coder: story brief + one Code Card + **test robots**.
  - Tests run sequentially, animated one by one. Some tests may be hidden until submit.
  - Assistance is capped at L1: the error line is highlighted and the raw error message is shown, with no explanation.
  - Pass = all required tests pass. The code goes to the mentor queue.
- Chapter complete → **ChapterComplete** celebration (ring 4/4, XP, mastery %), then the next chapter unlocks on the map.

## 4. Assistance ladder (L0–L6)

The "AI" is a diagnostic layer. It always starts from a deterministic fact (compiler/linter/test output) and never appears as a chatbot.

| Level | What the learner gets | UI |
|---|---|---|
| L0 | Nothing | — |
| L1 | Error line marked + raw message | coral line + error bubble |
| L2 | Plain-language explanation of the error | Nosi balloon "penjelasan" |
| L3 | Concept hint | balloon "Petunjuk · L3" |
| L4 | Step-by-step guidance | balloon with numbered steps |
| L5 | Related worked example | balloon + mini Code Card |
| L6 | Full solution (after 3 attempts, confirm dialog) | Code Card diff |

Per-phase caps are in §1. Mentors can lower a learner's cap (e.g. "Batasi petunjuk ke L3") for Perkuat and the Playground. When the diagnostic service is down, L1 still works (it is deterministic). Show "Penjelasan belum tersedia" for L2+.

## 5. Mastery, XP, streak

- **Mastery tiers per concept** (5-segment meter):
  1. Dilihat (seen)
  2. Dilatih (practised)
  3. Diterapkan (applied)
  4. Mahir (proficient)
  5. Dikuasai (mastered)

  Reading only reaches tier 1. Perkuat first-try accuracy moves tiers 2–3. Kuis and Uji move tiers 3–5. A concept answered wrong in Kuis/Uji is added to **Perlu diulang** (needs review) and shown with the amber "weak" meter until reviewed.
- **XP**:
  - Perkuat item: 10 (first try) or 5.
  - Kuis: score / 20.
  - Phase complete: +50 (Pahami), +75 (Perkuat), +60 (Kuis pass).
  - Chapter complete: +180.
  - XP is never removed.
- **Streak**: any completed activity ≥ the daily goal (5/10/20/30 min) counts for the day. The flame icon flickers subtly. Streak loss is shown neutrally ("Mulai lagi hari ini"), never as a failure.

## 6. Mentor signals (what makes the mentor dashboard actionable)

Compute these per learner and show them as sentences, not numbers:

| Signal | Rule | Example copy |
|---|---|---|
| Repeated failure | same item wrong ≥ 3× | "Alex salah 4× di Perkuat · Array · soal susun kode" |
| Gate failure | Kuis < 70% twice for the same Bab | "Rizky gagal gerbang Kuis Variabel dua kali (60%, 50%)" |
| Hint rushing | ≥ 3 items where all hints were opened within 30 s | "Maya membuka semua petunjuk dalam < 30 detik…" |
| Stalled | no progress in the current phase for > 3 days | "Bayu tidak maju dari Pahami · scene 4 selama 5 hari" |
| Review request | Challenge/Project submitted | "Salsa minta review · Challenge Rapor" |

Also at class level:
- **Phase funnel**: how many learners sit in each phase of a chapter. Flag a pile-up when > 40% sit in one phase for longer than the median.
- **Hardest concepts**: first-try wrong % across Perkuat/Kuis/Uji.
- **Wrong-answer patterns**: identical wrong answers across attempts are shown side by side with a one-line diagnosis.

## 7. Tone of voice (Bahasa Indonesia UI)

- Warm, short, a little playful, never childish. Use "kamu", not "Anda".
- Wrong ≠ bad: "Belum tepat, tidak apa-apa." · "Hampir!" · "Coba lihat lagi pelan-pelan."
- Right: "Mantap!" · "Tepat sekali!" · "Keren!", rotated. Do not use exclamation walls, emoji, or ALL-CAPS hype.
- Facts first: errors are shown verbatim in mono (`TypeError: Assignment to constant variable.`), then explained.
- Code, keywords and error messages stay in English. Everything else is Indonesian and i18n-ready (keys in `SCREENS.md`).

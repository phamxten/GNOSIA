# GNOSIA — Screen Specs (18 screens + styleguide)

Each entry gives the purpose, the **one primary action**, the layout, the key content, the states to build, and the mockup. Open the mockup next to this file. Mockup-only chrome (`.mock-nav`, `.mock-states`) is not product UI.

---

### 01 · Landing — `landing.html`
- **Purpose**: explain the 4-phase idea in seconds, and let visitors *play* it.
- **Primary**: "Mulai Bab 1, gratis".
- **Layout**
  ```
  [nav: logo · Cara belajar · Bedanya · Nosi · Untuk sekolah · theme · Masuk · (Mulai gratis)]
  [hero: eyebrow · "Pahami dulu. Baru ngoding." · lead · 4 phase tags · CTAs] [DEMO card: tabs Pahami|Perkuat|Kuis|Uji]
  [scrollytelling: sticky phase panel (colour, big number, icon, Nosi) ⟷ 4 steps]
  [Bedanya: "Kebanyakan platform" flow vs GNOSIA flow]
  [Nosi: 220px + mood buttons]   [Roles: Siswa · Mentor · Admin]   [CTA]   [footer]
  ```
- **Demo card**:
  - Auto-plays each phase for 7 s with a progress underline on the tab.
  - Any click stops autoplay.
  - Each phase is a real micro-interaction: the value flies into a box, a choice gives feedback, the quiz timer runs, the test robots pass.
- **States**: autoplay, user-driven, reduced motion (no autoplay, static first tab).

### 02 · Masuk / Daftar / Onboarding — `login.html`
- **Primary**: Masuk / Buat akun / Lanjut.
- **Layout**: form column + right "orbit" panel. The panel cycles the phase colour, the ring (1→4 arcs) and Nosi mood every 3.2 s.
- **Onboarding** (3 dots):
  1. Goal cards (Tugas sekolah / Karier / Bikin sesuatu / Penasaran).
  2. Placement check (1 ungraded code question) that decides the start chapter.
  3. Daily goal 5/10/20/30 minutes, plus a summary callout "Kamu mulai dari Bab 2".
- **States**: login, register with a field error ("Kata sandi tidak boleh kosong." — any non-empty password is allowed), goal, level, time.

### 03 · Beranda — `dashboard.html`
- **Primary**: "Lanjut {phase}" in the Continue card.
- **Layout**
  ```
  [greeting serif + Nosi balloon with a contextual nudge]
  [CONTINUE card: phase tag · Bab title · PhaseSteps ×4 · primary · big PhaseRing 180 "1/4 fase"]
  [Target harian ring] [Streak week dots] [Kuis harian (amber card)]
  "Perlu diulang" – 3 cards (source phase tag, why, 3-min action)
  [Dari mentor quote] [Proyek list]
  ```
- **States**: returning, **first-time** (Nosi intro, 4-phase explainer, "Mulai Bab 1", empty projects), loading (skeletons that match the layout).

### 04 · Peta — `peta.html`
- **Primary**: node popover "Masuk bab".
- **Layout**: dotted canvas (1760px tall) with a winding route and module labels; side panel with path progress ring, other paths, and a ring legend.
- **Node states**: done, now ("Kamu di sini" bobbing badge), locked (shake + toast on click). The project node uses a kanban icon.
- **States**: default, popover open (`?pop=1`), mobile (side panel first, smaller nodes).

### 05 · Bab — `bab.html`
- **Primary**: "Lanjut Perkuat · soal 4".
- **Layout**: hero (serif title, description, primary, 220px ring with Nosi), 4 **PhaseCards** (done / now / locked ×2, with feature lists), "Yang akan kamu kuasai" (concept mastery meters), "Catatan ringkas" (a code cheat sheet unlocked by Pahami).

### 06 · Pahami ★ — `pahami.html`
- **Primary**: "Lanjut" / "Selesaikan Pahami".
- **Scenes (Bab 2 · Variabel)**:
  1. Intro: definition + VarBox + 3 objectives.
  2. **TokenExplainer** `let skor = 10;`: tap each token. Tapping `skor` attaches the label; tapping `10` flies the value into the box. Progress pips track this.
  3. Reassign: LiveCodeCard with a **scrubbable** `25`; the output bubble and the box update live.
  4. let vs const: two boxes; "try to change" buttons (let changes with a pop; const shakes and shows a TypeError bubble); reveal "Jadi kapan pakai yang mana?".
  5. Naming: 3 tilt cards (valid / invalid) + reveal quiz (`class` is a keyword).
  6. Variables in calculations: two knobs → `total`, 3 boxes with × and =.
  7. Summary 2×2 + callout "Berikutnya: Perkuat".
- **Completion**: PhaseComplete (Nosi cheer, +50 XP ticker, ring 1/4, Perkuat gate unlocks).
- **States**: `?scene=1..7`, `?state=done`.

### 07 · Perkuat ★ — `perkuat.html`
- **Primary**: Periksa → Lanjut / Coba lagi.
- **Items**:
  1. Choice (let vs const for a changing score)
  2. TokenFill (`__ umur __ 16;` with distractors `const`, `==`, `:`)
  3. PredictOutput (`a = a + 2`)
  4. Parsons (4 lines)
  5. BugPick (const reassign) — **adaptive**: a first wrong answer inserts the similar item (5b, "Soal serupa")
  6. SliderTask (total = 20000)
  7. MatchPairs (4 pairs, dashed connectors)
  8. Choice (best variable name)
- **Hint button**: Nosi balloon L3 → L4 → L5.
- **Completion**: accuracy %, first-try count, +75 XP, Kuis gate unlock.
- **States**: q1, q2, q4, q5, q6, q7, done. Show right and wrong for each.

### 08 · Kuis ★ — `kuis.html`
- **Primary**: "Mulai kuis", then pass → Ulangan / Challenge, or fail → Perkuat mini / Ulangi kuis.
- **Layout**: top row = timer ring, question dots + label, combo chip, score. Question card with an optional "Fakta seru" tag and an optional code block, 2×2 choices (A–D).
- **Round**: 10 questions, 2 of them trivia. Instant reveal and auto-advance.
- **Results**: % ticker, pass meter with the 70% mark, stat tiles, gate, and **Pembahasan** for all questions.
- **States**: intro, play, pass (80%), fail (60%).

### 09 · Ulangan — `ulangan.html`
- **Primary**: "Kumpulkan", with a confirm dialog.
- **Layout**: top = locked tag + meta + countdown pill. Left = question navigator (answered / current / flagged + legend + mode note). Main = question card (choice / short text / short code), Tandai (flag), prev/next, autosave indicator.
- **States**: working, ≤ 5 min (amber timer + warning callout listing empty questions), offline (amber banner, answers kept locally), result (85/100, pass badge, per-question rows, wrong answers fed into "Perlu diulang").

### 10 · Challenge ★ — `challenge.html`
- **Primary**: "Jalankan tes" (⌘↵).
- **Layout**: FocusCoder. Brief (animated scoreboard art, tags, story, 4 numbered steps, "Bantuan terkunci" note) | CodeEditor + output bubbles + **TestRobots** ×4.
- **Behaviour**: code really runs in the mockup; the const-reassign line is marked (L1).
- **States**: attempt (bug → TypeError, 1/4), start (starter comments only), solved (4/4 → ChapterComplete: ring 4/4, +180 XP, 86% mastery, "Bab 3 · Tipe Data").

### 11 · Playground — `playground.html`
- **Primary**: "Notebook baru" / run a cell (⇧↵).
- **Layout**: notebook list (left) | context chip (attach Bab → hints reference it) + serif title + cells.
- **Cells**: shared scope, run button with a counter, output bubbles. Cell 3 has a typo, which produces a **Nosi diagnostic (L2)** with a one-click fix.
- **States**: notebook, empty (Nosi + "Kertas kosong. Mau coba apa?").

### 12 · Proyek — `proyek.html`
- **Primary**: "Minta review mentor".
- **Layout**: header + 4 **milestones** (done / now / next) | left: milestone checklist + robots + mentor thread | right: code card + output.
- **States**: working, waiting (badge + callout "tetap bisa lanjut Bab 5"), **feedback** (line comments inline in the code, "2 komentar baru"), portfolio (published app card + confetti).

### 13 · Progres — `progress.html`
- **Layout**: 4 KPIs (tickers), **Constellation** (stars lit by mastery, weak = amber, locked = hollow, hover tooltip), trend chart (8 weeks), "Perlu diulang" + last mentor note, per-chapter × per-phase table.

### 14 · Pengaturan — `settings.html`
- **Sections**:
  - Akun.
  - Tampilan: Paper / Ink / system cards with previews.
  - **Animasi & suara**: intensity cards Penuh / Kalem / Mati with a **live try zone** (correct / wrong / phase complete), sound toggle, Nosi toggle.
  - Belajar: daily goal, language, reminders.
  - Privasi: the mentor can see wrong answers; delete account (danger).

### 15 · Mentor — `mentor.html`
- **Primary**: the contextual action on each attention card.
- **Layout**: class header + "Beri tugas", 4 KPI tiles ("Perlu perhatian" in coral), **Perlu perhatian sekarang** (4 sentence cards), class **phase funnel** + pile-up callout, hardest concepts, roster table (phase tag, mastery, activity, signal badge).

### 16 · Detail siswa — `siswa.html`
- **Tabs**:
  - Jawaban salah: **WrongPattern** — correct order vs the repeated wrong order, 4 fails, a diagnosis ("let total = 0 di dalam loop → scope & urutan"), and "Tugaskan scene + 3 soal".
  - Review kode: CodeReview with 2 line comments, add-comment on hover, "Minta perbaikan" / "Setujui".
  - Timeline: phase-coloured events.
- **Right column**: path ring, weak concepts, **assistance cap** for this learner.

### 17 · Admin — `admin.html`
- **Layout**: KPIs (active learners + sparkline, published chapters, gate pass rate, average time per chapter), **Konten yang perlu dicek** (4 data-driven flags, one per phase), learner distribution by phase, content status, recently edited chapters table.

### 18 · Builder — `builder.html`
- **Primary**: "Terbitkan v4".
- **Layout**: publish bar | outline tree by phase | editor | **live preview**.
- **Editors** (states):
  - scene: visual type, code, **animation step list** with per-step ▶ that plays in the preview.
  - soal: 7-type picker, bug-line editor, hint ladder, similar-item link, data insight.
  - kuis: round settings + bank table with % correct.
  - challenge: meta, starter code, **test case table** with hidden toggles.

### Styleguide — `styleguide.html` · Index — `index.html`
Living design system (with **interactive effect buttons** and an intensity switch) and a gallery of all screens.

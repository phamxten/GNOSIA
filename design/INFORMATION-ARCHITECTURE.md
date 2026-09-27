# GNOSIA — Information Architecture & Navigation (v2)

## 1. Object model

```
User ──┬─ role: learner | mentor | admin
       └─ belongs to Organization (school) ── Class (e.g. "XII RPL") ── Mentor(s)

Path (Jalur)
 └─ Module (label only)
     ├─ Chapter (Bab)
     │   ├─ PahamiPhase    → Scene[]           (visual, steps[], reveals[])
     │   ├─ PerkuatPhase   → Exercise[]        (7 types, similarItemId?)
     │   ├─ KuisPhase      → QuestionBank      (roundSize, secondsPerQ, passPct=70)
     │   └─ UjiPhase       → Exam? + Challenge? (learner picks one unless admin forces)
     └─ Project (between chapters) → Milestone[] → mentor Review → Portfolio

Notebook (Playground) ── optional attachedChapterId
Concept ── many-to-many with Scene/Exercise/Question/Test (drives Mastery & "Perlu diulang")
```

### Learner progress (what the UI reads)
```ts
type PhaseId = 'pahami' | 'perkuat' | 'kuis' | 'uji';
interface ChapterProgress {
  chapterId: string;
  phases: Record<PhaseId, { state: 'locked' | 'open' | 'done'; progress: number /*0..1*/; score?: number }>;
  current: PhaseId;                // the one the "Lanjutkan" button opens
}
interface ConceptMastery { conceptId: string; tier: 0|1|2|3|4|5; weak: boolean; lastEvidence: string }
interface Attempt { itemId; phase: PhaseId; correct: boolean; answer: unknown; hintLevelUsed: number; ms: number; at: string }
```

### Unlock state machine (per chapter)
```
pahami:open ──complete──▶ pahami:done + perkuat:open
perkuat:open ──all items correct once──▶ perkuat:done + kuis:open
kuis:open ──round ≥ 70%──▶ kuis:done + uji:open        (round < 70% → stays open; offer Perkuat mini)
uji:open ──exam ≥ passMark OR all challenge tests──▶ uji:done → chapter done → next chapter pahami:open
```

## 2. Sitemap & routes

### Learner (top nav: Beranda · Peta · Playground · Proyek · Progres)
| Route | Screen | Mockup |
|---|---|---|
| `/` | Landing (logged out) | `landing.html` |
| `/masuk`, `/daftar`, `/mulai/:step` | Auth + onboarding (goal → placement → daily goal) | `login.html` |
| `/beranda` | Dashboard | `dashboard.html` |
| `/peta/:pathId` | Path map | `peta.html` |
| `/bab/:chapterId` | Chapter overview (4 phase cards) | `bab.html` |
| `/bab/:chapterId/pahami?scene=n` | Lesson player · Pahami | `pahami.html` |
| `/bab/:chapterId/perkuat?item=n` | Lesson player · Perkuat | `perkuat.html` |
| `/bab/:chapterId/kuis` | Quiz round | `kuis.html` |
| `/bab/:chapterId/uji/ulangan` | Exam | `ulangan.html` |
| `/bab/:chapterId/uji/challenge` | Challenge (Focus Coder) | `challenge.html` |
| `/playground`, `/playground/:notebookId` | Notebook | `playground.html` |
| `/proyek/:projectId` | Project + review thread | `proyek.html` |
| `/progres` | Mastery constellation, trend, per-chapter table | `progress.html` |
| `/pengaturan` | Settings | `settings.html` |

Player routes hide the app nav and are **resumable**: reopening restores the scene/item index, filled answers and hint level. Direct links to locked phases redirect to `/bab/:id` with a toast "Selesaikan {phase} dulu".

### Mentor (top nav: Ringkasan · Siswa · Antrian review)
| Route | Screen | Mockup |
|---|---|---|
| `/mentor` | Class overview (attention list, funnel, hardest concepts, roster) | `mentor.html` |
| `/mentor/siswa/:userId` | Student detail (wrong-answer patterns, code review, timeline) | `siswa.html` |
| `/mentor/review` | Review queue (challenges & project milestones) | `siswa.html#review` |

### Admin (sidebar: Ringkasan · Konten · Orang · Sistem)
| Route | Screen | Mockup |
|---|---|---|
| `/admin` | Curriculum dashboard, data-driven content flags | `admin.html` |
| `/admin/bab/:chapterId?edit=scene:n\|item:n\|kuis\|challenge\|ulangan` | Builder | `builder.html` |
| `/admin/{soal,kuis,challenge,ulangan,proyek,pengguna,mentor,sekolah,langganan,izin}` | Lists (table + filters). Not mocked; reuse the table/filters pattern | — |

## 3. Navigation model

- **Global**: top nav (learner/mentor) or sidebar (admin), plus the **Command palette ⌘K** everywhere except inside Kuis and Uji (disabled there to protect assessment integrity).
- **Primary loop**: Beranda "Lanjutkan" → the exact phase and step where the learner stopped. This is the single most important link in the product.
- **Chapter hub**: the map node popover or chapter page lists the 4 phases; only open phases are clickable.
- **Inside the player**: X returns to the chapter page (progress is kept). There is no other navigation, which keeps focus.
- **After a phase**: the celebration offers exactly one primary action (next phase) plus "Nanti saja".
- **Mobile**: bottom tab bar (5 items); the player is full screen with a compact PhaseBar.

## 4. Keyboard

| Keys | Where | Action |
|---|---|---|
| ⌘K / Ctrl+K | app | Command palette |
| Enter | player | Primary action (Lanjut / Periksa / Coba lagi) |
| ← | Pahami | Previous scene |
| 1–4 or A–D | Perkuat choice, Kuis, Ulangan | Pick option |
| ←/→ | focused scrubbable number | −/+ one step |
| Alt+↑ / Alt+↓ | focused Parsons block | Move block |
| ⌘/Ctrl+Enter | code editor, notebook cell (⇧Enter) | Run |
| Tab | code editor | Insert 2 spaces |
| Esc | palette / dialogs | Close |

## 5. System relationships (how the product is wired)

```
Scene ──teaches──▶ Concept ◀──tests── Exercise / Question / Test
  │                    │
  ▼                    ▼
Pahami done ──unlocks──▶ Perkuat ──adaptive similar item──┐
                         │                                │
                         └──accuracy──▶ Mastery tier ◀────┘
Kuis (≥70%) ──unlocks──▶ Uji ──pass──▶ Chapter done ──▶ Map / next Bab
   │                       │
   └──wrong answers──▶ "Perlu diulang" ◀── wrong Uji items
                                │
Attempts + hint usage ──signals──▶ Mentor attention list ──actions──▶ assign scene/items, cap hints, review code
Content stats (wrong %, drop-off) ──flags──▶ Admin dashboard ──edit──▶ Builder ──publish vN──▶ learners (after current phase)
Playground ──optional attach──▶ Chapter (hints reference it; nothing graded)
Project milestones ──review──▶ Mentor ──approve──▶ Portfolio
```

## 6. Real-time & backend touchpoints (for later; the frontend should be ready)

- **Code execution**: in the mockups, code runs in the browser for demo purposes. In production, send it to the sandbox and **stream test results per test over WebSocket**. The Robots UI already models `queued → running → pass/fail` sequentially.
- **Autosave**: debounce 600 ms, with the states "Menyimpan… / Tersimpan / Tersimpan di perangkat ini (offline)".
- **Diagnostics service**: input = structured error plus context `{chapterId, conceptIds, assistanceCap}`, output = explanation per ladder level. When it is unavailable, fall back to L1.
- **Versioned content**: each attempt records the content version.

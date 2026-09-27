export type PhaseId = 'pahami' | 'perkuat' | 'kuis' | 'uji';
export type PhaseState = 'locked' | 'open' | 'done';
export const PHASES: PhaseId[] = ['pahami', 'perkuat', 'kuis', 'uji'];
export const PHASE_LABEL: Record<PhaseId, string> = { pahami: 'Pahami', perkuat: 'Perkuat', kuis: 'Kuis', uji: 'Uji' };
export const PHASE_ICON: Record<PhaseId, string> = { pahami: 'book-open', perkuat: 'dumbbell', kuis: 'zap', uji: 'swords' };

export type Person = { id: number; name: string; initials: string; avatar: string; role: string };

export type Me = Person & {
  email: string; title: string; onboarded: boolean; goal: string; daily_goal_min: number; assist_cap: number;
  prefs: { nosi?: boolean; reminders?: boolean; mentor_sees_wrong?: boolean; language?: string };
  class: { id: number; name: string } | null; org: string | null;
  streak: number; xp_week: number; xp_total: number; today_minutes: number; unread: number; joined: string | null;
};

export type ChapterRef = { id: number; slug: string; title: string; number: number; published: boolean };

export type PhaseMeta = {
  id: PhaseId; label: string; state: PhaseState; progress: number; meta: string; short: string; icon: string;
  score: number | null; link: string;
};

export type PlayerHeader = { chapter: ChapterRef; phases: PhaseMeta[]; xp: number; streak: number };

export type ReviewCard = {
  concept: string; name: string; phase: PhaseId; source: string; note: string; tier: number; chapter: string;
  action: { label: string; icon: string; href: string };
};

export type MentorNote = { mentor: Person; ago: string; context: string; body: string; unread: number; href: string } | null;

export type ContinueCard = {
  chapter: ChapterRef; path: { slug: string; title: string }; phase: PhaseId; phase_label: string; phases: PhaseMeta[];
  ring: number[]; done: number; primary: { label: string; href: string }; eta: number;
};

export type Home = {
  first_time: boolean; nudge: string; continue: ContinueCard | null;
  goal: { minutes: number; target: number };
  streak: { days: number; week: { label: string; on: boolean; today: boolean }[] };
  daily_quiz: { available: boolean; done_today: boolean; xp: number };
  review: ReviewCard[]; mentor: MentorNote;
  projects: { id: number; title: string; meta: string; ring: number[]; href: string }[];
  notebook: { id: number; title: string; ago: string } | null;
  next_project: { title: string; after: number } | null;
  first_chapter: ChapterRef | null;
};

export type MapNode = {
  id: number; number: number; kind: 'chapter' | 'project' | 'final'; title: string; subtitle: string; icon: string; module: string;
  x: number; ring: number[]; phases: { id: PhaseId; label: string; value: number }[];
  state: 'done' | 'now' | 'open' | 'soon' | 'locked'; href: string; lock_message: string; published: boolean;
};

export type MapData = {
  path: { slug: string; title: string; description: string }; nodes: MapNode[]; current_id: number | null;
  summary: { chapters_done: number; chapters_total: number; phases_done: number; phases_total: number; pct: number; ring: number[] };
  other_paths: { slug: string; title: string }[];
};

export type Skill = { key: string; name: string; skill: string; tier: number; weak: boolean };

export type ChapterOverview = {
  chapter: ChapterRef & { description: string; subtitle: string; icon: string; module: string };
  path: { slug: string; title: string }; position: { number: number; total: number };
  phases: PhaseMeta[]; current: PhaseId; completed: boolean; ring: number[];
  primary: { label: string; href: string; phase: PhaseId }; eta: { total: number; left: number };
  facts: {
    scenes: number; live: number; pahami_minutes: number; items: number; types: number; round: number; seconds: number; pass_pct: number;
    exam: { count: number; minutes: number; pass: number } | null; challenge: { title: string } | null; uji_mode: string;
  };
  skills: Skill[]; cheatsheet: string | null;
};

// ---------------------------------------------------------------- content
export type Visual =
  | { type: 'intro'; side?: { kind: 'box' | 'bubble'; tag?: string; val?: string; type?: string; text?: string }; objectives_label?: string; objectives: string[] }
  | { type: 'tokens'; tokens: { text: string; cls?: string; key: string; explain: string; effect?: 'pop' | 'tag' | 'fly' | 'none' }[]; suffix?: string;
      target: { kind: 'box' | 'output'; tag?: string; val?: string; type?: string }; start?: string }
  | { type: 'livecode'; file?: string; status?: string; lines: string[]; lit?: number[]; knob: { min: number; max: number; step?: number; value: number; label?: string };
      outputs?: string[]; box?: { tag: string; type?: string }; note?: string }
  | { type: 'trychange'; boxes: { tag: string; val: string; alt?: string; kind: 'let' | 'const'; button: string }[]; error?: string }
  | { type: 'cards'; cards: { label: string; code: string; tone?: 'ok' | 'bad' | 'muted'; note: string }[] }
  | { type: 'knobcalc'; file?: string; lines: string[]; lit?: number[]; knobs: Record<string, { min: number; max: number; step?: number; value: number }>;
      formula: { a: string; op: '*' | '+' | '-'; b: string }; result: string; output_prefix?: string }
  | { type: 'summary'; cards: { icon: string; title: string; body: string }[]; callout?: { icon: string; html: string } }
  | { type: 'code'; file?: string; lines: string[]; outputs?: string[] }
  | { type: 'shelf'; name: string; items: (string | number)[]; hot?: number };

export type Scene = {
  id: string; kicker: string; title: string; say?: string; lead?: string; visual?: Visual;
  reveals?: { q: string; a: string }[]; steps?: { desc: string; trigger: string }[]; advance?: 'free' | 'all_tokens'; concepts?: string[];
};

export type Exercise = {
  id: string; type: 'choice' | 'predict' | 'fill' | 'parsons' | 'bug' | 'slider' | 'match'; title: string; help?: string; label?: string;
  choices?: string[]; code?: string; cols?: number; tray?: { val: string; label: string }[]; lines?: (string | { id: string; code: string })[];
  error?: string; min?: number; max?: number; value?: number; var?: string; result?: { label: string; mul: number }; target?: number; lit?: number[];
  left?: { key: string; text: string }[]; right?: { key: string; text: string }[]; left_code?: boolean; right_code?: boolean;
  similar?: boolean; adaptive?: boolean; has_hints: string[]; has_solution: boolean; concepts?: string[];
};

export type KuisQuestion = { id: string; t: string; c?: string; o: string[]; trivia?: boolean };

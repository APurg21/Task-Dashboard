// ============================================================
// COSMIC COMMAND — data contracts (all 17 modules)
// Every component takes typed props shaped like these. Adapters
// return these types so UI never talks to a raw API.
// ============================================================

export type Priority = "high" | "med" | "low";
export type LifeTag = "body" | "money" | "people" | "mind" | "admin";
export type PulseColor = "green" | "yellow" | "red";
export type Accent = "uv" | "cyan" | "violet" | "magenta" | "amber";

// ---------- shared ----------
export interface Task {
  id: string;
  title: string;
  sub?: string;
  priority: Priority;
  done?: boolean;
  due?: string;          // ISO or human ("4:00p")
  source?: string;       // "gmail" | "pipedrive" | "voice" | "manual"
}

export interface LifePriority {
  id: string;
  title: string;
  sub?: string;
  tag: LifeTag;
  done?: boolean;
}

export interface Meeting {
  id: string;
  time: string;          // "10:30a"
  title: string;
  where?: string;
  attendees?: string[];
}

export interface EmailItem {
  id: string;
  subject: string;
  from: string;
  ageDays: number;
  action: "reply" | "soon" | "fyi";
  threadUrl?: string;
}

// ---------- 1. Daily Command Center ----------
export interface DailyCommand {
  greetingName: string;
  dateLabel: string;
  headline: string;      // "What matters today?"
  topTasks: Task[];              // top 3 work
  lifePriorities: LifePriority[];// top 3 life  (module 11)
  meetings: Meeting[];
  emails: EmailItem[];
  hotLeads: Deal[];
  pulses: { money: MoneyPulse; body: BodyPulse; clean: CleanLifeScore };
}

// ---------- 2. Chief of Staff Chat ----------
export interface ChatMessage { role: "ai" | "me"; text: string; ts?: number; }
export interface ChiefOfStaffAnswer { text: string; actions?: { label: string; kind: string }[]; }
export type ChiefOfStaffAsk = (question: string, ctx: unknown) => Promise<ChiefOfStaffAnswer>;

// ---------- 3. Sales Pipeline Brain ----------
export type DealHeat = "hot" | "warm" | "cold" | "stalled";
export interface Deal {
  id: string;
  name: string;
  amount: number;
  stage: string;
  probability: number;   // 0..1
  heat: DealHeat;
  ageDays: number;
  closeEta?: string;
  nextAction?: string;
  sayNext?: string;      // AI-suggested line
  contact?: string;
}
export interface PipelineSummary {
  projected: number;
  weighted: number;
  stalledCount: number;
  best: Deal[];
  stalled: Deal[];
}

// ---------- 4. Follow-Up Radar ----------
export interface WarmLead {
  id: string;
  name: string;
  channel: "email" | "call" | "text";
  lastTouchDays: number;
  value?: number;
  reason?: string;       // "opened proposal 2x"
}

// ---------- 5. Voice-to-Task (Telegram) ----------
export interface VoiceCapture {
  id: string;
  transcript: string;
  durationSec: number;
  receivedAt: number;
  parsed: {
    tasks: Task[];
    crmNotes: { contact: string; note: string }[];
    calendarBlocks: { title: string; start: string; end: string }[];
  };
}

// ---------- 6. Obsidian Knowledge Assistant ----------
export interface NoteHit {
  id: string;
  title: string;
  excerpt: string;
  path: string;
  editedLabel: string;
  score?: number;
}
export type ObsidianSearch = (query: string) => Promise<NoteHit[]>;

// ---------- 7. Weekly Sales Story ----------
export interface WeeklyStory {
  whatHappened: string;
  why: string;
  whatsNext: string;
  metrics?: { label: string; value: string; delta?: string }[];
}

// ---------- 8. Writing Style Clone ----------
export interface StyleProfile {
  greetings: string[];
  signoffs: string[];
  phrases: string[];      // "the one that books fast"
  avgSentenceLen: number;
  tone: string;           // "warm-direct"
}
export interface DraftRequest { to: string; intent: string; context?: string; }
export interface Draft { to: string; subject?: string; body: string; matched: string[]; }

// ---------- 9. What Am I Missing ----------
export type BlindSpotSeverity = "critical" | "warn" | "good";
export interface BlindSpot {
  id: string;
  severity: BlindSpotSeverity;
  title: string;
  detail?: string;
  fix?: { label: string; kind: string };
}

// ---------- 10. Travel Mode ----------
export interface TravelContext {
  active: boolean;
  city: string;
  dates: string;
  logistics: { icon: "flight" | "hotel" | "car"; title: string; sub: string }[];
  cityNotes: string;
  people: { name: string; note: string }[];
  spots: { name: string; kind: "coffee" | "gym" | "food" | "prospect"; meta: string }[];
}

// ---------- 12. Money Pulse ----------
export interface MoneyPulse {
  color: PulseColor;
  spent: number;
  budget: number;
  daysLeft: number;
  categories: { label: string; amount: number }[];
  note?: string;
}

// ---------- 13. Body Pulse ----------
export interface BodyPulse {
  color: PulseColor;
  training: { done: number; target: number; nextLabel?: string };
  sleepHrs: number;
  steps: number;
  foodLabel: string;     // "on plan"
  note?: string;
}

// ---------- 14. Clean Life Score ----------
export interface CleanItem { id: string; label: string; done: boolean; meta?: string; }
export interface CleanLifeScore { score: number; outOf: number; items: CleanItem[]; }

// ---------- 15. Self-Improvement Plan ----------
export interface ImprovementMove {
  axis: "career" | "body" | "money" | "social";
  move: string;
  progress?: string;
}

// ---------- 16. Impulse Check ----------
export interface ImpulseQuestion { q: string; options: { label: string; weight: number }[]; }
export interface ImpulseVerdict { go: boolean; reason: string; }

// ---------- 17. Sunday Reset ----------
export interface WeekPlan {
  bigRock: string;
  workBlocks: string[];
  body: string;
  money: string;
  social: string;
}

// ---------- top-level dashboard state ----------
export interface CommandCenterData {
  daily: DailyCommand;
  pipeline: PipelineSummary;
  radar: WarmLead[];
  travel: TravelContext;
  improvement: ImprovementMove[];
  weekPlan: WeekPlan;
  story: WeeklyStory;
  style: StyleProfile;
}

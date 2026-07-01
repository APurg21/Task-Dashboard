// ============================================================
// COSMIC COMMAND — mock data.
// Lets every component render before a single integration exists.
// mockAdapters is the fallback wired in lib/adapters/index.ts.
// ============================================================
import type {
  Adapters,
} from "./adapters/index";
import type {
  CommandCenterData, MoneyPulse, BodyPulse, PipelineSummary,
  WarmLead, EmailItem, Meeting, NoteHit, WeeklyStory, ChiefOfStaffAnswer,
} from "./types";

export const moneyPulse: MoneyPulse = {
  color: "yellow", spent: 1840, budget: 2200, daysLeft: 4,
  categories: [
    { label: "Dining", amount: 420 }, { label: "Gas", amount: 95 },
    { label: "Golf", amount: 140 }, { label: "Subs", amount: 88 },
  ],
  note: "84% of budget with 4 days left. One big spend flips this red.",
};

export const bodyPulse: BodyPulse = {
  color: "green",
  training: { done: 3, target: 4, nextLabel: "push tonight" },
  sleepHrs: 7.4, steps: 9100, foodLabel: "on plan",
};

export const pipeline: PipelineSummary = {
  projected: 148000, weighted: 92000, stalledCount: 6,
  best: [
    { id: "d1", name: "Lehigh Valley — season group blocks", amount: 28000, stage: "Proposal", probability: .78, heat: "hot", ageDays: 9, closeEta: "Jul 18", contact: "Coach Ruiz", sayNext: "Locking the Jul 18 date holds your 15% group rate — want the contract today?" },
    { id: "d2", name: "Richmond Chamber — sponsor night", amount: 14000, stage: "Negotiation", probability: .55, heat: "warm", ageDays: 6, contact: "Dana", sayNext: "The glow-night slot books fast. Coffee this week to walk the tiers?" },
  ],
  stalled: [
    { id: "d3", name: "Werner Park — youth league day", amount: 9000, stage: "Demo done", probability: .3, heat: "stalled", ageDays: 11, contact: "—", sayNext: "Quick one — hold your spring date or open it up?" },
  ],
};

export const radar: WarmLead[] = [
  { id: "l1", name: "Richmond Chamber — Dana", channel: "email", lastTouchDays: 2, value: 14000, reason: "opened proposal 2x" },
  { id: "l2", name: "IronPigs group — Coach Ruiz", channel: "call", lastTouchDays: 3 },
  { id: "l3", name: "Corporate outing — Markel", channel: "email", lastTouchDays: 4 },
  { id: "l4", name: "Little League — Chesterfield", channel: "email", lastTouchDays: 5 },
  { id: "l5", name: "Birthday block — Hann family", channel: "text", lastTouchDays: 6 },
];

export const emails: EmailItem[] = [
  { id: "e1", subject: "Chamber — sponsorship follow-up", from: "Richmond Chamber", ageDays: 2, action: "reply" },
  { id: "e2", subject: "Lottery buyer — refund question", from: "warm lead", ageDays: 0, action: "soon" },
  { id: "e3", subject: "Glowtronics — UV apparel quote", from: "Shindig", ageDays: 1, action: "soon" },
];

export const meetings: Meeting[] = [
  { id: "m1", time: "10:30a", title: "IronPigs — group sales sync", where: "Zoom" },
  { id: "m2", time: "1:00p", title: "Cosmic Takeover ops standup", where: "team of 5" },
  { id: "m3", time: "3:30p", title: "Whitecaps report review", where: "call" },
];

export const story: WeeklyStory = {
  whatHappened: "Closed $22K in group blocks, added 9 leads. Pipeline up 14% WoW.",
  why: "The draw-radius report (81% of buyers inside 50 mi) made the season-block pitch land.",
  whatsNext: "Push Lehigh Valley to signature by Jul 18; revive 6 stalled deals with the 'hold your date' angle.",
  metrics: [{ label: "Closed", value: "$22K", delta: "+14%" }, { label: "New leads", value: "9" }],
};

const notes: NoteHit[] = [
  { id: "n1", title: "Group Sales Script — Glow Night pitch", path: "/Sales/scripts.md", editedLabel: "12d ago",
    excerpt: "Lead with the draw-radius proof (81% inside 50mi), then the 'hold your date' urgency close." },
  { id: "n2", title: "Prospecting Framework — Warm the ring", path: "/Sales/frameworks.md", editedLabel: "1mo ago",
    excerpt: "3 touches: value, proof, ask. The 2nd touch is where deals die — automate it." },
];

const chiefAnswers: Record<string, string> = {
  follow: "Top follow-ups: 1) Chamber — Dana (2d, $14K, aging) 2) Lehigh Valley — Ruiz (3d, $28K) 3) Werner Park (stalled 11d). Draft all three in your voice?",
  changed: "Since yesterday: Lehigh Valley → Proposal 78%; 2 lottery buyers replied; Whitecaps data landed; Money Pulse ticked yellow.",
  next: "Send the IronPigs draw-radius report — drafted, due 4p, unlocks the $28K season-block pitch.",
  report: "Weekly story drafted (What happened / Why / Next) — it's on the Work tab, ready to copy.",
};

export const commandCenterMock: CommandCenterData = {
  daily: {
    greetingName: "Alex", dateLabel: "Wed · Jul 1", headline: "What matters today?",
    topTasks: [
      { id: "t1", title: "Send IronPigs GM the draw-radius report", sub: "due 4:00p · drafted", priority: "high" },
      { id: "t2", title: "Lock 50/50 raffle pricing — Cosmic Takeover", sub: "needs sign-off", priority: "high" },
      { id: "t3", title: "Reply to Fan Experience candidate", sub: "offer ready", priority: "high" },
    ],
    lifePriorities: [
      { id: "p1", title: "Push day at the gym", sub: "upper/lower · day 3", tag: "body" },
      { id: "p2", title: "Call mom back", sub: "owe her since Sunday", tag: "people" },
      { id: "p3", title: "Move $500 to brokerage", sub: "before the weekend", tag: "money" },
    ],
    meetings, emails, hotLeads: pipeline.best,
    pulses: {
      money: moneyPulse, body: bodyPulse,
      clean: { score: 7, outOf: 10, items: [
        { id: "c1", label: "Apartment tidy", done: true, meta: "done Mon" },
        { id: "c2", label: "Laundry", done: false, meta: "2 loads" },
        { id: "c3", label: "Groceries", done: false, meta: "list ready" },
        { id: "c4", label: "Car — wash", done: true, meta: "oil due 400mi" },
        { id: "c5", label: "Admin — 2 bills, 1 form", done: false, meta: "10 min" },
      ] },
    },
  },
  pipeline, radar,
  travel: {
    active: false, city: "Austin, TX", dates: "Jul 8–10",
    logistics: [
      { icon: "flight", title: "RIC → AUS · AA 1422", sub: "Jul 8 · 7:05a · 14C" },
      { icon: "hotel", title: "Hotel Van Zandt · Rainey St", sub: "check-in 3p" },
    ],
    cityNotes: "No state income tax vs. Richmond. Book prospects mid-morning; traffic 4–6p.",
    people: [{ name: "Round Rock Express — group sales", note: "intro warm" }],
    spots: [{ name: "Jo's Coffee (Rainey)", kind: "coffee", meta: "3 min" }, { name: "Big Tex Gym", kind: "gym", meta: "6 min" }],
  },
  improvement: [
    { axis: "career", move: "Ship the sales dashboard MVP to Vercel", progress: "this week" },
    { axis: "body", move: "4 lifts + 2 golf-mobility sessions", progress: "3 of 4" },
    { axis: "money", move: "Move $500 to brokerage, cancel 1 sub", progress: "auto Fri" },
    { axis: "social", move: "Dinner with the college crew", progress: "Fri 7p" },
  ],
  weekPlan: {
    bigRock: "Get the Lehigh Valley proposal signed ($28K).",
    workBlocks: ["Mon: 6 stalled-deal nudges", "Wed: Chamber sponsor call", "Fri: weekly report + pipeline review"],
    body: "4 lifts + Sat golf. Sleep 8h.",
    money: "$500 → brokerage Fri · cancel 1 sub · dining under $300.",
    social: "Call mom (today) · college crew dinner Fri · apartment reset Sun.",
  },
  story,
  style: { greetings: ["Hey {name} —"], signoffs: ["— Alex"], phrases: ["the one that books fast", "quick one"], avgSentenceLen: 12, tone: "warm-direct" },
};

// ---- mock adapters (fallback) ----
const wait = <T,>(v: T) => new Promise<T>(r => setTimeout(() => r(v), 120));
export const mockAdapters: Adapters = {
  pipedrive: { getPipeline: () => wait(pipeline), getDeal: async id => pipeline.best.concat(pipeline.stalled).find(d => d.id === id)!, logNote: async () => {} },
  sheets: { getRange: async () => [], getSalesTracker: async () => [] },
  gmail: { getImportant: () => wait(emails), findWarmLeads: () => wait(radar) },
  calendar: { getToday: () => wait(meetings), block: async () => {} },
  telegram: { onVoiceNote: () => {}, transcribe: async () => "Remind me to call the Richmond Chamber and update the Whitecaps report." },
  obsidian: { search: () => wait(notes), reindex: async () => 1204 },
  money: { getPulse: () => wait(moneyPulse) },
  health: { getPulse: () => wait(bodyPulse) },
  ai: {
    ask: async (q): Promise<ChiefOfStaffAnswer> => {
      const key = /follow/i.test(q) ? "follow" : /chang/i.test(q) ? "changed" : /next|work on/i.test(q) ? "next" : /report|story/i.test(q) ? "report" : "next";
      return wait({ text: chiefAnswers[key] });
    },
    weeklyStory: () => wait(story),
    draftInVoice: async (req) => wait({ to: req.to, body: `Hey ${req.to.split(" ")[0]} — quick one. ${req.intent}. Got 15 min this week? I'll bring the numbers. — Alex`, matched: ["greeting", "quick one", "short sentences"] }),
  },
};

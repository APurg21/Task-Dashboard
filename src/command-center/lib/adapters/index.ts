// ============================================================
// COSMIC COMMAND — adapter registry
// Each source implements one interface. Swap a stub for a real
// client without touching any component. Components import from
// here, never from a vendor SDK directly.
// ============================================================
import type {
  Deal, PipelineSummary, WarmLead, EmailItem, Meeting,
  VoiceCapture, NoteHit, MoneyPulse, BodyPulse, WeeklyStory,
  Draft, DraftRequest, ChiefOfStaffAnswer,
} from "../types";

export interface PipedriveAdapter {
  getPipeline(): Promise<PipelineSummary>;
  getDeal(id: string): Promise<Deal>;
  logNote(contact: string, note: string): Promise<void>;
}
export interface SheetsAdapter {
  getRange(sheet: string, range: string): Promise<string[][]>;
  getSalesTracker(): Promise<Record<string, unknown>[]>;
}
export interface GmailAdapter {
  getImportant(maxAgeDays?: number): Promise<EmailItem[]>;
  findWarmLeads(): Promise<WarmLead[]>;   // emailed/called, no reply/next step
}
export interface CalendarAdapter {
  getToday(): Promise<Meeting[]>;
  block(title: string, startISO: string, endISO: string): Promise<void>;
}
export interface TelegramAdapter {
  // webhook handler turns a voice note into a VoiceCapture
  onVoiceNote(cb: (v: VoiceCapture) => void): void;
  transcribe(fileId: string): Promise<string>;
}
export interface ObsidianAdapter {
  search(query: string): Promise<NoteHit[]>;   // vector index over the vault
  reindex(): Promise<number>;                   // returns note count
}
export interface MoneyAdapter {
  getPulse(): Promise<MoneyPulse>;              // Plaid, bank CSV, or manual
}
export interface HealthAdapter {
  getPulse(): Promise<BodyPulse>;               // Apple Health / Whoop / Oura export
}
export interface AIAdapter {
  // the brain behind Chief of Staff, story builder, writing clone, blind-spots
  ask(question: string, ctx: unknown): Promise<ChiefOfStaffAnswer>;
  weeklyStory(ctx: unknown): Promise<WeeklyStory>;
  draftInVoice(req: DraftRequest, ctx: unknown): Promise<Draft>;
}

export interface Adapters {
  pipedrive: PipedriveAdapter;
  sheets: SheetsAdapter;
  gmail: GmailAdapter;
  calendar: CalendarAdapter;
  telegram: TelegramAdapter;
  obsidian: ObsidianAdapter;
  money: MoneyAdapter;
  health: HealthAdapter;
  ai: AIAdapter;
}

// Registry. Sources without a real client fall back to the mocks in lib/mock.ts.
// Task-Dashboard already backs two: ai.ask (Sonnet 5 chat over the KB) and
// obsidian.search (Postgres full-text). Both fetch server routes and throw on
// failure, so components gracefully fall back to their seeded mock/prop data.
import { mockAdapters } from "../mock";
import { realAiAsk, realObsidianSearch } from "./real";

export const adapters: Adapters = {
  ...mockAdapters,
  ai: { ...mockAdapters.ai, ask: realAiAsk },
  obsidian: { ...mockAdapters.obsidian, search: realObsidianSearch },
};

// ============================================================
// Remaining adapter stubs. Each throws until wired, so the app
// visibly falls back to mock data. Fill using pipedrive.ts as the
// pattern: fetch → MAP to our types → return. Env keys listed below.
// ============================================================
import type {
  GmailAdapter, SheetsAdapter, CalendarAdapter, TelegramAdapter,
  ObsidianAdapter, MoneyAdapter, HealthAdapter, AIAdapter,
} from "./index";

// GMAIL_* (OAuth) — getImportant(): filter by importance + age; findWarmLeads():
// threads you sent with no inbound reply since. Map → EmailItem / WarmLead.
export const gmail: GmailAdapter = {
  async getImportant() { throw new Error("gmail: wire GMAIL OAuth"); },
  async findWarmLeads() { throw new Error("gmail: wire GMAIL OAuth"); },
};

// GOOGLE_SHEETS_ID + service account — reads your 2026 sales tracker.
export const sheets: SheetsAdapter = {
  async getRange() { throw new Error("sheets: wire Google Sheets API"); },
  async getSalesTracker() { throw new Error("sheets: wire Google Sheets API"); },
};

// GOOGLE_CALENDAR — getToday() → Meeting[]; block() writes an event.
export const calendar: CalendarAdapter = {
  async getToday() { throw new Error("calendar: wire Google Calendar"); },
  async block() { throw new Error("calendar: wire Google Calendar"); },
};

// TELEGRAM_BOT_TOKEN — set a webhook to /api/telegram; transcribe via Whisper,
// then send transcript to adapters.ai to parse tasks/notes/blocks (VoiceCapture).
export const telegram: TelegramAdapter = {
  onVoiceNote() { /* register in app/api/telegram/route.ts */ },
  async transcribe() { throw new Error("telegram: wire bot + whisper"); },
};

// OBSIDIAN — index the vault into a vector store (e.g. local + pgvector);
// search() returns ranked NoteHit[]. Point OBSIDIAN_VAULT_PATH at the folder.
export const obsidian: ObsidianAdapter = {
  async search() { throw new Error("obsidian: build vault index"); },
  async reindex() { throw new Error("obsidian: build vault index"); },
};

// MONEY — Plaid, a bank CSV importer, or manual. getPulse() computes
// color from spent/budget/daysLeft. green<70% · yellow 70–90% · red>90%.
export const money: MoneyAdapter = {
  async getPulse() { throw new Error("money: wire Plaid or CSV import"); },
};

// HEALTH — Apple Health export, Whoop, or Oura API → BodyPulse.
export const health: HealthAdapter = {
  async getPulse() { throw new Error("health: wire Apple Health / Whoop"); },
};

// AI — your Claude calls. This is the brain for Chief of Staff, the weekly
// story, the writing clone, and What-Am-I-Missing. Give it read access to the
// other adapters' data as context. ANTHROPIC_API_KEY.
export const ai: AIAdapter = {
  async ask() { throw new Error("ai: wire Anthropic client"); },
  async weeklyStory() { throw new Error("ai: wire Anthropic client"); },
  async draftInVoice() { throw new Error("ai: wire Anthropic client"); },
};

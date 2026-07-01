import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  boolean,
  real,
  bigserial,
} from "drizzle-orm/pg-core";

// Work-OS data model (Phase 1 subset). Structured work + knowledge + governance.
// Semantic columns (pgvector embedding) are added in the semantic-search phase;
// Phase 1 retrieves via Postgres full-text search over document_chunks.text.

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const projects = pgTable("projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  status: text("status").default("active").notNull(),
  priority: text("priority").default("medium").notNull(),
  goal: text("goal"),
  goals: text("goals").array(),
  nextActions: text("next_actions").array(),
  risks: text("risks").array(),
  openQuestions: text("open_questions").array(),
  latestSummary: text("latest_summary"),
  decisions: jsonb("decisions"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const tasks = pgTable("tasks", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").default("todo").notNull(),
  priority: text("priority").default("medium").notNull(),
  dueAt: timestamp("due_at", { withTimezone: true }),
  context: text("context"), // personal | work
  projectId: uuid("project_id"),
  milestone: text("milestone"),
  contactId: uuid("contact_id"),
  companyId: uuid("company_id"),
  sourceType: text("source_type"), // ui | telegram | import | deep | email | ...
  sourceId: text("source_id"),
  aiReason: text("ai_reason"),
  nextAction: text("next_action"),
  createdBy: text("created_by").default("user"),
  approvedByUser: boolean("approved_by_user").default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// One row per external object we know about (note, file, email, upload).
export const sources = pgTable("sources", {
  id: uuid("id").defaultRandom().primaryKey(),
  type: text("type").notNull(), // obsidian | drive | gmail | upload | ...
  title: text("title"),
  urlOrPath: text("url_or_path"),
  provider: text("provider"),
  metadata: jsonb("metadata"),
  extractedText: text("extracted_text"),
  summary: text("summary"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const documents = pgTable("documents", {
  id: uuid("id").defaultRandom().primaryKey(),
  sourceId: uuid("source_id"),
  title: text("title"),
  content: text("content"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// The retrieval unit. Phase 1: full-text search over `text`. Later: + embedding.
export const documentChunks = pgTable("document_chunks", {
  id: uuid("id").defaultRandom().primaryKey(),
  documentId: uuid("document_id"),
  sourceType: text("source_type"),
  sourceName: text("source_name"),
  sourceId: text("source_id"),
  title: text("title"),
  text: text("text").notNull(),
  url: text("url"),
  tags: text("tags").array(),
  projectId: uuid("project_id"),
  contactId: uuid("contact_id"),
  permissionLevel: text("permission_level").default("private"),
  summary: text("summary"),
  confidence: real("confidence"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const conversationLogs = pgTable("conversation_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  source: text("source"), // dashboard | telegram
  role: text("role"), // user | assistant | tool
  content: text("content"),
  toolCalls: jsonb("tool_calls"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Every outside-world action waits here for the user's approval.
export const approvalQueue = pgTable("approval_queue", {
  id: uuid("id").defaultRandom().primaryKey(),
  toolName: text("tool_name").notNull(),
  toolArgs: jsonb("tool_args"),
  riskTier: text("risk_tier").default("medium"),
  reason: text("reason"),
  status: text("status").default("pending").notNull(), // pending | approved | rejected | expired
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  decidedBy: text("decided_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const auditLogs = pgTable("audit_logs", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  requestId: uuid("request_id"),
  eventType: text("event_type"),
  actorId: text("actor_id"),
  channel: text("channel"),
  payload: jsonb("payload"),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).defaultNow().notNull(),
});

export type TaskRow = typeof tasks.$inferSelect;
export type NewTaskRow = typeof tasks.$inferInsert;
export type ProjectRow = typeof projects.$inferSelect;
export type ChunkRow = typeof documentChunks.$inferSelect;
export type ApprovalRow = typeof approvalQueue.$inferSelect;

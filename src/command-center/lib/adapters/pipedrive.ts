// ============================================================
// Pipedrive adapter — REAL wiring template.
// Every other source (gmail, sheets, calendar, obsidian, money,
// health) follows this exact shape: read env, call API, MAP the
// vendor response into our types (types.ts), return typed data.
// ============================================================
import type { PipedriveAdapter } from "./index";
import type { Deal, PipelineSummary, DealHeat } from "../types";

const BASE = "https://api.pipedrive.com/v1";
const TOKEN = process.env.PIPEDRIVE_API_TOKEN; // set in .env.local

function heatFromDeal(d: any): DealHeat {
  const idleDays = d.last_activity_date
    ? (Date.now() - new Date(d.last_activity_date).getTime()) / 8.64e7 : 0;
  if (idleDays > 7) return "stalled";
  if (d.probability >= 70) return "hot";
  if (d.probability >= 40) return "warm";
  return "cold";
}

// Map a raw Pipedrive deal → our Deal type. This mapping layer is the
// whole point: the UI only ever sees Deal, never Pipedrive's schema.
function toDeal(d: any): Deal {
  return {
    id: String(d.id),
    name: d.title,
    amount: d.value ?? 0,
    stage: d.stage_id_name ?? d.stage ?? "—",
    probability: (d.probability ?? 0) / 100,
    heat: heatFromDeal(d),
    ageDays: d.add_time ? Math.round((Date.now() - new Date(d.add_time).getTime()) / 8.64e7) : 0,
    closeEta: d.expected_close_date,
    contact: d.person_name,
    // sayNext / nextAction are filled by adapters.ai, not Pipedrive:
    nextAction: undefined,
    sayNext: undefined,
  };
}

export const pipedrive: PipedriveAdapter = {
  async getPipeline(): Promise<PipelineSummary> {
    if (!TOKEN) throw new Error("PIPEDRIVE_API_TOKEN missing");
    const res = await fetch(`${BASE}/deals?status=open&limit=100&api_token=${TOKEN}`, { cache: "no-store" });
    const { data = [] } = await res.json();
    const deals = data.map(toDeal);
    const projected = deals.reduce((s: number, d: Deal) => s + d.amount, 0);
    const weighted  = deals.reduce((s: number, d: Deal) => s + d.amount * d.probability, 0);
    const stalled   = deals.filter((d: Deal) => d.heat === "stalled");
    const best      = [...deals].sort((a, b) => b.amount * b.probability - a.amount * a.probability).slice(0, 4);
    return { projected, weighted, stalledCount: stalled.length, best, stalled };
  },
  async getDeal(id) {
    const res = await fetch(`${BASE}/deals/${id}?api_token=${TOKEN}`, { cache: "no-store" });
    const { data } = await res.json();
    return toDeal(data);
  },
  async logNote(contact, note) {
    await fetch(`${BASE}/notes?api_token=${TOKEN}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: `[${contact}] ${note}` }),
    });
  },
};

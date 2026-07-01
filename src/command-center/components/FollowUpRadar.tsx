"use client";
import React, { useEffect, useState } from "react";
import { Panel } from "./ui";
import { adapters } from "../lib/adapters";
import type { WarmLead } from "../lib/types";

export function FollowUpRadar({ onDraft }: { onDraft?: (lead: WarmLead) => void }) {
  const [leads, setLeads] = useState<WarmLead[]>([]);
  useEffect(() => { adapters.gmail.findWarmLeads().then(setLeads).catch(() => {}); }, []);

  const shown = leads.slice(0, 5);
  const extra = Math.max(0, leads.length - shown.length);

  return (
    <Panel accent="amber" title="Follow-Up Radar" right={`${leads.length} warming · need a touch`}>
      <div style={{ padding: "8px 10px 12px" }}>
        {shown.map(l => (
          <div key={l.id} className="flex items-center gap-3 rounded-xl" style={{ padding: "10px 12px" }}>
            <span className="rounded-full" style={{ width: 8, height: 8, background: "var(--amber)", boxShadow: "0 0 8px var(--amber)" }} />
            <span className="flex-1" style={{ fontSize: 12.5 }}>{l.name}</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--faint)" }}>{l.lastTouchDays}d</span>
            <button onClick={() => onDraft?.(l)} className="rounded-md"
              style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--uv)", border: "1px solid rgba(182,255,60,.35)", padding: "5px 9px", background: "transparent" }}>
              Draft
            </button>
          </div>
        ))}
        {extra > 0 && <div className="text-center" style={{ padding: 8, fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--faint)" }}>+{extra} more warming up</div>}
      </div>
    </Panel>
  );
}

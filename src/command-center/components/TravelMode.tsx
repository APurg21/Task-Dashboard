"use client";
import React from "react";
import { Panel } from "./ui";

export interface TravelContext {
  active: boolean;
  city: string;
  dates: string;
  logistics: { icon: "flight" | "hotel" | "car"; title: string; sub: string }[];
  cityNotes: string;
  people: { name: string; note: string }[];
  spots: { name: string; kind: "coffee" | "gym" | "food" | "prospect"; meta: string }[];
}

const logiTint: Record<
  TravelContext["logistics"][number]["icon"],
  { bg: string; color: string }
> = {
  flight: { bg: "rgba(53,231,255,.14)", color: "var(--cyan)" },
  hotel: { bg: "rgba(157,92,255,.14)", color: "var(--violet)" },
  car: { bg: "rgba(255,194,77,.14)", color: "var(--amber)" },
};

function LogiIcon({ icon }: { icon: TravelContext["logistics"][number]["icon"] }) {
  const common = {
    width: 16,
    height: 16,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  if (icon === "flight")
    return (
      <svg {...common}>
        <path d="M10.18 9 3 11l1 2 5-.5L11 21l2-.5-1-8 6-2a2 2 0 0 0-1-4l-4 1-4-6-2 .5 2.18 8z" />
      </svg>
    );
  if (icon === "hotel")
    return (
      <svg {...common}>
        <path d="M3 21V7l9-4 9 4v14" />
        <path d="M3 21h18" />
        <path d="M9 21v-5h6v5" />
        <path d="M9 10h.01M15 10h.01" />
      </svg>
    );
  return (
    <svg {...common}>
      <path d="M5 17H3v-5l2-5h14l2 5v5h-2" />
      <circle cx="7.5" cy="17" r="1.5" />
      <circle cx="16.5" cy="17" r="1.5" />
      <path d="M5 12h14" />
    </svg>
  );
}

export function TravelMode({ data }: { data: TravelContext }) {
  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <Panel accent="magenta" title="Travel Mode" right={`${data.city} · ${data.dates}`}>
          <div style={{ padding: "8px 10px 12px", fontSize: 12.5, color: "var(--dim)" }}>
            Scouting trip — dashboard switched to road layout: logistics up top, prospects + local spots below.
          </div>
        </Panel>
      </div>

      <div className="grid gap-3.5" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <div className="flex flex-col gap-3.5">
          <Panel accent="cyan" title="Logistics">
            <div style={{ padding: "8px 10px 12px" }}>
              {data.logistics.map((l, i) => {
                const t = logiTint[l.icon];
                return (
                  <div
                    key={i}
                    className="trip flex gap-3"
                    style={{
                      padding: 12,
                      borderRadius: 13,
                      border: "1px solid var(--edge)",
                      background: "rgba(10,4,24,.4)",
                      marginBottom: 10,
                    }}
                  >
                    <div
                      className="grid place-items-center"
                      style={{ width: 32, height: 32, borderRadius: 9, background: t.bg, color: t.color }}
                    >
                      <LogiIcon icon={l.icon} />
                    </div>
                    <div>
                      <div style={{ fontSize: 12.5, fontWeight: 500 }}>{l.title}</div>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--faint)", marginTop: 3 }}>
                        {l.sub}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Panel>

          <Panel accent="uv" title={`City Notes — ${data.city.split(",")[0]}`}>
            <div style={{ padding: "8px 10px 12px", fontSize: 12, color: "var(--dim)", lineHeight: 1.6 }}>
              {data.cityNotes}
            </div>
          </Panel>
        </div>

        <div className="flex flex-col gap-3.5">
          <Panel accent="amber" title="People + Local Prospects">
            <div style={{ padding: "8px 10px 12px" }}>
              {data.people.map((p, i) => (
                <div key={i} className="place flex items-center gap-2" style={{ padding: "8px 10px", borderRadius: 10 }}>
                  <span
                    className="rounded-full"
                    style={{ width: 6, height: 6, background: "var(--cyan)", boxShadow: "0 0 7px var(--cyan)" }}
                  />
                  <span className="flex-1" style={{ fontSize: 12 }}>{p.name}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--faint)" }}>{p.note}</span>
                </div>
              ))}
            </div>
          </Panel>

          <Panel accent="violet" title="Nearby — work + train">
            <div style={{ padding: "8px 10px 12px" }}>
              {data.spots.map((s, i) => (
                <div key={i} className="place flex items-center gap-2" style={{ padding: "8px 10px", borderRadius: 10 }}>
                  <span
                    className="rounded-full"
                    style={{ width: 6, height: 6, background: "var(--cyan)", boxShadow: "0 0 7px var(--cyan)" }}
                  />
                  <span className="flex-1" style={{ fontSize: 12 }}>{s.name}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--faint)" }}>{s.meta}</span>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

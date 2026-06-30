import Anthropic from "@anthropic-ai/sdk";
import type { NextRequest } from "next/server";
import { classifyText, MissingApiKeyError } from "@/lib/classify";

// Classify a free-form note into a vault destination using Claude. The heavy
// lifting lives in lib/classify so the Telegram webhook shares the exact logic.

export async function POST(req: NextRequest) {
  let body: { text?: unknown; projects?: unknown };
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) return new Response("text required", { status: 400 });

  const projects = Array.isArray(body.projects)
    ? body.projects.filter((p): p is string => typeof p === "string").slice(0, 50)
    : [];

  try {
    const classification = await classifyText(text, projects);
    return Response.json(classification);
  } catch (err) {
    if (err instanceof MissingApiKeyError) {
      return Response.json(
        { error: "ANTHROPIC_API_KEY is not set. Add it to .env.local to enable note classification." },
        { status: 503 }
      );
    }
    if (err instanceof Anthropic.AuthenticationError) {
      return Response.json({ error: "Anthropic API key is invalid." }, { status: 401 });
    }
    if (err instanceof Anthropic.RateLimitError) {
      return Response.json({ error: "Rate limited by Anthropic — try again shortly." }, { status: 429 });
    }
    const message = err instanceof Error ? err.message : "Classification failed.";
    return Response.json({ error: message }, { status: 502 });
  }
}

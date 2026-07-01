import type { NextRequest } from "next/server";
import { answerQuestion, type ChatTurn } from "@/lib/chat";
import { chunkCount } from "@/lib/knowledge";
import { MissingApiKeyError } from "@/lib/classify";

// AI Chat over the knowledge base. POST a question (+ optional recent history);
// get back a grounded answer with numbered sources. GET returns how many chunks
// are stored so the UI can show whether the KB has anything yet.

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  let body: { question?: unknown; history?: unknown };
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const question = typeof body.question === "string" ? body.question.trim() : "";
  if (!question) return new Response("question required", { status: 400 });

  const history: ChatTurn[] = Array.isArray(body.history)
    ? body.history
        .filter(
          (t): t is ChatTurn =>
            !!t &&
            typeof t === "object" &&
            (t as ChatTurn).role !== undefined &&
            typeof (t as ChatTurn).content === "string"
        )
        .map((t) => ({ role: t.role === "assistant" ? "assistant" : "user", content: t.content }))
    : [];

  try {
    const result = await answerQuestion(question, history);
    return Response.json(result);
  } catch (err) {
    if (err instanceof MissingApiKeyError) {
      return Response.json({ error: "Chat isn't configured (no ANTHROPIC_API_KEY)." }, { status: 503 });
    }
    console.error("[chat] failed:", err);
    return Response.json({ error: "Couldn't answer that — try again." }, { status: 500 });
  }
}

export async function GET() {
  const count = await chunkCount();
  return Response.json({ chunks: count });
}

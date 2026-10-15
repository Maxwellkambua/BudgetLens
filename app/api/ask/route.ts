// app/api/ask/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getAI, EMBED_MODEL, EMBED_DIM } from "@/lib/gemini";
import { getSupabase } from "@/lib/supabase";
import { findGolden } from "@/lib/golden";
import type { AskResponse } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// ---- Rate limiting (per-instance, best-effort) ----
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 20;
const hits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > MAX_PER_WINDOW;
}

// ---- Models to try in order ----
// If one is busy (503), fall through to the next.
const CHAT_MODELS = [
  "gemini-3.6-flash",
  "gemini-2.5-flash",
  "gemini-2.0-flash",
];

// ---- Counties currently ingested ----
const KNOWN_COUNTIES = ["Nairobi", "Kisumu", "Narok", "Nyandarua"];

const SYSTEM = `You are Budget Lens, a civic assistant that explains Kenyan county budgets in plain language.

RULES:
- Answer ONLY from the provided CONTEXT. If the context lacks the answer, say so plainly and name which document would contain it.
- Cite every factual claim as [CFSP Nairobi 2025/26, p.42].
- Amounts are Kenyan Shillings. Format as KES 1.2B / KES 450M / KES 3,400.
- If the question is in Swahili, answer in Swahili. Otherwise match the question's language.
- Be strictly neutral. Report what the document says. Never speculate about corruption, motive, or missing money.
- If asked about a ward or sub-county, state only what the document actually says. Never invent ward-level figures.
- Default to under 150 words. Expand only if asked.`;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// Try each model in order, retry twice per model on 503.
async function generateWithFallback(prompt: string): Promise<string> {
  const ai = getAI();
  let lastError: any = null;

  for (const model of CHAT_MODELS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const chat = await ai.models.generateContent({
          model,
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          config: { temperature: 0.1 },
        });
        const answer =
          chat.text ??
          chat.candidates?.[0]?.content?.parts
            ?.map((p: any) => p.text)
            .join("") ??
          "";
        if (answer.trim()) return answer;
      } catch (e: any) {
        lastError = e;
        const status = e?.status ?? e?.error?.code;
        const isTransient =
          status === 503 ||
          status === 429 ||
          String(e?.message ?? "").includes("high demand") ||
          String(e?.message ?? "").includes("UNAVAILABLE");
        if (!isTransient) break;
        await sleep(800 * (attempt + 1));
      }
    }
  }

  throw lastError ?? new Error("all models failed");
}

export async function POST(req: NextRequest) {
  try {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      "unknown";

    if (rateLimited(ip)) {
      return NextResponse.json(
        { error: "Too many requests. Try again in a minute." },
        { status: 429 }
      );
    }

    const { question, county, fiscalYear } = await req.json();
    if (!question?.trim()) {
      return NextResponse.json({ error: "question required" }, { status: 400 });
    }

    // Auto-switch county if the question names one
    const mentioned = KNOWN_COUNTIES.find((c) =>
      new RegExp(`\\b${c}\\b`, "i").test(question)
    );
    const effectiveCounty =
      mentioned && mentioned !== county ? mentioned : county;

    // Golden path
    const golden = findGolden(question, effectiveCounty, fiscalYear);
    if (golden) return NextResponse.json(golden);

    const ai = getAI();
    const supabase = getSupabase();

    // Embed
    const embRes = await ai.models.embedContent({
      model: EMBED_MODEL,
      contents: question,
      config: { outputDimensionality: EMBED_DIM },
    });
    const queryVector = embRes.embeddings?.[0]?.values;
    if (!queryVector) {
      return NextResponse.json(
        { error: "Something went wrong while answering. Please try again." },
        { status: 500 }
      );
    }

    // Search
    const { data: matches, error: rpcError } = await supabase.rpc(
      "match_chunks",
      {
        query_embedding: queryVector,
        match_count: 8,
        filter_county: effectiveCounty ?? null,
        filter_fy: fiscalYear ?? null,
      }
    );

    if (rpcError) {
      console.error("ask route: supabase rpc error:", rpcError);
      return NextResponse.json(
        { error: "Something went wrong while answering. Please try again." },
        { status: 500 }
      );
    }

    // No matches — dynamic list
    if (!matches || matches.length === 0) {
      const { data: coverage } = await supabase
        .from("chunks")
        .select("county, doc_type");

      const seen = new Set<string>();
      const docs: string[] = [];
      for (const row of coverage ?? []) {
        const key = `${row.county}|${row.doc_type}`;
        if (!seen.has(key)) {
          seen.add(key);
          docs.push(`${row.county} (${row.doc_type})`);
        }
      }
      docs.sort();

      const suffix =
        docs.length > 0
          ? ` Currently indexed: ${docs.join(", ")}.`
          : " No documents are currently indexed.";

      return NextResponse.json({
        answer: `I couldn't find anything about that in the ingested documents.${suffix}`,
        sources: [],
      });
    }

    const context = matches
      .map(
        (m: any) =>
          `[${m.doc_type} ${m.county} ${m.fiscal_year}, p.${m.page}]\n${m.content}`
      )
      .join("\n\n---\n\n");

    const answer = await generateWithFallback(
      `${SYSTEM}\n\nCONTEXT:\n${context}\n\nQUESTION: ${question}`
    );

    return NextResponse.json({
      answer,
      sources: matches.map((m: any) => ({
        doc: `${m.doc_type} ${m.county} ${m.fiscal_year}`,
        page: m.page,
        snippet:
          m.content.slice(0, 180) + (m.content.length > 180 ? "…" : ""),
      })),
    });
  } catch (e: any) {
    console.error("ask route error:", e);
    const msg =
      e?.message ??
      e?.error?.message ??
      (typeof e === "object" ? JSON.stringify(e) : String(e));

    const isBusy =
      e?.status === 503 ||
      String(msg).includes("high demand") ||
      String(msg).includes("UNAVAILABLE");

    const userMessage = isBusy
      ? "The AI service is busy right now. Please try again in a few seconds."
      : "Something went wrong while answering. Please try again.";

    return NextResponse.json({ error: userMessage }, { status: 500 });
  }
}
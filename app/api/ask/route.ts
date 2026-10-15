// app/api/ask/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getAI, EMBED_MODEL, CHAT_MODEL, EMBED_DIM } from "@/lib/gemini";
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

const SYSTEM = `You are Budget Lens, a civic assistant that explains Kenyan county budgets in plain language.

RULES:
- Answer ONLY from the provided CONTEXT. If the context lacks the answer, say so plainly and name which document would contain it.
- Cite every factual claim as [CFSP Nairobi 2025/26, p.42].
- Amounts are Kenyan Shillings. Format as KES 1.2B / KES 450M / KES 3,400.
- If the question is in Swahili, answer in Swahili. Otherwise match the question's language.
- Be strictly neutral. Report what the document says. Never speculate about corruption, motive, or missing money.
- If asked about a ward or sub-county, state only what the document actually says. Never invent ward-level figures.
- Default to under 150 words. Expand only if asked.`;

export async function POST(req: NextRequest) {
  try {
    // ============================================================
    // TEMP DIAGNOSTIC — remove this block once env vars are confirmed
    // ============================================================
    console.log("ENV DIAGNOSTIC:", {
      keysMatchingGemini: Object.keys(process.env).filter((k) =>
        k.toUpperCase().includes("GEMINI")
      ),
      geminiValueLen: process.env.GEMINI_API_KEY?.length ?? 0,
      geminiPrefix: process.env.GEMINI_API_KEY?.slice(0, 6) ?? null,
      hasSupabaseUrl: !!process.env.SUPABASE_URL,
      hasSupabaseKey: !!process.env.SUPABASE_SERVICE_KEY,
      vercelEnv: process.env.VERCEL_ENV,
      nodeEnv: process.env.NODE_ENV,
    });
    // ============================================================
    // END TEMP DIAGNOSTIC
    // ============================================================

    // ---- Rate limit ----
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

    // ---- Parse input ----
    const { question, county, fiscalYear } = await req.json();
    if (!question?.trim()) {
      return NextResponse.json({ error: "question required" }, { status: 400 });
    }

    // ---- Golden path (hand-verified answers) ----
    const golden = findGolden(question, county, fiscalYear);
    if (golden) return NextResponse.json(golden);

    // ---- Embed query ----
    const ai = getAI();
    const supabase = getSupabase();

    const embRes = await ai.models.embedContent({
      model: EMBED_MODEL,
      contents: question,
      config: { outputDimensionality: EMBED_DIM },
    });
    const queryVector = embRes.embeddings?.[0]?.values;

    if (!queryVector) {
      console.error("ask route: embedding returned no vector");
      return NextResponse.json(
        { error: "Something went wrong while answering. Please try again." },
        { status: 500 }
      );
    }

    // ---- Vector search ----
    const { data: matches, error: rpcError } = await supabase.rpc(
      "match_chunks",
      {
        query_embedding: queryVector,
        match_count: 8,
        filter_county: county ?? null,
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

    if (!matches || matches.length === 0) {
      const payload: AskResponse = {
        answer:
          "I couldn't find anything about that in the ingested documents. Currently indexed: Nairobi County Fiscal Strategy Paper 2025/26 and Kisumu Approved Budget Estimates 2025/26.",
        sources: [],
      };
      return NextResponse.json(payload);
    }

    // ---- Build context ----
    const context = matches
      .map(
        (m: any) =>
          `[${m.doc_type} ${m.county} ${m.fiscal_year}, p.${m.page}]\n${m.content}`
      )
      .join("\n\n---\n\n");

    // ---- Generate answer ----
    const chat = await ai.models.generateContent({
      model: CHAT_MODEL,
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `${SYSTEM}\n\nCONTEXT:\n${context}\n\nQUESTION: ${question}`,
            },
          ],
        },
      ],
      config: { temperature: 0.1 },
    });

    const answer =
      chat.text ??
      chat.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("") ??
      "";

    if (!answer.trim()) {
      console.error("ask route: model returned empty response");
      return NextResponse.json(
        { error: "Something went wrong while answering. Please try again." },
        { status: 500 }
      );
    }

    // ---- Respond ----
    const payload: AskResponse = {
      answer,
      sources: matches.map((m: any) => ({
        doc: `${m.doc_type} ${m.county} ${m.fiscal_year}`,
        page: m.page,
        snippet:
          m.content.slice(0, 180) + (m.content.length > 180 ? "…" : ""),
      })),
    };

    return NextResponse.json(payload);
  } catch (e: any) {
    console.error("ask route error:", e);

    const msg =
      e?.message ??
      e?.error?.message ??
      (typeof e === "object" ? JSON.stringify(e) : String(e));

    const isConfigError =
      String(msg).includes("GEMINI_API_KEY") ||
      String(msg).includes("SUPABASE_") ||
      String(msg).includes("is not set") ||
      String(msg).includes("is required");

    const userMessage = isConfigError
      ? "Service is temporarily unavailable. Please try again shortly."
      : "Something went wrong while answering. Please try again.";

    return NextResponse.json({ error: userMessage }, { status: 500 });
  }
}
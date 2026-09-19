// app/api/ask/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getAI, EMBED_MODEL, CHAT_MODEL, EMBED_DIM } from "@/lib/gemini";
import { supabase } from "@/lib/supabase";
import { findGolden } from "@/lib/golden";
import type { AskResponse } from "@/lib/types";

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
    const { question, county, fiscalYear } = await req.json();
    if (!question?.trim()) {
      return NextResponse.json({ error: "question required" }, { status: 400 });
    }

    const golden = findGolden(question, county, fiscalYear);
    if (golden) return NextResponse.json(golden);

    const ai = getAI();

    const embRes = await ai.models.embedContent({
      model: EMBED_MODEL,
      contents: question,
      config: { outputDimensionality: EMBED_DIM },
    });
    const queryVector = embRes.embeddings?.[0]?.values;
    if (!queryVector) {
      return NextResponse.json(
        { error: "embedding returned no vector" },
        { status: 500 }
      );
    }

    const { data: matches, error } = await supabase.rpc("match_chunks", {
      query_embedding: queryVector,
      match_count: 8,
      filter_county: county ?? null,
      filter_fy: fiscalYear ?? null,
    });
    if (error) {
      console.error("supabase rpc error:", error);
      return NextResponse.json(
        { error: `Supabase: ${error.message}` },
        { status: 500 }
      );
    }

    const context = (matches ?? [])
      .map(
        (m: any) =>
          `[${m.doc_type} ${m.county} ${m.fiscal_year}, p.${m.page}]\n${m.content}`
      )
      .join("\n\n---\n\n");

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

    const payload: AskResponse = {
      answer: answer || "(model returned empty response)",
      sources: (matches ?? []).map((m: any) => ({
        doc: `${m.doc_type} ${m.county} ${m.fiscal_year}`,
        page: m.page,
        snippet: m.content.slice(0, 180) + (m.content.length > 180 ? "…" : ""),
      })),
    };

    return NextResponse.json(payload);
  } catch (e: any) {
    console.error("ask route error:", e);
    const msg =
      e?.message ??
      e?.error?.message ??
      (typeof e === "object" ? JSON.stringify(e) : String(e));
    return NextResponse.json(
      { error: `Server: ${msg}`, detail: String(e) },
      { status: 500 }
    );
  }
}
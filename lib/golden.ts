// lib/golden.ts
import golden from "@/data/golden.json";
import type { AskResponse } from "./types";

type GoldenEntry = {
  id: string;
  keywords: string[];
  county?: string;
  fiscalYear?: string;
  answer: string;
  sources: { doc: string; page: number; snippet: string }[];
};

const entries = golden as GoldenEntry[];

export function findGolden(
  question: string,
  county?: string,
  fiscalYear?: string
): AskResponse | null {
  const q = question.toLowerCase();

  for (const e of entries) {
    if (county && e.county && e.county !== county) continue;
    if (fiscalYear && e.fiscalYear && e.fiscalYear !== fiscalYear) continue;

    const hits = e.keywords.filter((k) => q.includes(k.toLowerCase()));
    if (hits.length === 0) continue;

    return {
      answer: e.answer,
      sources: e.sources,
      matchedGolden: true,
    };
  }
  return null;
}
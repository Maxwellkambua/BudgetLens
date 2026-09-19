// components/Answer.tsx
"use client";

import type { AskResponse } from "@/lib/types";
import { SourceCard } from "./SourceCard";

export function Answer({
  result,
  question,
}: {
  result: AskResponse;
  question: string;
}) {
  return (
    <div className="mt-8 space-y-5">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
        <p className="mb-3 text-xs uppercase tracking-wider text-slate-500">
          {question}
        </p>
        <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-slate-100">
          {result.answer}
        </p>
        {result.matchedGolden && (
          <p className="mt-3 text-[11px] text-cyan-500">
            ✓ Verified answer from hand-checked source
          </p>
        )}
      </div>

      {result.sources.length > 0 && (
        <div>
          <p className="mb-2 text-xs uppercase tracking-wider text-slate-500">
            Sources
          </p>
          <div className="space-y-2">
            {result.sources.map((s, i) => (
              <SourceCard key={i} source={s} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
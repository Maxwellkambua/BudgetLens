// components/Answer.tsx
"use client";

import type { AskResponse } from "@/lib/types";
import { SourceCard } from "./SourceCard";

/** Turns [CFSP Nairobi 2025/26, p.42] into a styled inline citation chip. */
function renderAnswer(text: string) {
  const parts = text.split(/(\[[^\]]{1,80}\])/g);
  return parts.map((part, i) => {
    if (part.startsWith("[") && part.endsWith("]")) {
      return (
        <span
          key={i}
          className="mx-0.5 inline-flex translate-y-[-1px] items-center rounded-md border border-accent-soft bg-accent-soft px-1.5 py-[1px] align-middle font-sans text-[10.5px] font-medium tracking-tight text-accent"
        >
          {part.slice(1, -1)}
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

export function Answer({
  result,
  question,
}: {
  result: AskResponse;
  question: string;
}) {
  return (
    <div className="mt-12">
      {/* Question replay */}
      <div className="mb-2 text-[10.5px] font-medium uppercase tracking-[0.18em] text-muted">
        Question
      </div>
      <p className="font-display text-[22px] leading-snug tracking-[-0.01em] text-ink">
        {question}
      </p>

      {/* Answer */}
      <div className="mt-6 rounded-2xl border border-border bg-white p-6 shadow-[0_1px_0_rgba(20,16,12,0.03)]">
        <div className="whitespace-pre-wrap text-[15px] leading-[1.75] text-ink-2">
          {renderAnswer(result.answer)}
        </div>

        {result.matchedGolden && (
          <div className="mt-5 flex items-center gap-2 border-t border-border/70 pt-4 text-[11.5px] text-primary">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden>
              <path
                d="M2.5 7l2.6 2.5L10.5 3.5"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Verified against the original document
          </div>
        )}
      </div>

      {/* Sources */}
      {result.sources.length > 0 && (
        <div className="mt-8">
          <div className="mb-3 flex items-center gap-3">
            <span className="text-[10.5px] font-medium uppercase tracking-[0.18em] text-muted">
              Sources
            </span>
            <span className="h-px flex-1 bg-border" />
          </div>
          <ol className="space-y-2">
            {result.sources.map((s, i) => (
              <SourceCard key={i} source={s} index={i + 1} />
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
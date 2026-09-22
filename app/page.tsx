// app/page.tsx
"use client";

import { useState } from "react";
import { AskBox } from "@/components/AskBox";
import { Answer } from "@/components/Answer";
import type { AskResponse } from "@/lib/types";

function LensMark({ className = "" }: { className?: string }) {
  return (
    <div
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-paper shadow-[0_1px_0_rgba(0,0,0,0.06)] ${className}`}
    >
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
        <circle cx="10" cy="10" r="6.5" stroke="currentColor" strokeWidth="1.6" />
        <circle cx="10" cy="10" r="2.2" fill="currentColor" />
      </svg>
    </div>
  );
}

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AskResponse | null>(null);
  const [lastQ, setLastQ] = useState("");

  async function ask(question: string, county?: string, fiscalYear?: string) {
    setLoading(true);
    setResult(null);
    setLastQ(question);
    try {
      const r = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, county, fiscalYear }),
      });
      const d = await r.json();
      if (!r.ok) {
        setResult({
          answer: `⚠ ${d.error ?? "Unknown error"}`,
          sources: [],
        });
        return;
      }
      setResult(d);
    } catch (e: any) {
      setResult({
        answer: `⚠ Network error: ${e?.message ?? "unknown"}`,
        sources: [],
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen">
      {/* Top bar */}
      <header className="border-b border-border/70">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-3">
            <LensMark />
            <div className="leading-tight">
              <div className="font-display text-[17px] font-semibold tracking-tight text-ink">
                Budget Lens
              </div>
              <div className="text-[10.5px] uppercase tracking-[0.18em] text-muted">
                Civic information, cited
              </div>
            </div>
          </div>
          <div className="hidden items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-muted sm:flex">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary" />
            OSF × Andela 2026
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 pb-24 pt-14">
        {/* Hero */}
        <section className="mb-10">
          <h1 className="font-display text-[42px] leading-[1.02] tracking-[-0.02em] text-ink sm:text-[54px]">
            Every shilling,
            <br />
            <em className="font-normal italic text-primary">cited.</em>
          </h1>
          <p className="mt-5 max-w-xl text-[15.5px] leading-relaxed text-ink-2">
            County budgets in Kenya are public — but not readable. Ask in plain
            English or Swahili, and get a direct answer with the page it came
            from.
          </p>
        </section>

        {/* Ask */}
        <AskBox onSubmit={ask} loading={loading} />

        {/* Meta strip */}
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] uppercase tracking-[0.16em] text-muted">
          <span>2 documents</span>
          <span className="h-1 w-1 rounded-full bg-border-strong" />
          <span>560 chunks indexed</span>
          <span className="h-1 w-1 rounded-full bg-border-strong" />
          <span>Nairobi · Kisumu</span>
        </div>

        {/* Loading skeleton */}
        {loading && (
          <div className="mt-12 space-y-4">
            <div className="h-3 w-20 rounded bg-border/70" />
            <div className="h-5 w-3/4 rounded bg-border/70" />
            <div className="h-4 w-full rounded bg-border/60" />
            <div className="h-4 w-11/12 rounded bg-border/60" />
            <div className="h-4 w-2/3 rounded bg-border/60" />
          </div>
        )}

        {/* Answer */}
        {result && !loading && <Answer result={result} question={lastQ} />}

        {/* Footer */}
        <footer className="mt-20 border-t border-border/70 pt-6 text-[12px] leading-relaxed text-muted">
          from published county budget documents. Not legal or financial advice.
        </footer>
      </main>
    </div>
  );
}
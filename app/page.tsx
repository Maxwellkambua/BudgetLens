// app/page.tsx
"use client";

import { useState } from "react";
import { AskBox } from "@/components/AskBox";
import { Answer } from "@/components/Answer";
import type { AskResponse } from "@/lib/types";

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
        console.error("API error:", d);
        setResult({
          answer: `⚠ ${d.error ?? "Unknown error"}\n\nCheck the dev server terminal for details.`,
          sources: [],
        });
        return;
      }

      setResult(d);
    } catch (e: any) {
      console.error("fetch error:", e);
      setResult({
        answer: `⚠ Network error: ${e?.message ?? "unknown"}`,
        sources: [],
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-5 py-12">
      <header className="mb-10">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-400 text-lg font-bold text-slate-950">
            BL
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Budget Lens</h1>
        </div>
        <p className="mt-3 text-slate-400">
          Ask anything about Kenyan county budgets. Every answer cites its
          source page — so you can check it yourself.
        </p>
      </header>

      <AskBox onSubmit={ask} loading={loading} />

      {result && <Answer result={result} question={lastQ} />}

      <footer className="mt-16 border-t border-slate-800 pt-6 text-xs text-slate-500">
         Answers are drawn only from published county budget documents.
      </footer>
    </main>
  );
}

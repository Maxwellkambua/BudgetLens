// components/AskBox.tsx
"use client";

import { useState } from "react";

const SUGGESTIONS = [
  "What is Nairobi's total budget for 2025/26?",
  "How much is allocated to health in Kisumu?",
  "What are the key revenue sources?",
  "What is the development expenditure?",
];

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none rounded-full border border-border bg-paper py-1.5 pl-3 pr-8 text-[12.5px] font-medium text-ink-2 outline-none transition hover:border-border-strong focus:border-primary"
      >
        {options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
      <svg
        viewBox="0 0 10 6"
        width="10"
        height="6"
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted"
        aria-hidden
      >
        <path
          d="M1 1l4 4 4-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

export function AskBox({
  onSubmit,
  loading,
}: {
  onSubmit: (q: string, county?: string, fy?: string) => void;
  loading: boolean;
}) {
  const [q, setQ] = useState("");
  const [county, setCounty] = useState("Nairobi");
  const [fy, setFy] = useState("2025/26");

  function submit(text?: string) {
    const value = (text ?? q).trim();
    if (!value || loading) return;
    onSubmit(value, county, fy);
    if (!text) setQ("");
  }

  return (
    <div>
      <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-[0_1px_0_rgba(20,16,12,0.03),0_18px_40px_-24px_rgba(20,16,12,0.20)]">
        {/* Selector row */}
        <div className="flex items-center gap-2 border-b border-border/70 px-3 py-2.5">
          <Select
            value={county}
            onChange={setCounty}
            options={["Nairobi", "Kisumu"]}
          />
          <Select value={fy} onChange={setFy} options={["2025/26"]} />
          <div className="ml-auto hidden text-[11px] uppercase tracking-[0.16em] text-muted sm:block">
            Grounded · Cited
          </div>
        </div>

        {/* Input row */}
        <div className="flex items-center">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="Ask about a budget…"
            className="flex-1 bg-transparent px-5 py-5 text-[15.5px] text-ink outline-none placeholder:text-muted/80"
          />
          <button
            onClick={() => submit()}
            disabled={loading || !q.trim()}
            className="m-2 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-[13.5px] font-medium text-paper transition hover:bg-primary-2 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? (
              <>
                Thinking
                <span className="bl-caret !bg-paper !h-3 !w-[5px]" />
              </>
            ) : (
              <>
                Ask
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
                  <path
                    d="M2 6h8M6.5 2.5L10 6l-3.5 3.5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Suggestions */}
      <div className="mt-4 flex flex-wrap gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => submit(s)}
            disabled={loading}
            className="rounded-full border border-border bg-white/70 px-3.5 py-1.5 text-[12.5px] text-ink-2 transition hover:border-primary/40 hover:bg-primary-soft hover:text-primary disabled:opacity-40"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
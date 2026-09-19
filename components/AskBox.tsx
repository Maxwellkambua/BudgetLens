// components/AskBox.tsx
"use client";

import { useState } from "react";

const SUGGESTIONS = [
  "What is Nairobi's total budget for 2025/26?",
  "How much is allocated to health in Kisumu?",
  "What are the key revenue sources?",
  "What is the county's development expenditure?",
];

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
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur">
      <div className="mb-3 flex gap-2">
        <select
          value={county}
          onChange={(e) => setCounty(e.target.value)}
          className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
        >
          <option>Nairobi</option>
          <option>Kisumu</option>
        </select>
        <select
          value={fy}
          onChange={(e) => setFy(e.target.value)}
          className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
        >
          <option>2025/26</option>
        </select>
      </div>

      <div className="flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="Ask about a budget…"
          className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-sm outline-none focus:border-cyan-500"
        />
        <button
          onClick={() => submit()}
          disabled={loading || !q.trim()}
          className="rounded-lg bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:opacity-40"
        >
          {loading ? "…" : "Ask"}
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => submit(s)}
            disabled={loading}
            className="rounded-full border border-slate-700 px-3 py-1.5 text-xs text-slate-400 transition hover:border-cyan-500 hover:text-cyan-300 disabled:opacity-40"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
// components/SourceCard.tsx
import type { Source } from "@/lib/types";

export function SourceCard({ source }: { source: Source }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
      <div className="mb-1 flex items-center gap-2 text-xs">
        <span className="rounded bg-cyan-950 px-2 py-0.5 font-medium text-cyan-400">
          {source.doc}
        </span>
        <span className="text-slate-500">page {source.page}</span>
      </div>
      <p className="text-xs leading-relaxed text-slate-400">{source.snippet}</p>
    </div>
  );
}
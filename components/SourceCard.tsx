// components/SourceCard.tsx
import type { Source } from "@/lib/types";

export function SourceCard({
  source,
  index,
}: {
  source: Source;
  index: number;
}) {
  return (
    <li className="group flex gap-3.5 rounded-xl border border-border/80 bg-white/60 p-3.5 transition hover:border-border-strong hover:bg-white">
      <div className="mt-[1px] flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-border bg-paper font-sans text-[10.5px] font-semibold text-muted">
        {index}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-display text-[13.5px] font-semibold tracking-tight text-ink">
            {source.doc}
          </span>
          <span className="text-[11px] uppercase tracking-[0.12em] text-muted">
            p. {source.page}
          </span>
        </div>
        <p className="mt-1 line-clamp-3 text-[12.5px] leading-relaxed text-muted">
          {source.snippet}
        </p>
      </div>
    </li>
  );
}
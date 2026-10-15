// components/AskBox.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";

// -----------------------------------------------------------
// Config
// -----------------------------------------------------------
// Keep in sync with app/api/ask/route.ts and the ingest DOCS array.
const COUNTIES = ["Nairobi", "Kisumu", "Narok", "Nyandarua"];
const FISCAL_YEARS = ["2025/26"];

const SUGGESTIONS_BY_COUNTY: Record<string, string[]> = {
  Nairobi: [
    "What is Nairobi's total budget?",
    "How much is allocated to health?",
    "What are the key revenue sources?",
  ],
  Kisumu: [
    "How much is allocated to health in Kisumu?",
    "What is the education budget?",
    "What is the water allocation?",
  ],
  Narok: [
    "What is Narok's total budget?",
    "How much is allocated to education?",
    "What are the development priorities?",
  ],
  Nyandarua: [
    "What is Nyandarua's total budget?",
    "How much is allocated to agriculture?",
    "What are the key programmes?",
  ],
};

const ROTATING_PLACEHOLDERS = [
  "Ask about a budget…",
  "How much is allocated to health?",
  "What is the total county budget?",
  "Pesa ngapi zimewekwa kwa elimu?",
  "What are the key revenue sources?",
];

const SWAHILI_MARKERS = [
  "pesa", "ngapi", "shilingi", "afya", "elimu", "maji", "kilimo",
  "barabara", "je", "ni", "kwa", "ya", "za", "wa", "wananchi",
];

function detectSwahili(text: string): boolean {
  const words = text.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length < 2) return false;
  const matches = words.filter((w) => SWAHILI_MARKERS.includes(w)).length;
  return matches / words.length >= 0.3;
}

const RECENT_KEY = "budgetlens.recent";
type Recent = { q: string; county: string; fy: string };

function loadRecent(): Recent[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, 4);
  } catch {
    return [];
  }
}

function saveRecent(r: Recent[]) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(r.slice(0, 4)));
  } catch {
    // ignore quota errors
  }
}

// -----------------------------------------------------------
// Small dropdown with custom chevron
// -----------------------------------------------------------
function Select({
  value,
  onChange,
  options,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  label: string;
}) {
  return (
    <div className="relative">
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none rounded-full border border-border bg-paper py-1.5 pl-3 pr-8 text-[12.5px] font-medium text-ink-2 outline-none transition hover:border-border-strong focus:border-primary focus:ring-2 focus:ring-primary/10"
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

// -----------------------------------------------------------
// Main component
// -----------------------------------------------------------
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
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const [focused, setFocused] = useState(false);
  const [recent, setRecent] = useState<Recent[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);

  // Load recent questions on mount (client only)
  useEffect(() => {
    setRecent(loadRecent());
  }, []);

  // Rotate placeholder only when input is empty and not focused
  useEffect(() => {
    if (q || focused) return;
    const id = setInterval(() => {
      setPlaceholderIdx((i) => (i + 1) % ROTATING_PLACEHOLDERS.length);
    }, 3500);
    return () => clearInterval(id);
  }, [q, focused]);

  // Cmd/Ctrl+K to focus, Esc to clear/blur
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      } else if (
        e.key === "Escape" &&
        document.activeElement === inputRef.current
      ) {
        if (q) setQ("");
        else inputRef.current?.blur();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [q]);

  const isSwahili = useMemo(() => detectSwahili(q), [q]);
  const suggestions =
    SUGGESTIONS_BY_COUNTY[county] ?? SUGGESTIONS_BY_COUNTY.Nairobi;

  function submit(text?: string, overrideCounty?: string) {
    const value = (text ?? q).trim();
    if (!value || loading) return;

    const useCounty = overrideCounty ?? county;
    onSubmit(value, useCounty, fy);

    setRecent((prev) => {
      const entry: Recent = { q: value, county: useCounty, fy };
      const next = [entry, ...prev.filter((r) => r.q !== value)].slice(0, 4);
      saveRecent(next);
      return next;
    });

    if (!text) setQ("");
  }

  function runRecent(r: Recent) {
    if (loading) return;
    setCounty(r.county);
    setFy(r.fy);
    setQ(r.q);
    onSubmit(r.q, r.county, r.fy);
  }

  return (
    <div>
      <div
        className={`overflow-hidden rounded-2xl border bg-white transition-shadow ${
          focused
            ? "border-primary/40 shadow-[0_1px_0_rgba(20,16,12,0.03),0_22px_48px_-24px_rgba(15,77,58,0.28)]"
            : "border-border shadow-[0_1px_0_rgba(20,16,12,0.03),0_18px_40px_-24px_rgba(20,16,12,0.20)]"
        }`}
      >
        {/* Selector row */}
        <div className="flex flex-wrap items-center gap-2 border-b border-border/70 px-3 py-2.5">
          <Select
            label="County"
            value={county}
            onChange={setCounty}
            options={COUNTIES}
          />
          <Select
            label="Fiscal year"
            value={fy}
            onChange={setFy}
            options={FISCAL_YEARS}
          />

          <div className="ml-auto flex items-center gap-2">
            {isSwahili && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-accent-soft bg-accent-soft px-2.5 py-1 text-[10.5px] font-medium uppercase tracking-[0.12em] text-accent">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" />
                Swahili
              </span>
            )}
            <span className="hidden items-center gap-1 text-[10.5px] uppercase tracking-[0.16em] text-muted sm:flex">
              <kbd className="rounded border border-border bg-paper px-1.5 py-[1px] font-sans text-[10px] font-medium text-ink-2">
                ⌘K
              </kbd>
              to focus
            </span>
          </div>
        </div>

        {/* Input row */}
        <div className="flex items-center">
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder={ROTATING_PLACEHOLDERS[placeholderIdx]}
            aria-label="Ask a question about a county budget"
            className="flex-1 bg-transparent px-5 py-5 text-[15.5px] text-ink outline-none placeholder:text-muted/80"
          />
          <button
            onClick={() => submit()}
            disabled={loading || !q.trim()}
            aria-label="Ask"
            className="group m-2 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-[13.5px] font-medium text-paper transition hover:bg-primary-2 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? (
              <>
                Thinking
                <span className="bl-caret !h-3 !w-[5px] !bg-paper" />
              </>
            ) : (
              <>
                Ask
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 12 12"
                  fill="none"
                  aria-hidden
                  className="transition-transform group-hover:translate-x-0.5"
                >
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

        {/* Recent questions */}
        {recent.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 border-t border-border/70 px-3 py-2.5">
            <span className="text-[10.5px] uppercase tracking-[0.16em] text-muted">
              Recent
            </span>
            {recent.map((r, i) => (
              <button
                key={`${r.q}-${i}`}
                onClick={() => runRecent(r)}
                disabled={loading}
                className="max-w-[260px] truncate rounded-full border border-border bg-paper px-2.5 py-1 text-[11.5px] text-ink-2 transition hover:border-primary/40 hover:bg-primary-soft hover:text-primary disabled:opacity-40"
                title={r.q}
              >
                {r.q}
              </button>
            ))}
            <button
              onClick={() => {
                setRecent([]);
                saveRecent([]);
              }}
              className="ml-auto text-[10.5px] text-muted transition hover:text-ink-2"
              aria-label="Clear recent questions"
            >
              clear
            </button>
          </div>
        )}
      </div>

      {/* Suggestions for the selected county */}
      <div className="mt-4 flex flex-wrap gap-2">
        {suggestions.map((s) => (
          <button
            key={s}
            onClick={() => submit(s)}
            disabled={loading}
            className="rounded-full border border-border bg-white/70 px-3.5 py-1.5 text-[12.5px] text-ink-2 transition hover:-translate-y-[1px] hover:border-primary/40 hover:bg-primary-soft hover:text-primary disabled:opacity-40"
          >
            {s}
          </button>
        ))}
      </div>

      {/* Tiny hint row */}
      <div className="mt-3 flex items-center gap-3 text-[11px] text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-1 w-1 rounded-full bg-primary" />
          Answers cite the exact page
        </span>
        <span className="hidden h-1 w-1 rounded-full bg-border-strong sm:inline-block" />
        <span className="hidden sm:inline">
          English or Swahili — detected automatically
        </span>
      </div>
    </div>
  );
}
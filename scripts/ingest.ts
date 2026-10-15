// scripts/ingest.ts
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { getSupabase } from "../lib/supabase";
import { getAI, EMBED_MODEL, EMBED_DIM } from "../lib/gemini";

const supabase = getSupabase();

const MAX_CHARS = 1200;
const OVERLAP = 200;
const SLEEP_MS = 400;
const MAX_RETRIES = 4;

type Meta = {
  doc_id: string;
  county: string;
  fiscal_year: string;
  doc_type: "PBB" | "CFSP" | "CBROP" | "CIDP" | "COB" | "BUDGET";
};

async function extractPages(file: string): Promise<string[]> {
  const data = new Uint8Array(fs.readFileSync(file));
  const doc = await pdfjs.getDocument({ data, useSystemFonts: true }).promise;
  const out: string[] = [];

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const text = content.items
      .map((it: any) => ("str" in it ? it.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    out.push(text);
  }
  return out;
}

function splitChunks(text: string): string[] {
  if (text.length <= MAX_CHARS) return [text];
  const chunks: string[] = [];
  let i = 0;
  while (i < text.length) {
    chunks.push(text.slice(i, i + MAX_CHARS));
    if (i + MAX_CHARS >= text.length) break;
    i += MAX_CHARS - OVERLAP;
  }
  return chunks;
}

async function getExistingPages(doc_id: string): Promise<Set<number>> {
  const { data, error } = await supabase
    .from("chunks")
    .select("page")
    .eq("doc_id", doc_id);

  if (error) throw error;
  return new Set((data ?? []).map((r: any) => r.page));
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function embedWithRetry(text: string): Promise<number[] | null> {
  const ai = getAI();

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await ai.models.embedContent({
        model: EMBED_MODEL,
        contents: text,
        config: { outputDimensionality: EMBED_DIM },
      });
      const vec = res.embeddings?.[0]?.values;
      if (!vec || vec.length !== EMBED_DIM) return null;
      return vec;
    } catch (err: any) {
      const msg =
        err?.message ??
        err?.error?.message ??
        (typeof err === "object" ? JSON.stringify(err) : String(err));
      const isRateLimit =
        String(msg).includes("429") ||
        String(msg).toLowerCase().includes("quota") ||
        String(msg).toLowerCase().includes("rate");

      if (!isRateLimit || attempt === MAX_RETRIES) {
        if (isRateLimit) {
          console.warn(
            `\n  🛑 daily quota exhausted — stopping. Enable billing or retry tomorrow.`
          );
          throw new Error("QUOTA_EXHAUSTED");
        }
        console.warn(`\n  ⚠ embed failed: ${String(msg).slice(0, 120)}`);
        return null;
      }

      const backoff = 2000 * Math.pow(2, attempt);
      process.stdout.write(`  ⏸  rate limited, waiting ${backoff / 1000}s…\r`);
      await sleep(backoff);
    }
  }
  return null;
}

async function ingest(file: string, meta: Meta) {
  console.log(`\n→ ${path.basename(file)}  [${meta.county} ${meta.doc_type}]`);
  const pages = await extractPages(file);
  console.log(`  ${pages.length} pages total`);

  const existing = await getExistingPages(meta.doc_id);
  if (existing.size > 0) {
    console.log(`  ${existing.size} pages already in DB`);
  }

  const rows: any[] = [];
  pages.forEach((pageText, idx) => {
    const pageNum = idx + 1;
    if (existing.has(pageNum)) return;
    if (pageText.length < 80) return;
    splitChunks(pageText).forEach((content, ci) => {
      rows.push({ ...meta, page: pageNum, chunk_index: ci, content });
    });
  });

  console.log(`  ${rows.length} new chunks to embed`);

  if (rows.length === 0) {
    console.log(`  ✓ nothing to do`);
    return;
  }

  let ok = 0;
  let skipped = 0;

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    let vec: number[] | null = null;

    try {
      vec = await embedWithRetry(r.content);
    } catch (e: any) {
      if (e?.message === "QUOTA_EXHAUSTED") {
        console.log(
          `\n  ⛔ stopping at chunk ${i}/${rows.length} (page ${r.page})`
        );
        console.log(
          `  💡 re-run this script after quota reset — it will resume from here`
        );
        throw e;
      }
      throw e;
    }

    if (vec === null) {
      skipped++;
    } else {
      const { error } = await supabase
        .from("chunks")
        .insert({ ...r, embedding: vec });
      if (error) {
        console.error(`\n  ❌ insert failed at ${i}:`, error.message);
      } else {
        ok++;
      }
    }

    const pct = Math.round(((i + 1) / rows.length) * 100);
    process.stdout.write(
      `  ${i + 1}/${rows.length} (${pct}%)  ok=${ok} skipped=${skipped}\r`
    );

    await sleep(SLEEP_MS);
  }

  console.log(`\n  ✓ done — ${ok} inserted, ${skipped} skipped`);
}

// ============================================================
// DOCUMENT REGISTRY
//
// Four documents currently ingested:
//   - Nairobi CFSP 2025/26   (complete)
//   - Kisumu Budget 2025/26  (partial — resumes on re-run)
//   - Narok CFSP 2025/26     (new)
//   - Nyandarua CFSP 2025/26 (new)
//
// Add new entries by dropping the PDF into data/pdfs/ and adding
// a matching entry below. Missing files are skipped automatically.
// ============================================================
const DOCS: Array<[string, Meta]> = [
  [
    "data/pdfs/nairobi-cfsp-2025.pdf",
    {
      doc_id: "nairobi-cfsp-2025",
      county: "Nairobi",
      fiscal_year: "2025/26",
      doc_type: "CFSP",
    },
  ],
  [
    "data/pdfs/kisumu-budget-2025.pdf",
    {
      doc_id: "kisumu-budget-2025",
      county: "Kisumu",
      fiscal_year: "2025/26",
      doc_type: "BUDGET",
    },
  ],
  [
    "data/pdfs/narok-cfsp-2025.pdf",
    {
      doc_id: "narok-cfsp-2025",
      county: "Narok",
      fiscal_year: "2025/26",
      doc_type: "CFSP",
    },
  ],
  [
    "data/pdfs/nyandarua-cfsp-2025.pdf",
    {
      doc_id: "nyandarua-cfsp-2025",
      county: "Nyandarua",
      fiscal_year: "2025/26",
      doc_type: "CFSP",
    },
  ],
];

// ============================================================
// MAIN
// ============================================================
(async () => {
  const start = Date.now();
  let processed = 0;
  let skipped = 0;

  try {
    for (const [file, meta] of DOCS) {
      if (!fs.existsSync(file)) {
        console.warn(`\n⏭  skip missing: ${file}`);
        skipped++;
        continue;
      }
      await ingest(file, meta);
      processed++;
    }

    const mins = ((Date.now() - start) / 60000).toFixed(1);
    console.log(`\n────────────────────────────────────────────`);
    console.log(`all done in ${mins} min`);
    console.log(`  processed: ${processed} files`);
    console.log(`  skipped:   ${skipped} files (not downloaded)`);
  } catch (e: any) {
    if (e?.message === "QUOTA_EXHAUSTED") {
      console.log(`\n────────────────────────────────────────────`);
      console.log(`Stopped early due to Gemini quota.`);
      console.log(`Re-run "npm run ingest" after the quota resets`);
      console.log(`(or enable billing) — it will resume automatically.`);
    } else {
      console.error("\n❌ FATAL");
      console.error("   message:", e?.message);
      console.error(
        "   raw:",
        JSON.stringify(e, Object.getOwnPropertyNames(e ?? {}), 2)
      );
    }
    process.exit(1);
  }
})();
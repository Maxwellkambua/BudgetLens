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
const BATCH = 10;

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

async function embedBatch(texts: string[]): Promise<(number[] | null)[]> {
  const ai = getAI();
  const out: (number[] | null)[] = [];

  for (let i = 0; i < texts.length; i++) {
    const t = texts[i];
    try {
      const res = await ai.models.embedContent({
        model: EMBED_MODEL,
        contents: t,
        config: { outputDimensionality: EMBED_DIM },
      });
      const vec = res.embeddings?.[0]?.values;
      if (!vec || vec.length !== EMBED_DIM) {
        console.warn(`\n  ⚠ chunk ${i} returned bad vector (len=${vec?.length})`);
        out.push(null);
      } else {
        out.push(vec);
      }
    } catch (err: any) {
      const msg =
        err?.message ??
        err?.error?.message ??
        (typeof err === "object" ? JSON.stringify(err) : String(err));
      console.warn(`\n  ⚠ chunk ${i} failed: ${String(msg).slice(0, 120)}`);
      console.warn(`     text preview: ${t.slice(0, 80)}`);
      out.push(null);
    }
    await new Promise((r) => setTimeout(r, 120));
  }

  return out;
}

async function ingest(file: string, meta: Meta) {
  console.log(`\n→ ${path.basename(file)}`);
  const pages = await extractPages(file);
  console.log(`  ${pages.length} pages`);

  const rows: any[] = [];
  pages.forEach((pageText, idx) => {
    if (pageText.length < 80) return;
    splitChunks(pageText).forEach((content, ci) => {
      rows.push({ ...meta, page: idx + 1, chunk_index: ci, content });
    });
  });
  console.log(`  ${rows.length} chunks`);

  if (rows.length === 0) {
    console.warn(`  ⚠ 0 chunks — PDF may be scanned, skipping`);
    return;
  }

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const vectors = await embedBatch(batch.map((r) => r.content));

    const good = batch
      .map((r, j) => ({ ...r, embedding: vectors[j] }))
      .filter((r) => r.embedding !== null);

    if (good.length === 0) {
      process.stdout.write(
        `  ${Math.min(i + BATCH, rows.length)}/${rows.length} (all skipped)\r`
      );
      continue;
    }

    const { error } = await supabase.from("chunks").insert(good);
    if (error) {
      console.error(`\n  ❌ insert failed at chunk ${i}:`, error.message);
      throw error;
    }

    process.stdout.write(`  ${Math.min(i + BATCH, rows.length)}/${rows.length}\r`);
  }
  console.log(`  ✓ done`);
}

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
];

(async () => {
  try {
    for (const [file, meta] of DOCS) {
      if (!fs.existsSync(file)) {
        console.warn(`skip missing ${file}`);
        continue;
      }
      await ingest(file, meta);
    }
    console.log("\nall done");
  } catch (e: any) {
    console.error("\n❌ FATAL");
    console.error("   message:", e?.message);
    console.error("   status:", e?.status);
    console.error(
      "   raw:",
      JSON.stringify(e, Object.getOwnPropertyNames(e ?? {}), 2)
    );
    process.exit(1);
  }
})();
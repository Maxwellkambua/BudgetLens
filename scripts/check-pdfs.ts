// scripts/check-pdfs.ts
import fs from "node:fs";
import path from "node:path";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

const DIR = "data/pdfs";

async function check(file: string) {
  const data = new Uint8Array(fs.readFileSync(file));
  const doc = await pdfjs.getDocument({ data, useSystemFonts: true }).promise;

  let totalChars = 0;
  const pageSamples: string[] = [];

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const text = content.items
      .map((it: any) => ("str" in it ? it.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    totalChars += text.length;
    if (p <= 3) pageSamples.push(`    p${p}: ${text.slice(0, 120)}…`);
  }

  const avg = Math.round(totalChars / doc.numPages);
  const verdict =
    avg < 100 ? "❌ LOOKS SCANNED — pdfjs won't work" : "✓ text-extractable";

  console.log(`\n${path.basename(file)}`);
  console.log(`  pages: ${doc.numPages}`);
  console.log(`  avg chars/page: ${avg}`);
  console.log(`  ${verdict}`);
  console.log(`  samples:`);
  pageSamples.forEach((s) => console.log(s));
}

(async () => {
  const files = fs.readdirSync(DIR).filter((f) => f.endsWith(".pdf"));
  if (files.length === 0) {
    console.log("No PDFs in data/pdfs/");
    return;
  }
  for (const f of files) await check(path.join(DIR, f));
})();

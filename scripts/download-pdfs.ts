// scripts/download-pdfs.ts
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const OUT = "data/pdfs";
fs.mkdirSync(OUT, { recursive: true });

const SOURCES = [
  {
    name: "nairobi-pbb-2025",
    url: "MANUAL", // download manually — see README note in terminal output
  },
  {
    name: "nairobi-cfsp-2025",
    url: "https://repository.kippra.or.ke/server/api/core/bitstreams/46883e7f-1941-4a71-9aa5-b621bc0f65e9/content",
    direct: true,
  },
  {
    name: "nairobi-cbrop-2024",
    url: "https://repository.kippra.or.ke/bitstream/handle/123456789/5378/Nairobi%20CBROP-2024.pdf",
    direct: true,
  },
  {
    name: "kisumu-budget-2025",
    url: "http://kisumuassembly.go.ke/?bfd_download=proposed-budget-estimates-for-fy-2025-2026",
    direct: true,
  },
];

async function downloadDirect(url: string, dest: string) {
  console.log(`  fetching: ${url}`);
  const res = await fetch(url, {
    headers: {
      // Some .go.ke servers reject requests without a browser-like UA
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const ct = res.headers.get("content-type") ?? "";
  if (!ct.includes("pdf") && !ct.includes("octet-stream")) {
    console.warn(`  ⚠ content-type is "${ct}" — may not be a PDF`);
  }

  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 1000) {
    throw new Error(`file too small (${buf.length} bytes) — probably an error page`);
  }

  fs.writeFileSync(dest, buf);
  console.log(`  ✓ ${dest} (${(buf.length / 1e6).toFixed(1)} MB)`);
}

async function downloadViaBrowser(pageUrl: string, dest: string) {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  const pdfUrls: string[] = [];

  page.on("response", (res) => {
    const ct = res.headers()["content-type"] ?? "";
    if (ct.includes("pdf")) pdfUrls.push(res.url());
  });

  try {
    await page.goto(pageUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
  } catch (e: any) {
    // If navigation itself triggered a download, that's fine — capture it
    if (e.message?.includes("Download is starting")) {
      console.log("  page is a direct download — fetching directly");
      await browser.close();
      await downloadDirect(pageUrl, dest);
      return;
    }
    throw e;
  }

  const hrefs = await page.$$eval("a[href]", (as) =>
    as.map((a) => (a as HTMLAnchorElement).href)
  );
  hrefs
    .filter((h) => h.toLowerCase().endsWith(".pdf"))
    .forEach((h) => pdfUrls.push(h));

  if (pdfUrls.length === 0) {
    const buttons = await page.$$("a, button");
    for (const b of buttons) {
      const text = ((await b.textContent()) ?? "").toLowerCase();
      if (text.includes("download")) {
        try {
          const [download] = await Promise.all([
            page.waitForEvent("download", { timeout: 8000 }).catch(() => null),
            b.click({ timeout: 5000 }),
          ]);
          if (download) pdfUrls.push(download.url());
        } catch {
          // navigation race — ignore and try next button
        }
      }
    }
  }

  await browser.close();

  if (pdfUrls.length === 0) {
    throw new Error(`no PDF found — download manually from ${pageUrl}`);
  }

  await downloadDirect(pdfUrls[0], dest);
}

(async () => {
  console.log("Budget Lens — PDF downloader\n");

  for (const src of SOURCES) {
    console.log(`→ ${src.name}`);

    if (src.url === "MANUAL") {
      console.log("  ⏭  skipped — download manually:");
      console.log(
        "     https://nairobi.go.ke/download/nairobi-city-county-program-based-and-itemised-budget-2025-2026-fy"
      );
      console.log(`     save as: data/pdfs/${src.name}.pdf\n`);
      continue;
    }

    const dest = path.join(OUT, `${src.name}.pdf`);

    if (fs.existsSync(dest)) {
      console.log(`  ✓ already exists, skipping\n`);
      continue;
    }

    try {
      if ((src as any).direct) {
        await downloadDirect(src.url, dest);
      } else {
        await downloadViaBrowser(src.url, dest);
      }
    } catch (e: any) {
      console.warn(`  ✗ ${e.message}\n`);
      continue;
    }
    console.log("");
  }

  // Summary
  console.log("\n─── Summary ───");
  const files = fs.readdirSync(OUT).filter((f) => f.endsWith(".pdf"));
  if (files.length === 0) {
    console.log("No PDFs in data/pdfs/. Check the errors above.");
  } else {
    for (const f of files) {
      const size = (fs.statSync(path.join(OUT, f)).size / 1e6).toFixed(1);
      console.log(`  ${f}  (${size} MB)`);
    }
  }
})();

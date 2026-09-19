# Budget Lens

**Ask any question about a Kenyan county budget. Get a plain-language answer with a page citation.**

Built for the **OSF × Andela Hackathon 2026** — Track: **Transparency & Accountability**.

🔗 **Live demo:** https://budgetlens-sigma.vercel.app/

---

## The problem

County budgets in Kenya are public. But a 400-page Programme Based Budget or Fiscal Strategy Paper in technical English is effectively unreadable for the citizens it affects. The information exists — it just isn't accessible.

This matters because transparency without accessibility is just paperwork. If a citizen in Kisumu can't find out how much their county allocated to health, "public budget documents" don't mean much.

## What Budget Lens does

- Answers plain-language questions about a Kenyan county budget
- **Cites the exact page** for every factual claim, so anyone can verify
- Works in **English and Swahili**
- Reachable on **web and WhatsApp** — no app install, no data plan beyond WhatsApp
- Refuses to answer when the source documents don't contain the answer
- Never speculates about motive, corruption, or missing money

Ask: *"How much is allocated to health in Kisumu?"*  
Get: an answer, a figure in KES, and a citation you can check.

## What's ingested

| County | Document | Fiscal year | Status |
|---|---|---|---|
| Nairobi | County Fiscal Strategy Paper (CFSP) | 2025/26 | Complete |
| Kisumu | Approved Budget Estimates | 2025/26 | Partial |

We were unable to source the Nairobi Programme Based Budget (PBB) — the document with ward-level detail — in the time available. Nairobi answers come from the CFSP, so they're sector-level, not ward-level. Kisumu's later sections (sports, public service, county assembly) are not yet ingested. The pipeline is county-agnostic and resumable; finishing is a matter of running the ingest script.

## How it works

    PDF → chunk (1200 chars, 200 overlap) → Gemini embedding (768-dim) → Supabase pgvector
                                                                                ↓
         Question → embed → vector search (top 8 chunks) → Gemini 3.6 Flash → cited answer

1. **Ingest** — County budget PDFs are extracted page by page, split into 1,200-character chunks with 200-character overlap, embedded with `gemini-embedding-001` at 768 dimensions, and stored in Supabase pgvector.
2. **Retrieve** — A user question is embedded with the same model. The `match_chunks` Postgres function returns the top 8 semantically similar chunks, optionally filtered by county and fiscal year.
3. **Generate** — The retrieved chunks are passed to `gemini-3.6-flash` with a strict system prompt: answer only from context, cite every claim, never speculate, match the user's language.

Every answer is grounded in retrieved text. There is no hallucination pathway by design.

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15 (App Router), React 19 |
| Styling | Tailwind CSS v4 |
| Vector store | Supabase Postgres + pgvector |
| Embeddings | `gemini-embedding-001` (768-dim) |
| Chat | `gemini-3.6-flash`, temperature 0.1 |
| Channels | Web + WhatsApp (Twilio sandbox) |
| Deploy | Vercel |

## Setup

### Prerequisites

- Node.js 20+
- A Supabase project (free tier is fine)
- A Google AI Studio API key
- (Optional) A Twilio account for WhatsApp

### Install

    git clone https://github.com/Maxwellkambua/BudgetLens.git
    cd BudgetLens
    npm install

### Configure

    cp .env.example .env

Fill in:

    GEMINI_API_KEY=AIza...
    SUPABASE_URL=https://xxxx.supabase.co
    SUPABASE_SERVICE_KEY=sb_secret_...
    NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
    NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
    NEXT_PUBLIC_APP_URL=http://localhost:3000

### Initialize the database

Paste `supabase/schema.sql` into the Supabase SQL Editor and run it. This creates the `chunks` table, the IVFFlat index, and the `match_chunks` function.

### Ingest documents

Place county budget PDFs in `data/pdfs/`, edit the `DOCS` array in `scripts/ingest.ts` to match your filenames, then:

    npm run ingest

The script is **resumable** — it checks which pages are already in the database and only embeds new ones. Re-running after a quota error or interruption picks up where it left off.

### Run

    npm run dev

Open [http://localhost:3000](http://localhost:3000).

## WhatsApp setup

1. Sign up at [twilio.com](https://www.twilio.com/try-twilio)
2. Go to **Messaging → Try it out → Send a WhatsApp message**
3. Join the sandbox from your phone using the provided code
4. Set **"When a message comes in"** to `https://YOUR-URL.vercel.app/api/whatsapp` (POST)
5. Send any budget question to the sandbox number

## Limits

- **Two counties.** Nairobi and Kisumu. Adding more is running the ingest script — the pipeline is not county-specific.
- **Nairobi answers are sector-level.** No PBB means no ward-level detail for Nairobi.
- **Kisumu is partial.** Roughly the first 60% of the document is ingested. Health, education, water, and agriculture are covered; sports, public service, and county assembly are not.
- **No live data.** A snapshot of published documents, not a live budget tracker.
- **PDF tables are imperfect.** Budget PDFs are table-heavy; text extraction flattens them. For critical figures, the citation is provided so anyone can verify against the original.
- **No user accounts.** No history, no saved queries, no personalisation.
- **Not legal or financial advice.** Budget Lens reports what the documents say. Nothing more.

## What's next

- Ingest all 47 counties' PBB, CBROP, and CIDP documents
- Add Controller of Budget quarterly absorption reports to compare approved vs. spent
- Ward-level answers once PBB ingestion is complete
- SMS fallback for users without WhatsApp
- Publish a public source index so every answer links to the original PDF page
- Pilot with a civic organisation (Mzalendo, Transparency International Kenya, or a county CBO)



## Team

Maxwell Kambua

## License

MIT
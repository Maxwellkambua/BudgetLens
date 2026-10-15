# Budget Lens

**Ask any question about a Kenyan county budget. Get a plain-language answer with a page citation.**

Built for the **OSF × Andela Hackathon 2026** — Track: **Transparency & Accountability**.

🔗 **Live demo:** : https://budgetlens-sigma.vercel.app/

---

## The problem

County budgets in Kenya are public. But a 400-page Programme Based Budget or Fiscal Strategy Paper in technical English is effectively unreadable for the citizens it affects. The information exists — it just isn't accessible.

This matters because transparency without accessibility is just paperwork. If a citizen in Kisumu can't find out how much their county allocated to health, "public budget documents" don't mean much.

## What Budget Lens does

- Answers plain-language questions about Kenyan county budgets
- **Cites the exact page** for every factual claim, so anyone can verify
- Works in **English and Swahili** — detected automatically, answered in kind
- Reachable on **web and WhatsApp** — no app install, no data plan beyond WhatsApp
- Refuses to answer when the source documents don't contain the answer
- Never speculates about motive, corruption, or missing money

Ask: *"How much is allocated to health in Kisumu?"*
Get: a direct answer, a figure in KES, and a citation you can check against the original PDF.

## What's ingested

| County | Document | Fiscal year | Status |
|---|---|---|---|
| Nairobi | County Fiscal Strategy Paper (CFSP) | 2025/26 | Complete |
| Kisumu | Approved Budget Estimates | 2025/26 | Partial |
| Narok | County Fiscal Strategy Paper (CFSP) | 2025/26 | Complete |
| Nyandarua | County Fiscal Strategy Paper (CFSP) | 2025/26 | Complete |

Two documents are complete and one is partial (Kisumu's later sections — sports, public service, county assembly — are not yet embedded). The ingest script is resumable, so finishing Kisumu is a matter of running one command after the embedding quota resets.

## How it works

    PDF → chunk (1200 chars, 200 overlap) → Gemini embedding (768-dim) → Supabase pgvector
                                                                                ↓
         Question → embed → vector search (top 8 chunks) → Gemini 3.6 Flash → cited answer

1. **Ingest** — County budget PDFs are extracted page by page, split into 1,200-character chunks with 200-character overlap, embedded with `gemini-embedding-001` at 768 dimensions, and stored in Supabase pgvector.
2. **Retrieve** — A user question is embedded with the same model. A custom `match_chunks` Postgres function performs an IVFFlat cosine-similarity search, returning the top 8 most relevant chunks with optional county and fiscal-year filters.
3. **Generate** — The retrieved chunks are passed to `gemini-3.6-flash` with a strict system prompt: cite every claim, never speculate, match the user's language. Every answer is grounded in retrieved text by design, not just by instruction.

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15 (App Router), React 19 |
| Styling | Tailwind CSS v4 |
| Typography | Fraunces (display) + Inter (body) via `next/font` |
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

### Download the budget PDFs

    npx tsx scripts/download-pdfs.ts

The script fetches county budget PDFs from the URLs in its `SOURCES` array, validates each file by checking for the `%PDF` magic bytes, and reports what it got. Some county websites block automated requests — if a file fails, open the URL in a browser and use **Save Link As** to drop the PDF into `data/pdfs/` with the expected filename.

### Ingest the documents

    npm run ingest

The script is **resumable** — it checks which pages are already in the database and only embeds new ones. Re-running after a quota error or interruption picks up exactly where it left off. This matters because the Gemini free tier enforces a daily embedding quota; the script backs off exponentially on rate-limit errors and stops cleanly when the quota is exhausted.

### Run locally

    npm run dev

Open [http://localhost:3000](http://localhost:3000).

## WhatsApp setup

1. Sign up at [twilio.com](https://www.twilio.com/try-twilio)
2. Go to **Messaging → Try it out → Send a WhatsApp message**
3. Join the sandbox from your phone using the provided code
4. Set **"When a message comes in"** to `https://YOUR-URL.vercel.app/api/whatsapp` (POST)
5. Send any budget question to the sandbox number

## Deploying to Vercel

1. Push the repo to GitHub.
2. Import it into Vercel.
3. Add the six environment variables listed above in **Settings → Environment Variables**. Tick **Production**, **Preview**, and **Development** for each.
4. Redeploy — env var changes don't apply to existing deployments. When Vercel asks, **uncheck** "Use existing build cache."
5. Verify in the **Logs** tab (not the build log) that requests to `/api/ask` succeed.

The Supabase client and Gemini client are both **lazy-initialized** — they read `process.env` inside a function call rather than at module load. This is deliberate: Next.js evaluates route modules during the build step, so top-level `createClient(...)` calls fail on Vercel where env vars aren't wired in until runtime.

## Design notes

**Citations, not just answers.** The retrieval step returns page numbers with each chunk, and the model is instructed to cite inline as `[CFSP Nairobi 2025/26, p.42]`. In the UI, those citations render as small amber chips so the answer reads like a footnoted document. For a civic tool, verifiability is the whole point.

**Refusal is a feature.** The system prompt instructs the model to say *"the document doesn't say"* when context is missing, rather than improvising. A civic tool that hallucinates is worse than no tool at all.

**Swahili and WhatsApp.** Most Kenyans access the internet through WhatsApp on entry-level phones. Building for the web alone would have missed the audience that matters most. The WhatsApp path delivers the same cited answers without an app install or additional data plan.

**Rate limiting.** The `/api/ask` route caps requests at 20 per IP per minute. It's per-serverless-instance, so not bulletproof, but it stops casual abuse and accidental cost runaway.

## Limits (honest)

We'd rather tell you what this doesn't do than oversell it.

- **Four counties.** Nairobi, Kisumu, Narok, and Nyandarua. Adding more is downloading the PDF and running the ingest script — the pipeline is county-agnostic.
- **Kisumu is partial.** Roughly the first 60% of the document is ingested. Health, education, water, and agriculture are covered; sports, public service, and county assembly are not.
- **No PBB for Nairobi.** The Programme Based Budget (which has ward-level detail) wasn't publicly downloadable in the time available, so Nairobi answers come from the CFSP and are sector-level, not ward-level.
- **No live data.** A snapshot of published documents, not a live budget tracker.
- **PDF tables are imperfect.** Budget PDFs are table-heavy; text extraction flattens them. For critical figures, the citation is provided so anyone can verify against the original.
- **No user accounts.** No history, no saved queries, no personalisation beyond browser-local recent questions.
- **Supabase free tier pauses after 7 days of inactivity.** If the demo seems to break, log into Supabase and restore the project.
- **Not legal or financial advice.** Budget Lens reports what the documents say. Nothing more.

## What's next

- Finish Kisumu ingestion (resume the script after quota reset)
- Ingest all 47 counties' PBB, CBROP, and CIDP documents
- Add Controller of Budget quarterly absorption reports to compare approved vs. spent
- Ward-level answers once PBB ingestion is complete
- SMS fallback for users without WhatsApp
- Publish a public source index so every answer links to the original PDF page
- Pilot with a civic organisation (Mzalendo, Transparency International Kenya, or a county CBO)

## Why this fits the track

The Transparency & Accountability track asks for tools that help people understand policies, track public spending, and scrutinise institutional decisions.

Budget Lens does all three — and it does them with citations. A citizen can't just get an answer; they can check it. That's what real accountability requires. It also refuses to speculate, which matters more than any single feature: a civic tool that guesses is worse than no tool at all.

## Team

Maxwell Kambua

## License

MIT
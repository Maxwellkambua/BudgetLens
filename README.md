# Budget Lens

**Ask any question about a Kenyan county budget. Get a plain-language answer with a page citation.**

Built for the OSF × Andela Hackathon 2026 — Track: *Transparency & Accountability*.

## The problem
County budgets in Kenya are public. But a 400-page Programme Based Budget in technical English is effectively unreadable for the citizens it affects. Budget Lens turns it into a conversation.

## What it does
- Answers plain-language questions about a county budget
- **Cites the exact page** for every factual claim
- Works in **English and Swahili**
- Reachable on the **web and WhatsApp** — no app install, no data plan beyond WhatsApp
- Refuses to answer when the source documents don't contain the answer
- Never speculates about motive, corruption, or missing money

## Stack
Next.js 15 · Supabase (pgvector) · OpenAI `text-embedding-3-small` + `gpt-4o-mini` · Twilio WhatsApp · Vercel

## Setup

1. `npm install`
2. Copy `.env.example` → `.env.local` and fill in keys.
3. Run `supabase/schema.sql` in Supabase's SQL editor.
4. Drop county PDFs into `data/pdfs/` and edit the `DOCS` array in `scripts/ingest.ts`.
5. `npm run ingest`
6. `npm run dev`

## WhatsApp
Set the Twilio sandbox "When a message comes in" webhook to
`https://your-app.vercel.app/api/whatsapp` (POST).

## Limits (honest)
- Ward-level figures are only reported where documents state them
- Currently ingests Nairobi; the pipeline is county-agnostic
- No live tracking; a snapshot of published documents

## Pilot partners
Piloting with [CBO / Mzalendo / TI-Kenya] — TBD.
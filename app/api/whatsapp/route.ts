// app/api/whatsapp/route.ts
import { NextRequest, NextResponse } from "next/server";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function twiml(message: string) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response><Message>${esc(message.slice(0, 1500))}</Message></Response>`;
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const body = String(form.get("Body") ?? "").trim();

  if (!body) {
    return new NextResponse(
      twiml(
        'Send me a question about a Kenyan county budget, e.g. "What is Nairobi\'s total budget for 2025/26?"'
      ),
      { headers: { "Content-Type": "text/xml" } }
    );
  }

  try {
    const url = new URL("/api/ask", req.url);
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: body }),
    });
    const d = await r.json();

    if (!d.answer) throw new Error("no answer");

    const srcs = (d.sources ?? [])
      .slice(0, 3)
      .map((s: any) => `• ${s.doc}, p.${s.page}`)
      .join("\n");

    return new NextResponse(twiml(`${d.answer}\n\nSources:\n${srcs}`), {
      headers: { "Content-Type": "text/xml" },
    });
  } catch {
    return new NextResponse(twiml("Sorry, something went wrong. Try again."), {
      headers: { "Content-Type": "text/xml" },
    });
  }
}

export async function GET() {
  return new NextResponse("ok");
}
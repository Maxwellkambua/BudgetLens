import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "How much did Nairobi allocate to health?";
  const a =
    searchParams.get("a") ??
    "KES 12.4 billion — about 21% of the total county budget.";
  const src = searchParams.get("src") ?? "PBB Nairobi 2025/26, p.42";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: 60,
          background: "linear-gradient(135deg, #0b1220 0%, #111d38 100%)",
          color: "white",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: "#22d3ee",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 28,
              fontWeight: 700,
              color: "#0b1220",
            }}
          >
            BL
          </div>
          <div style={{ fontSize: 32, fontWeight: 700 }}>Budget Lens</div>
        </div>

        <div
          style={{
            marginTop: 50,
            fontSize: 30,
            color: "#94a3b8",
            lineHeight: 1.3,
          }}
        >
          {q}
        </div>

        <div
          style={{
            marginTop: 24,
            fontSize: 46,
            fontWeight: 700,
            lineHeight: 1.25,
            flex: 1,
          }}
        >
          {a.length > 200 ? a.slice(0, 200) + "…" : a}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 22,
            color: "#67e8f9",
          }}
        >
          <div>Source: {src}</div>
          <div style={{ color: "#94a3b8" }}>budget-lens.vercel.app</div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}

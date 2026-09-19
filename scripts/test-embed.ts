// scripts/test-embed.ts
import "dotenv/config";
import { GoogleGenAI } from "@google/genai";

async function main() {
  const key = process.env.GEMINI_API_KEY;
  console.log("key present:", !!key, "prefix:", key?.slice(0, 8));

  const ai = new GoogleGenAI({ apiKey: key! });

  console.log("\n--- list available models ---");
  try {
    const models = await ai.models.list();
    let count = 0;
    for await (const m of models) {
      if (m.name?.includes("embed")) {
        console.log("  ", m.name, "→", m.supportedActions ?? "");
        count++;
      }
      if (count > 20) break;
    }
  } catch (e: any) {
    console.log("list failed:", e?.message ?? e);
  }

  console.log("\n--- test embed with gemini-embedding-001 ---");
  try {
    const res = await ai.models.embedContent({
      model: "gemini-embedding-001",
      contents: ["Hello world", "Budget test"],
      config: { outputDimensionality: 768 },
    });
    console.log("embeddings returned:", res.embeddings?.length);
    console.log("first vector length:", res.embeddings?.[0]?.values?.length);
  } catch (e: any) {
    console.log("embed failed");
    console.log("  type:", typeof e);
    console.log("  keys:", e && typeof e === "object" ? Object.keys(e) : "n/a");
    console.log("  message:", e?.message);
    console.log("  status:", e?.status);
    console.log("  stringified:", JSON.stringify(e, Object.getOwnPropertyNames(e ?? {}), 2));
  }
}

main();

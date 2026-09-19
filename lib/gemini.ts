// lib/gemini.ts
import { GoogleGenAI } from "@google/genai";

let _ai: GoogleGenAI | null = null;

export function getAI(): GoogleGenAI {
  if (!_ai) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error(
        "GEMINI_API_KEY is not set. Check your .env file at project root."
      );
    }
    _ai = new GoogleGenAI({ apiKey: key });
  }
  return _ai;
}

export const EMBED_MODEL = "gemini-embedding-001";
export const CHAT_MODEL = "gemini-3.6-flash";
export const EMBED_DIM = 768;

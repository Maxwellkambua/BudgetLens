// lib/supabase.ts
import { createClient, SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!_client) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY;
    if (!url || !key) {
      throw new Error(
        "SUPABASE_URL or SUPABASE_SERVICE_KEY is not set. Check your env vars."
      );
    }
    _client = createClient(url, key, {
      auth: { persistSession: false },
    });
  }
  return _client;
}
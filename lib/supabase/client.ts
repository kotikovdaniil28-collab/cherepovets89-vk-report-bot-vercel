"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const FALLBACK_URL = "https://hcefoztytkfskmdchqos.supabase.co";
const FALLBACK_ANON_KEY = "sb_publishable_VRSxi6NDTxJwAcQkni6dwg_xluZs8X6";

let browserClient: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!browserClient) {
    browserClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || FALLBACK_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || FALLBACK_ANON_KEY,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      }
    );
  }
  return browserClient;
}

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const FALLBACK_URL = "https://hcefoztytkfskmdchqos.supabase.co";
const FALLBACK_ANON_KEY = "sb_publishable_VRSxi6NDTxJwAcQkni6dwg_xluZs8X6";

export function getServiceClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || FALLBACK_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY не задан");
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

export function getAnonServerClient(accessToken?: string): SupabaseClient {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || FALLBACK_URL;
  const anonKey =
    process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || FALLBACK_ANON_KEY;
  return createClient(url, anonKey, {
    auth: { persistSession: false },
    global: accessToken ? { headers: { Authorization: `Bearer ${accessToken}` } } : undefined,
  });
}

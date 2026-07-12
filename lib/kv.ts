import type { SupabaseClient } from "@supabase/supabase-js";
import { makeId, type ReportRow } from "@/lib/reports";

// Таблица reports используется как KV-хранилище через sentinel-emails.
// Строка: { id, email: SENTINEL, link, date, status, xp }

export async function kvList(supa: SupabaseClient, sentinel: string): Promise<ReportRow[]> {
  const { data } = await supa.from("reports").select("*").eq("email", sentinel);
  return (data || []) as ReportRow[];
}

export async function kvListByLink(
  supa: SupabaseClient,
  sentinel: string,
  link: string
): Promise<ReportRow[]> {
  const { data } = await supa.from("reports").select("*").eq("email", sentinel).eq("link", link);
  return (data || []) as ReportRow[];
}

export async function kvInsert(
  supa: SupabaseClient,
  sentinel: string,
  row: Partial<ReportRow> & { idPrefix?: string }
) {
  const { idPrefix, ...rest } = row;
  const record = {
    id: rest.id || makeId(idPrefix || sentinel.toLowerCase() + "_"),
    email: sentinel,
    date: rest.date ?? new Date().toLocaleString("ru-RU"),
    xp: rest.xp ?? 0,
    ...rest,
  };
  const { error } = await supa.from("reports").insert([record]);
  if (error) throw error;
  return record;
}

export async function kvDelete(supa: SupabaseClient, sentinel: string, match: Partial<ReportRow>) {
  let q = supa.from("reports").delete().eq("email", sentinel);
  if (match.link != null) q = q.eq("link", match.link);
  if (match.status != null) q = q.eq("status", match.status);
  if (match.id != null) q = q.eq("id", match.id);
  const { error } = await q;
  if (error) throw error;
}

export async function kvUpdate(
  supa: SupabaseClient,
  sentinel: string,
  id: string,
  patch: Partial<ReportRow>
) {
  const { error } = await supa.from("reports").update(patch).eq("email", sentinel).eq("id", id);
  if (error) throw error;
}

// JSON-значение в поле date
export function kvJson<T = Record<string, unknown>>(row: ReportRow): T | null {
  try {
    const raw = String(row.date || "");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

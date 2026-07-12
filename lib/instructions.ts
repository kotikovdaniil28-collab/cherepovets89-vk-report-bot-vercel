import type { SupabaseClient } from "@supabase/supabase-js";

// Хранение инструкций — 1:1 формат legacy (upsert в reports по фиксированному id)
export const SETTINGS_EMAIL = "SITE_SETTINGS";
export const INSTRUCTION_ROW = "ch89_instruction_rules_v170";
export const REPORT_INSTRUCTION_ROW = "ch89_report_check_instruction_v172";

export async function loadInstruction(supa: SupabaseClient, rowId: string): Promise<string> {
  const { data } = await supa.from("reports").select("date").eq("id", rowId).limit(1);
  const row = data?.[0];
  return row?.date ? String(row.date) : "";
}

export async function saveInstruction(
  supa: SupabaseClient,
  rowId: string,
  link: string,
  text: string
) {
  const { error } = await supa.from("reports").upsert(
    [{ id: rowId, email: SETTINGS_EMAIL, link, date: text, status: "active", xp: 0 }],
    { onConflict: "id" }
  );
  if (error) throw error;
}

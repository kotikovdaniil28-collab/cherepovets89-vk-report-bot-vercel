// Загрузка полной инструкции в Supabase (reports, id = ch89_instruction_rules_v170)
// Запуск: node scripts/upload-instruction.mjs <email> <password>
import { createClient } from "@supabase/supabase-js";
import { INSTRUCTION } from "./instruction-content.mjs";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://hcefoztytkfskmdchqos.supabase.co";
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_VRSxi6NDTxJwAcQkni6dwg_xluZs8X6";

const [email, password] = process.argv.slice(2);
if (!email || !password) {
  console.error("Usage: node scripts/upload-instruction.mjs <email> <password>");
  process.exit(1);
}

const supa = createClient(URL, KEY);
const { error: authError } = await supa.auth.signInWithPassword({ email, password });
if (authError) {
  console.error("Auth failed:", authError.message);
  process.exit(1);
}

const { error } = await supa.from("reports").upsert(
  [
    {
      id: "ch89_instruction_rules_v170",
      email: "SITE_SETTINGS",
      link: "instruction",
      date: INSTRUCTION,
      status: "active",
      xp: 0,
    },
  ],
  { onConflict: "id" },
);

if (error) {
  console.error("Upload failed:", error.message);
  process.exit(1);
}
console.log("Instruction uploaded:", INSTRUCTION.length, "chars");
process.exit(0);

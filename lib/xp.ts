import type { SupabaseClient } from "@supabase/supabase-js";
import { KV, KV_EMAILS } from "@/lib/constants";
import { makeId } from "@/lib/reports";

// Две валюты:
// - XP модерации = одобренные отчёты + дельты GAME_XP со status != 'game'
//   (магазин, рулетка магазина, ручные начисления руководства — legacy-строки 'mod')
// - Игровой XP = дельты GAME_XP со status = 'game' (тренажёры, квесты, игры)
//   Тратится ТОЛЬКО на игры.

export async function computeUserXp(supa: SupabaseClient, userId: string, userEmail: string) {
  const [reportRes, deltaRes, manualRes] = await Promise.all([
    supa.from("reports").select("xp").eq("email", userEmail).gt("xp", 0),
    supa.from("reports").select("xp, status").eq("email", KV.GAME_XP).eq("link", userId),
    // Legacy-строки ручной выдачи от бота (MANUAL_XP) — тоже XP модерации
    supa.from("reports").select("xp").eq("email", "MANUAL_XP").eq("link", userId),
  ]);
  const reportXp = (reportRes.data || []).reduce((sum, r) => sum + (Number(r.xp) || 0), 0);
  let modDelta = (manualRes.data || []).reduce((sum, r) => sum + (Number(r.xp) || 0), 0);
  let gameXp = 0;
  for (const r of deltaRes.data || []) {
    const v = Number(r.xp) || 0;
    if (String(r.status) === "game") gameXp += v;
    else modDelta += v;
  }
  const modXp = Math.max(0, reportXp + modDelta);
  gameXp = Math.max(0, gameXp);
  return { reportXp, modXp, gameXp, total: modXp + gameXp };
}

// Дельта игрового XP (тренажёры, квесты, ставки и выигрыши в играх)
export async function addGameXp(supa: SupabaseClient, userId: string, amount: number, note = "") {
  if (!Number.isFinite(amount) || amount === 0) return;
  await supa.from("reports").insert([
    { id: makeId("gxp_"), email: KV.GAME_XP, link: userId, xp: amount, status: "game", date: note },
  ]);
}

// Дельта XP модерации (ставки/выигрыши в играх за реальный XP, покупки в магазине)
export async function addModXp(supa: SupabaseClient, userId: string, amount: number, note = "") {
  if (!Number.isFinite(amount) || amount === 0) return;
  await supa.from("reports").insert([
    { id: makeId("mxp_"), email: KV.GAME_XP, link: userId, xp: amount, status: "mod", date: note },
  ]);
}

// Проверка: получал ли пользователь награду с этой пометкой (защита от повторного клейма квестов)
export async function hasGameXpNote(supa: SupabaseClient, userId: string, note: string) {
  const { data } = await supa
    .from("reports")
    .select("id")
    .eq("email", KV.GAME_XP)
    .eq("link", userId)
    .eq("date", note)
    .limit(1);
  return Boolean(data?.length);
}

// Лидерборд: сгруппировать XP по всем пользователям (обе валюты в общий рейтинг)
export async function computeLeaderboard(supa: SupabaseClient) {
  const [repRes, gameRes] = await Promise.all([
    supa.from("reports").select("email, xp").gt("xp", 0).neq("email", KV.GAME_XP),
    supa.from("reports").select("link, xp").eq("email", KV.GAME_XP),
  ]);
  const byEmail = new Map<string, number>();
  for (const r of repRes.data || []) {
    const email = String(r.email || "");
    if (!email || KV_EMAILS.has(email)) continue;
    byEmail.set(email, (byEmail.get(email) || 0) + (Number(r.xp) || 0));
  }
  const byUserId = new Map<string, number>();
  for (const r of gameRes.data || []) {
    const uid = String(r.link || "");
    if (!uid) continue;
    byUserId.set(uid, (byUserId.get(uid) || 0) + (Number(r.xp) || 0));
  }
  return { byEmail, byUserId };
}

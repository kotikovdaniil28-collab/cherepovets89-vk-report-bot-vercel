import type { SupabaseClient } from "@supabase/supabase-js";
import { KV } from "@/lib/constants";
import { makeId, type ReportRow } from "@/lib/reports";

export type ShopItem = {
  id: string;
  title: string;
  desc: string;
  price: number;
  icon: string;
  action?: string;
  custom?: boolean;
};

export type RoulettePrize = {
  id: string;
  icon: string;
  text: string;
  val: number;
};

// Дефолтные товары — 1:1 из legacy
export const DEFAULT_MOD_SHOP: ShopItem[] = [
  { id: "mm_1", title: "ММ: Скидка -1 день", desc: "Ускоряет повышение Младшего Модератора (ММ → М).", price: 200, icon: "⏳" },
  { id: "m_1", title: "М: Скидка -1 день", desc: "Ускоряет повышение Модератора (М → СМ).", price: 250, icon: "⏳" },
  { id: "sm_1", title: "СМ: Скидка -1 день", desc: "Ускоряет повышение Старшего Модератора (СМ → ЗГМ).", price: 300, icon: "⏳" },
  { id: "bonus_1", title: "Снятие предупреждения", desc: "Снимает 1 активное предупреждение.", price: 200, icon: "🛡️" },
  { id: "bonus_2", title: "Снятие выговора", desc: "Снимает 1 активный выговор.", price: 400, icon: "🔥" },
  { id: "bonus_3", title: "Иммунитет на предупреждение", desc: "Защищает от 1 предупреждения в будущем.", price: 300, icon: "🛡️" },
  { id: "bonus_4", title: "Иммунитет на выговор", desc: "Защищает от 1 выговора в будущем.", price: 500, icon: "👑" },
];

export const DEFAULT_AP_SHOP: ShopItem[] = [
  { id: "ap_1", title: "Снятие предупреждения", desc: "Снимает 1 активное предупреждение.", price: 15, icon: "🛡️" },
  { id: "ap_2", title: "Снятие выговора", desc: "Снимает 1 активный выговор.", price: 25, icon: "🔥" },
  { id: "ap_3", title: "Иммунитет на выговор", desc: "Защищает от получения 1 выговора.", price: 40, icon: "👑" },
  { id: "ap_4", title: "Неактив (1 день)", desc: "Взять неактив без потери нормы.", price: 10, icon: "🛌" },
];

export const DEFAULT_FSB_SHOP: ShopItem[] = [
  { id: "fsb_1", title: "Снятие выговора", desc: "Неограниченно", price: 40, icon: "📁" },
  { id: "fsb_2", title: "Снятие предупреждения", desc: "Неограниченно", price: 25, icon: "⚠️" },
  { id: "fsb_3", title: "Иммунитет на выговор", desc: "Неограниченно", price: 15, icon: "🛡️" },
  { id: "fsb_4", title: "Иммунитет на предупреждение", desc: "Неограниченно", price: 10, icon: "🛡️" },
  { id: "fsb_5", title: "Любой транспорт из среднего авто салона на сутки", desc: "Неограниченно", price: 25, icon: "🚗" },
  { id: "fsb_6", title: "Танк на 30 минут в пгр мире", desc: "1 раз за весь срок", price: 55, icon: "🛡️" },
  { id: "fsb_7", title: "Отпуск на 7 дней", desc: "1 раз в месяц", price: 30, icon: "🏖️" },
  { id: "fsb_8", title: "250к валюты", desc: "1 раз в неделю", price: 25, icon: "💰" },
  { id: "fsb_10", title: "Освобождение от норматива (1 день)", desc: "3 раза в неделю", price: 20, icon: "✅" },
  { id: "fsb_12", title: "Неактив (Причина неактивности)", desc: "2 раза в неделю", price: 15, icon: "🛌" },
  { id: "fsb_13", title: "Роспись от Лидера ФСБ", desc: "1 раз", price: 15, icon: "✍️" },
  { id: "fsb_14", title: "Роспись от следящего ФСБ", desc: "1 раз", price: 15, icon: "✍️" },
];

export const MOD_ROULETTE_PRIZES: RoulettePrize[] = [
  { id: "leg", icon: "🏆", text: "500 XP", val: 500 },
  { id: "rare", icon: "💎", text: "300 XP", val: 300 },
  { id: "fail", icon: "💀", text: "Ничего", val: 0 },
  { id: "fine", icon: "📉", text: "Штраф -100 XP", val: -100 },
];

export const AP_ROULETTE_PRIZES: RoulettePrize[] = [
  { id: "leg", icon: "🏆", text: "50 Баллов", val: 50 },
  { id: "rare", icon: "💎", text: "30 Баллов", val: 30 },
  { id: "fail", icon: "💀", text: "Ничего", val: 0 },
  { id: "fine", icon: "📉", text: "Штраф -10 Баллов", val: -10 },
];

// Кастомные товары: SHOP_MOD / SHOP_AP — { date: title, status: desc, xp: price, link: icon }
export async function loadCustomShop(supa: SupabaseClient, sentinel: string): Promise<ShopItem[]> {
  const { data } = await supa.from("reports").select("*").eq("email", sentinel);
  return ((data || []) as ReportRow[]).map((r) => ({
    id: r.id,
    title: String(r.date || "Товар"),
    desc: String(r.status || ""),
    price: Number(r.xp) || 0,
    icon: String(r.link || "🎁"),
    custom: true,
  }));
}

// SHOP_OVERRIDE: { link: itemId, xp: новая цена }
export async function loadPriceOverrides(supa: SupabaseClient): Promise<Map<string, number>> {
  const { data } = await supa.from("reports").select("*").eq("email", KV.SHOP_OVERRIDE);
  const map = new Map<string, number>();
  for (const r of (data || []) as ReportRow[]) {
    const itemId = String(r.link || "");
    const price = Number(r.xp);
    if (itemId && Number.isFinite(price) && price > 0) map.set(itemId, price);
  }
  return map;
}

// Покупка за XP модератора: отрицательная дельта GAME_XP
export async function spendModXp(supa: SupabaseClient, userId: string, amount: number, note: string) {
  const { error } = await supa.from("reports").insert([
    { id: makeId("gxp_"), email: KV.GAME_XP, link: userId, xp: -Math.abs(amount), status: "mod", date: note },
  ]);
  if (error) throw error;
}

// Начисление XP (выигрыш)
export async function grantModXp(supa: SupabaseClient, userId: string, amount: number, note: string) {
  if (amount === 0) return;
  const { error } = await supa.from("reports").insert([
    { id: makeId("gxp_"), email: KV.GAME_XP, link: userId, xp: amount, status: "mod", date: note },
  ]);
  if (error) throw error;
}

// Баллы АП: AP_POINTS дельты (могут быть отрицательными при покупке)
export async function computeApPoints(supa: SupabaseClient, userId: string) {
  const { data } = await supa.from("reports").select("xp").eq("email", "AP_POINTS").eq("link", userId);
  return (data || []).reduce((s, r) => s + (Number(r.xp) || 0), 0);
}

export async function spendApPoints(supa: SupabaseClient, userId: string, amount: number, note: string) {
  const { error } = await supa.from("reports").insert([
    { id: makeId("app_"), email: "AP_POINTS", link: userId, xp: -Math.abs(amount), status: "ap", date: note },
  ]);
  if (error) throw error;
}

export async function grantApPoints(supa: SupabaseClient, userId: string, amount: number, note: string) {
  if (amount === 0) return;
  const { error } = await supa.from("reports").insert([
    { id: makeId("app_"), email: "AP_POINTS", link: userId, xp: amount, status: "ap", date: note },
  ]);
  if (error) throw error;
}

// Баллы ФСБ: FSB_POINTS дельты минус FSB_SPEND расходы
export async function computeFsbPoints(supa: SupabaseClient, userId: string) {
  const [ptsRes, spendRes] = await Promise.all([
    supa.from("reports").select("xp").eq("email", "FSB_POINTS").eq("link", userId),
    supa.from("reports").select("xp").eq("email", "FSB_SPEND").eq("link", userId),
  ]);
  const pts = (ptsRes.data || []).reduce((s, r) => s + (Number(r.xp) || 0), 0);
  const spent = (spendRes.data || []).reduce((s, r) => s + Math.abs(Number(r.xp) || 0), 0);
  return Math.max(0, pts - spent);
}

export async function spendFsbPoints(supa: SupabaseClient, userId: string, amount: number, note: string) {
  const { error } = await supa.from("reports").insert([
    { id: makeId("fsp_"), email: "FSB_SPEND", link: userId, xp: Math.abs(amount), status: "fsb", date: note },
  ]);
  if (error) throw error;
}

// Лог покупки в admin_logs (формат legacy) — руководство видит и отмечает «Выдано»
export async function logPurchase(
  supa: SupabaseClient,
  params: {
    userEmail: string;
    nickname: string;
    itemName: string;
    cost: number;
    kind: "mod" | "ap" | "fsb";
    autoIssued?: boolean;
  }
) {
  await supa.from("admin_logs").insert([
    {
      user_email: params.userEmail,
      nickname: params.nickname,
      item_name: params.itemName,
      cost: params.cost,
      type: params.kind === "ap" ? "ap_shop" : "mod_shop",
      status: params.autoIssued ? "Автоматически зачислено" : "Ожидает выдачи",
    },
  ]);
}

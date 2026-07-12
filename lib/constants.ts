// Доменные константы — совместимы с legacy-базой. НЕ менять значения.

export const CREATOR_EMAIL = "daniiltimosin72@gmail.com";

export const LEADERSHIP_EMAILS = new Set([
  CREATOR_EMAIL,
  "leha.br222@gmail.com",
  "isayevrufat37@gmail.com",
  "maksimladnyj4@gmail.com",
]);

// XP за вердикты по отчётам
export const STATUS_XP: Record<string, number> = {
  Норма: 10,
  Перенорма: 30,
  Натяг: 7,
  "Герой дня": 60,
  "Не засчитано": 0,
};

export const APPROVED_STATUSES = new Set(["Норма", "Перенорма", "Натяг", "Герой дня"]);

export const REJECT_REASONS: Record<string, string> = {
  none: "",
  no_proof: "Нет или недостаточно доказательств",
  not_enough_work: "Недостаточный объём работы",
  wrong_date: "Неверная дата отчёта",
  duplicate: "Дубликат отчёта",
  rules: "Работа не соответствует требованиям",
};

// Sentinel-emails: таблица reports используется как KV-хранилище
export const KV = {
  ADMIN_ROLE: "ADMIN_ROLE", // status: leadership | ap_admin | fsb_admin, link = user_id
  USER_ROLE: "USER_ROLE", // status: moderator | ap | fsb, link = user_id
  USER_KIND: "USER_KIND",
  GAME_XP: "GAME_XP", // link = user_id, xp = дельта
  INACTIVE_REQ: "INACTIVE_REQ",
  ROULETTE_MOD: "ROULETTE_MOD",
  ROULETTE_AP: "ROULETTE_AP",
  ROULETTE_FSB: "ROULETTE_FSB",
  SHOP_MOD: "SHOP_MOD",
  SHOP_AP: "SHOP_AP",
  SHOP_OVERRIDE: "SHOP_OVERRIDE",
  CUSTOM_MOD_MSG: "CUSTOM_MOD_MSG",
  CUSTOM_AP_MSG: "CUSTOM_AP_MSG",
  HIDDEN_CHECK: "HIDDEN_CHECK",
  SITE_SETTING: "SITE_SETTING",
  TROLL_EFFECT: "TROLL_EFFECT",
  WEEKLY_QUIZ_DONE: "WEEKLY_QUIZ_DONE",
  REPORT_TABLE_MARK: "REPORT_TABLE_MARK",
  GOSS_PROFILE: "GOSS_PROFILE",
  GOSS_REPORTS: "GOSS_REPORTS",
  GOSS_STAFF: "GOSS_STAFF",
  GOSS_USER_REPORT: "GOSS_USER_REPORT",
} as const;

// Полный список служебных sentinel-email'ов (из legacy) — эти строки НЕ являются отчётами
export const SERVICE_EMAILS = [
  ...Object.values(KV),
  "ACCESS_KEY",
  "MANUAL_XP",
  "AP_POINTS",
  "FSB_POINTS",
  "FSB_SPEND",
  "SHOP_FSB",
  "GOSS_REPORT_CHECK",
  "GOSS_REPORT_TABLE",
  "GOSS_REPORT_TABLE_V13",
  "GOSS_REPORT_TABLE_V15",
  "GOSS_REPORT_TABLE_V16",
  "GOSS_REPORT_TABLE_V19",
  "GOSS_REPORT_MEMBER_V19",
  "GOSS_REPORT_PROOF_V19",
  "GOSS_POINTS_V19",
  "GOSS_ORG_LOG",
  "GOSS_ORG_LOG_V19",
  "GOSS_ORG_LOG_V24",
  "GOSS_SHOP_ITEMS_V13",
  "GOSS_SHOP_ITEMS_V19",
  "GOSS_SHOP_ITEMS_V24",
  "GOSS_SHOP_ITEMS_V26",
  "GOSS_SHOP_PURCHASE",
  "FSB_SHOP_LOG",
];

export const KV_EMAILS = new Set<string>(SERVICE_EMAILS);

// Ранги карьеры модератора
export const RANKS: Record<string, { short: string; title: string; next?: string }> = {
  junior_moderator: { short: "ММ", title: "Младший модератор", next: "Модератор" },
  moderator: { short: "М", title: "Модератор", next: "Старший модератор" },
  senior_moderator: { short: "СМ", title: "Старший модератор" },
  km: { short: "КМ", title: "Куратор модерации" },
  zgm: { short: "ЗГМ", title: "Заместитель главного модератора" },
  gm: { short: "ГМ", title: "Главный модератор" },
};

export type AdminRole = "leadership" | "ap_admin" | "fsb_admin";
export type UserKind = "moderator" | "ap" | "fsb";

// Система повышения модераторов — точная копия правил VK-бота (api/vk.js):
//   ММ -> М:  7 дней + 7 одобренных отчётов (досрочно: 5 дней + 5 Перенорм/Героев)
//   М -> СМ: 14 дней + 14 одобренных отчётов (досрочно: 10 дней + 10 Перенорм/Героев)
// Источник данных: moderator_careers (rank, rank_started_at), которую ведёт бот.
// Ранги в базе: junior_moderator | moderator | senior_moderator | km | zgm | gm

export type ModRank =
  | "junior_moderator"
  | "moderator"
  | "senior_moderator"
  | "km"
  | "zgm"
  | "gm"
  | "unknown";

export type PromotionRules = {
  regularDays: number;
  regularReports: number;
  earlyDays: number;
  earlyHigh: number; // Перенорма / Герой дня
};

export type PromotionTrack = {
  rank: ModRank;
  rankLabel: string;
  nextLabel: string | null;
  rules: PromotionRules | null;
  daysOnRank: number;
  approvedCount: number;
  highCount: number;
  progress: number; // 0..1 к обычному сроку (дни)
  eligibleRegular: boolean;
  eligibleEarly: boolean;
  // Совместимость со старыми полями карточки
  standardDays: number | null;
  fastDays: number | null;
  eligibleStandard: boolean;
  eligibleFast: boolean;
};

export const RANK_LABELS: Record<ModRank, string> = {
  junior_moderator: "Младший модератор",
  moderator: "Модератор",
  senior_moderator: "Старший модератор",
  km: "Куратор модерации",
  zgm: "Зам. главного модератора",
  gm: "Главный модератор",
  unknown: "Модератор",
};

// Бот хранит ранг в формате junior_moderator/moderator/... — нормализуем и легаси-варианты
export function normalizeRank(raw: string | null | undefined): ModRank {
  const s = (raw || "").toLowerCase().trim();
  if (!s) return "unknown";
  if (s === "km" || s.includes("куратор")) return "km";
  if (s === "zgm" || s.includes("зам")) return "zgm";
  if (s === "gm" || s.includes("главн")) return "gm";
  if (s.includes("jun") || s.includes("млад")) return "junior_moderator";
  if (s.includes("senior") || s.includes("старш") || s.includes("ст.")) return "senior_moderator";
  if (s.includes("mod") || s.includes("модер")) return "moderator";
  return "unknown";
}

// Правила из бота: rank === 'junior_moderator' и rank === 'moderator'
const RULES: Partial<Record<ModRank, { next: ModRank; rules: PromotionRules }>> = {
  junior_moderator: {
    next: "moderator",
    rules: { regularDays: 7, regularReports: 7, earlyDays: 5, earlyHigh: 5 },
  },
  moderator: {
    next: "senior_moderator",
    rules: { regularDays: 14, regularReports: 14, earlyDays: 10, earlyHigh: 10 },
  },
};

export function buildPromotionTrack(
  rawRank: string | null | undefined,
  rankStartedAt: string | null | undefined,
  counts?: { approved?: number; high?: number },
): PromotionTrack {
  const rank = normalizeRank(rawRank);
  const started = rankStartedAt ? new Date(rankStartedAt).getTime() : NaN;
  const daysOnRank = Number.isFinite(started)
    ? Math.max(0, Math.floor((Date.now() - started) / 86_400_000))
    : 0;
  const approvedCount = counts?.approved ?? 0;
  const highCount = counts?.high ?? 0;

  const track = RULES[rank];
  if (!track) {
    return {
      rank,
      rankLabel: RANK_LABELS[rank],
      nextLabel: null,
      rules: null,
      daysOnRank,
      approvedCount,
      highCount,
      progress: 1,
      eligibleRegular: false,
      eligibleEarly: false,
      standardDays: null,
      fastDays: null,
      eligibleStandard: false,
      eligibleFast: false,
    };
  }

  const r = track.rules;
  const eligibleRegular = daysOnRank >= r.regularDays && approvedCount >= r.regularReports;
  const eligibleEarly = daysOnRank >= r.earlyDays && highCount >= r.earlyHigh;

  return {
    rank,
    rankLabel: RANK_LABELS[rank],
    nextLabel: RANK_LABELS[track.next],
    rules: r,
    daysOnRank,
    approvedCount,
    highCount,
    progress: Math.min(1, daysOnRank / r.regularDays),
    eligibleRegular,
    eligibleEarly,
    standardDays: r.regularDays,
    fastDays: r.earlyDays,
    eligibleStandard: eligibleRegular,
    eligibleFast: eligibleEarly,
  };
}

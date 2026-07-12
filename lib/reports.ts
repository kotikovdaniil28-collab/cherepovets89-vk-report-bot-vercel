// Парсер/сериализатор payload отчёта.
// Формат legacy: поле `date` = "Ник: X | Дата: YYYY-MM-DD | JSON: {...}"

export type ReportRow = {
  id: string;
  email?: string | null;
  link?: string | null;
  date?: string | null;
  status?: string | null;
  xp?: number | null;
  created_at?: string | null;
};

export type ReportPayload = {
  nick: string;
  day: string;
  work: string;
  quality: string;
  proofs: string[];
  json: Record<string, unknown>;
};

export function parseReportPayload(row: ReportRow): ReportPayload {
  const raw = String(row.date || "");
  const match = raw.match(/JSON:\s*(\{[\s\S]*\})\s*$/i);
  let json: Record<string, unknown> = {};
  try {
    json = JSON.parse(match?.[1] || (raw.trim().startsWith("{") ? raw : "{}"));
  } catch {
    json = {};
  }
  const pick = (pattern: RegExp) => raw.match(pattern)?.[1]?.trim() || "";
  const proofs: string[] = [];
  const jsonProofs = json.proofs || json.screenshots || json.images;
  if (Array.isArray(jsonProofs)) {
    for (const p of jsonProofs) {
      // Сайт хранит строки, VK-бот — объекты вида { url, type, ... }
      if (typeof p === "string" && p.trim()) proofs.push(p.trim());
      else if (p && typeof p === "object") {
        const u = String((p as Record<string, unknown>).url || (p as Record<string, unknown>).link || "").trim();
        if (u) proofs.push(u);
      }
    }
  } else if (typeof jsonProofs === "string" && jsonProofs.trim()) {
    proofs.push(...jsonProofs.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean));
  }
  const linkProof = String(row.link || "").trim();
  if (proofs.length === 0 && /^https?:\/\//i.test(linkProof)) proofs.push(linkProof);

  return {
    nick: String(json.nick || json.nickname || pick(/Ник:\s*([^|]+)/i) || row.email || "Модератор"),
    day: String(json.date || json.day || pick(/Дата:\s*([\d-]+)/i) || "—"),
    work: String(json.work || json.comment || pick(/Работа:\s*([^|]+)/i) || "—"),
    quality: String(json.quality || json.requestedStatus || pick(/Тип\s*сдачи:\s*([^|]+)/i) || ""),
    proofs,
    json,
  };
}

// Сериализация в формате VK-бота, чтобы бот и сайт читали отчёты одинаково:
// "Ник: X | Дата: Y | Работа: Z | Тип сдачи: Q | Доказательства: N | JSON: {...}"
export function serializeReportPayload(input: {
  nick: string;
  day: string;
  work: string;
  quality?: string;
  proofs?: string[];
  userId?: string;
  email?: string;
  extra?: Record<string, unknown>;
}): string {
  const proofs = input.proofs || [];
  const quality = input.quality || "Норма";
  const json = {
    version: "site_v60",
    source: "site",
    nick: input.nick,
    nickname: input.nick,
    work: input.work,
    comment: input.work,
    date: input.day,
    day: input.day,
    quality,
    requestedStatus: quality,
    proofs,
    ...(input.userId ? { userId: input.userId } : {}),
    ...(input.email ? { email: input.email } : {}),
    createdIso: new Date().toISOString(),
    ...(input.extra || {}),
  };
  return (
    `Ник: ${input.nick} | ` +
    `Дата: ${input.day} | ` +
    `Работа: ${input.work} | ` +
    `Тип сдачи: ${quality} | ` +
    `Доказательства: ${proofs.length} | ` +
    `JSON: ${JSON.stringify(json)}`
  );
}

export function reportDayMs(row: ReportRow): number {
  const p = parseReportPayload(row);
  const raw = p.day;
  const t = new Date(/^20\d\d-\d\d-\d\d$/.test(raw) ? raw + "T12:00:00+03:00" : raw).getTime();
  return Number.isFinite(t) ? t : 0;
}

export function makeId(prefix = "") {
  return `${prefix}${Date.now()}${Math.random().toString(36).slice(2, 8)}`;
}

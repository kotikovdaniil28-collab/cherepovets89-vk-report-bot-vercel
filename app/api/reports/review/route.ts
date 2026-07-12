import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const statusXp: Record<string, number> = {
  "Норма": 10,
  "Перенорма": 30,
  "Натяг": 7,
  "Герой дня": 60,
  "Не засчитано": 0
};

const reasons: Record<string, string> = {
  none: "",
  no_proof: "Нет или недостаточно доказательств",
  not_enough_work: "Недостаточный объём работы",
  wrong_date: "Неверная дата отчёта",
  duplicate: "Дубликат отчёта",
  rules: "Работа не соответствует требованиям"
};

const fixedLeadershipEmails = new Set([
  "daniiltimosin72@gmail.com",
  "leha.br222@gmail.com",
  "isayevrufat37@gmail.com",
  "maksimladnyj4@gmail.com"
]);

type ReportRow = {
  id: string;
  email?: string | null;
  link?: string | null;
  date?: string | null;
  status?: string | null;
  xp?: number | null;
};

// Те же значения, что в lib/supabase/client.ts — на случай отсутствия env на сервере
const FALLBACK_URL = "https://hcefoztytkfskmdchqos.supabase.co";
const FALLBACK_ANON_KEY = "sb_publishable_VRSxi6NDTxJwAcQkni6dwg_xluZs8X6";

function config() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || FALLBACK_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || FALLBACK_ANON_KEY;
  // Сервисный ключ опционален: без него работаем от имени пользователя (через RLS)
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  return { url, anonKey, serviceKey };
}

function parsePayload(row: ReportRow) {
  const raw = String(row.date || "");
  const match = raw.match(/JSON:\s*(\{[\s\S]*\})\s*$/i);
  let json: Record<string, unknown> = {};
  try {
    json = JSON.parse(match?.[1] || (raw.trim().startsWith("{") ? raw : "{}"));
  } catch {
    json = {};
  }
  const pick = (pattern: RegExp) => raw.match(pattern)?.[1]?.trim() || "";
  return {
    nick: String(json.nick || json.nickname || pick(/Ник:\s*([^|]+)/i) || row.email || "Модератор"),
    day: String(json.date || json.day || pick(/Дата:\s*([\d-]+)/i) || "—"),
    work: String(json.work || json.comment || pick(/Работа:\s*([^|]+)/i) || "—"),
    requestedStatus: String(json.quality || json.requestedStatus || pick(/Тип\s*сдачи:\s*([^|]+)/i) || ""),
    userId: String(json.userId || json.user_id || ""),
    vkUserId: String(json.vkUserId || "")
  };
}

// Убираем случайные кавычки/пробелы, попавшие в значение при вставке
function vkToken() {
  return String(process.env.VK_GROUP_TOKEN || "").trim().replace(/^['"]+|['"]+$/g, "");
}

async function vkApi(method: string, params: Record<string, string | number>) {
  const token = vkToken();
  if (!token) throw new Error("VK_GROUP_TOKEN is not configured");
  const body = new URLSearchParams({
    ...Object.fromEntries(Object.entries(params).map(([key, value]) => [key, String(value)])),
    access_token: token,
    v: process.env.VK_API_VERSION || "5.199"
  });
  const response = await fetch(`https://api.vk.com/method/${method}`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store"
  });
  const data = await response.json();
  if (!response.ok || data.error) throw new Error(data.error?.error_msg || `VK HTTP ${response.status}`);
  return data.response;
}

function encouragement(status: string) {
  if (status === "Герой дня") return "Это мощный результат — продолжай держать такой уровень! 🔥";
  if (status === "Перенорма") return "Отличная работа сверх нормы. Так держать! 💪";
  if (status === "Норма") return "Норма выполнена уверенно. Хорошая стабильная работа! ✅";
  if (status === "Натяг") return "Отчёт засчитан. В следующий раз добавь чуть больше работы — всё получится!";
  return "Не расстраивайся: исправь недочёты, и следующий отчёт обязательно получится лучше. Мы в тебя верим!";
}

function decisionCard(report: ReportRow, status: string, xp: number, reason: string, notification: string) {
  const parsed = parsePayload(report);
  return [
    status === "Не засчитано" ? "❌ ОТЧЁТ НЕ ЗАСЧИТАН" : "✅ ОТЧЁТ ОДОБРЕН",
    "━━━━━━━━━━━━━━━━",
    `👤 Модератор: ${parsed.nick}`,
    `📅 Дата: ${parsed.day}`,
    `🧾 Работа: ${parsed.work}`,
    `📌 Вердикт: ${status}`,
    `⭐ XP: ${xp}`,
    reason ? `💭 Причина: ${reason}` : "",
    `#️⃣ ID: ${report.id}`,
    "",
    notification === "sent" ? "✉️ Модератор получил вердикт в ЛС." : "⚠️ Вердикт в ЛС не доставлен."
  ].filter(Boolean).join("\n");
}

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
    if (!token) return NextResponse.json({ error: "Нужно войти заново" }, { status: 401 });
    const { url, anonKey, serviceKey } = config();
    const authClient = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    // С сервисным ключом — полный доступ; без него — от имени пользователя (RLS-политики)
    const admin = serviceKey
      ? createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
      : createClient(url, anonKey, {
          auth: { persistSession: false, autoRefreshToken: false },
          global: { headers: { Authorization: `Bearer ${token}` } },
        });
    const userResult = await authClient.auth.getUser(token);
    const user = userResult.data.user;
    if (!user) return NextResponse.json({ error: "Сессия истекла" }, { status: 401 });

    const lowerEmail = String(user.email || "").toLowerCase();
    const leadershipResult = await admin
      .from("reports")
      .select("id")
      .eq("email", "ADMIN_ROLE")
      .eq("link", user.id)
      .eq("status", "leadership")
      .limit(1);
    const allowed = fixedLeadershipEmails.has(lowerEmail) || Boolean(leadershipResult.data?.length);
    if (!allowed) return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });

    const body = await request.json();
    const reportId = String(body.reportId || "").trim();
    const status = String(body.status || "").trim();
    const reasonCode = String(body.reasonCode || "").trim();
    const reason = String(body.reason || reasons[reasonCode] || "").trim();
    if (!reportId || !(status in statusXp)) return NextResponse.json({ error: "Некорректное решение" }, { status: 400 });

    const reportResult = await admin.from("reports").select("*").eq("id", reportId).maybeSingle();
    if (reportResult.error || !reportResult.data) return NextResponse.json({ error: "Отчёт не найден" }, { status: 404 });
    const report = reportResult.data as ReportRow;
    const reviewResult = await admin.from("moderator_report_reviews").select("*").eq("report_id", reportId).maybeSingle();
    const oldReview = reviewResult.data;
    const xp = statusXp[status];
    const parsed = parsePayload(report);
    const updateResult = await admin.from("reports").update({ status, xp }).eq("id", reportId);
    if (updateResult.error) throw updateResult.error;

    let vkUserId = String(oldReview?.vk_user_id || parsed.vkUserId || "");
    if (!vkUserId && (parsed.userId || report.email)) {
      let linkQuery = admin.from("vk_links").select("vk_user_id");
      linkQuery = parsed.userId ? linkQuery.eq("site_user_id", parsed.userId) : linkQuery.eq("email", report.email || "");
      const linkResult = await linkQuery.limit(1).maybeSingle();
      vkUserId = String(linkResult.data?.vk_user_id || "");
    }

    // Без VK_GROUP_TOKEN оставляем 'waiting' — бот сам доставит вердикт в ЛС
    const hasVkToken = Boolean(vkToken());
    let notificationStatus = vkUserId ? (hasVkToken ? "failed" : "waiting") : "not_linked";
    let notificationError = vkUserId ? "" : "VK не привязан";
    if (vkUserId && hasVkToken) {
      try {
        await vkApi("messages.send", {
          peer_id: vkUserId,
          random_id: Math.floor(Math.random() * 2147483647),
          disable_mentions: 1,
          message: [
            status === "Не засчитано" ? "❌ ОТЧЁТ НЕ ЗАСЧИТАН" : "✅ ОТЧЁТ РАССМОТРЕН",
            "━━━━━━━━━━━━━━━━",
            `📅 Дата: ${parsed.day}`,
            `📌 Вердикт: ${status}`,
            `⭐ Начислено: ${xp} XP`,
            reason ? `💭 Причина: ${reason}` : "",
            "",
            encouragement(status)
          ].filter(Boolean).join("\n")
        });
        notificationStatus = "sent";
      } catch (error) {
        notificationError = error instanceof Error ? error.message : String(error);
      }
    }

    const now = new Date().toISOString();
    const audit = {
      report_id: reportId,
      site_user_id: oldReview?.site_user_id || parsed.userId || null,
      email: oldReview?.email || report.email || null,
      vk_user_id: vkUserId || null,
      requested_status: oldReview?.requested_status || parsed.requestedStatus || null,
      final_status: status,
      xp,
      verdict: status === "Не засчитано" ? "rejected" : "approved",
      reason_code: reasonCode || null,
      reason_text: reason || null,
      actor_vk_user_id: oldReview?.actor_vk_user_id || null,
      actor_site_user_id: user.id,
      source: "site",
      staff_peer_id: oldReview?.staff_peer_id || null,
      staff_conversation_message_id: oldReview?.staff_conversation_message_id || null,
      staff_message_text: oldReview?.staff_message_text || null,
      staff_attachments: oldReview?.staff_attachments || null,
      notification_status: notificationStatus,
      notification_error: notificationError || null,
      reviewed_at: now,
      updated_at: now
    };
    const auditResult = await admin.from("moderator_report_reviews").upsert(audit, { onConflict: "report_id" });
    if (auditResult.error) throw auditResult.error;

    if (oldReview?.staff_peer_id && oldReview?.staff_conversation_message_id) {
      try {
        await vkApi("messages.edit", {
          peer_id: oldReview.staff_peer_id,
          conversation_message_id: oldReview.staff_conversation_message_id,
          message: decisionCard(report, status, xp, reason, notificationStatus),
          keyboard: JSON.stringify({ inline: true, buttons: [] }),
          ...(oldReview.staff_attachments ? { attachment: oldReview.staff_attachments } : {})
        });
      } catch (editError) {
        // Решение на сайте остаётся в силе, даже если старую VK-карточку уже нельзя отредактировать
        console.warn(
          "vk card edit failed:",
          editError instanceof Error ? editError.message : editError,
        );
      }
    }

    return NextResponse.json({ ok: true, status, xp, notificationStatus });
  } catch (error) {
    console.error("report review route failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Ошибка сервера" }, { status: 500 });
  }
}

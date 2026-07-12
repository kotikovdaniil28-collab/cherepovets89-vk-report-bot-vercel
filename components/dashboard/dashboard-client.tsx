"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import {
  Activity,
  ArrowRight,
  BarChart3,
  CheckCheck,
  BadgeCheck,
  ClipboardCheck,
  Clock,
  Flame,
  Gem,
  Star,
  Trophy,
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { getSupabase } from "@/lib/supabase/client";
import { APPROVED_STATUSES, KV_EMAILS, RANKS } from "@/lib/constants";
import { isAnyAdmin } from "@/lib/roles";
import { reportDayMs, type ReportRow } from "@/lib/reports";
import { levelFromXp } from "@/lib/level";
import { buildPromotionTrack } from "@/lib/promotion";
import { Reveal, SecHead } from "@/components/ui/reveal";
import { CountUp } from "@/components/ui/count-up";

const NeonScene = dynamic(
  () => import("@/components/three/neon-scene").then((m) => m.NeonScene),
  { ssr: false }
);

const HIERARCHY = [
  { short: "РМ", title: "Руководитель модераторов", sub: "8 уровень", violet: true },
  { short: "ЗР", title: "Зам. руководителя модераторов", sub: "7 уровень", violet: true },
  { short: "ГМ", title: "Главный модератор", sub: "6 уровень" },
  { short: "ЗГ", title: "Зам. главного модератора", sub: "5 уровень" },
  { short: "К", title: "Куратор", sub: "4 уровень" },
  { short: "СМ", title: "Старший модератор", sub: "3 уровень" },
  { short: "М", title: "Модератор", sub: "2 уровень" },
  { short: "ММ", title: "Младший модератор", sub: "1 уровень" },
];

const DAY = 86400000;
const WEEKDAYS = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];

export function DashboardClient() {
  const { user, xp, roles } = useAuth();
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [nickname, setNickname] = useState("");
  const [career, setCareer] = useState<{ rank?: string | null; rank_started_at?: string | null } | null>(null);
  const [pendingReview, setPendingReview] = useState(0);
  const [vkLinked, setVkLinked] = useState(true);
  const [loading, setLoading] = useState(true);

  const admin = isAnyAdmin(roles);

  useEffect(() => {
    if (!user) return;
    const supa = getSupabase();
    let mounted = true;

    (async () => {
      const email = user.email || "";
      const [repRes, nickRes, careerRes, vkRes] = await Promise.all([
        // В таблице reports нет created_at — сортируем по id (в нём таймстамп)
        supa.from("reports").select("*").eq("email", email).order("id", { ascending: false }),
        supa.from("user_stats").select("nickname").eq("user_id", user.id).maybeSingle(),
        supa.from("moderator_careers").select("rank, rank_started_at").eq("site_user_id", user.id).maybeSingle(),
        supa.from("vk_links").select("vk_user_id").eq("site_user_id", user.id).maybeSingle(),
      ]);
      if (!mounted) return;
      setRows(((repRes.data || []) as ReportRow[]).filter((r) => !KV_EMAILS.has(String(r.email))));
      setNickname(String(nickRes.data?.nickname || ""));
      setCareer((careerRes.data as typeof career) || null);
      setVkLinked(Boolean(vkRes.data?.vk_user_id));
      setLoading(false);

      if (isAnyAdmin(roles)) {
        const { count } = await supa
          .from("reports")
          .select("id", { count: "exact", head: true })
          .or("status.is.null,status.eq.pending,status.eq.На проверке");
        if (mounted) setPendingReview(count || 0);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [user, roles]);

  const stats = useMemo(() => {
    const approved = rows.filter(
      (r) => APPROVED_STATUSES.has(String(r.status)) || (Number(r.xp) || 0) > 0
    );
    const heroes = rows.filter((r) => r.status === "Герой дня").length;
    const decided = rows.filter((r) => r.status && r.status !== "pending" && r.status !== "На проверке");
    const pct = decided.length > 0 ? Math.round((approved.length / decided.length) * 100) : 100;
    const weekAgo = Date.now() - 7 * DAY;
    const week = rows.filter((r) => reportDayMs(r) >= weekAgo);
    const weekApproved = week.filter((r) => (Number(r.xp) || 0) > 0);
    const weekStrong = week.filter((r) => r.status === "Перенорма" || r.status === "Герой дня");
    const weekPending = week.filter((r) => !r.status || r.status === "pending" || r.status === "На проверке");
    return {
      total: rows.length,
      approved: approved.length,
      heroes,
      pct,
      week: week.length,
      weekApproved: weekApproved.length,
      weekStrong: weekStrong.length,
      weekPending: weekPending.length,
    };
  }, [rows]);

  /** XP по дням за последние 7 дней для мини-графика */
  const chart = useMemo(() => {
    const days: { label: string; xp: number; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date();
      dayStart.setHours(0, 0, 0, 0);
      const start = dayStart.getTime() - i * DAY;
      const dayRows = rows.filter((r) => {
        const t = reportDayMs(r);
        return t >= start && t < start + DAY;
      });
      days.push({
        label: WEEKDAYS[new Date(start).getDay()],
        xp: dayRows.reduce((sum, r) => sum + (Number(r.xp) || 0), 0),
        count: dayRows.length,
      });
    }
    const max = Math.max(30, ...days.map((d) => d.xp));
    return { days, max };
  }, [rows]);

  const lvl = levelFromXp(xp.total);
  const rank = career?.rank ? RANKS[career.rank] : null;
  const displayName = nickname || user?.email?.split("@")[0] || "Модератор";
  const daysOnRank = career?.rank_started_at
    ? Math.max(0, Math.floor((Date.now() - new Date(career.rank_started_at).getTime()) / DAY))
    : null;

  const roleTitle = roles.isCreator
    ? "Создатель"
    : roles.isLeadership
      ? "Руководство"
      : rank?.title || "Модератор";

  // Как в боте: считаются одобренные отчёты и Перенормы/Герои за время текущего ранга
  const promoCounts = useMemo(() => {
    const started = career?.rank_started_at ? new Date(career.rank_started_at).getTime() : 0;
    const sinceRank = started > 0 ? rows.filter((r) => reportDayMs(r) >= started) : rows;
    return {
      approved: sinceRank.filter(
        (r) => APPROVED_STATUSES.has(String(r.status)) || (Number(r.xp) || 0) > 0,
      ).length,
      high: sinceRank.filter((r) => r.status === "Перенорма" || r.status === "Герой дня").length,
    };
  }, [rows, career]);

  const promo = buildPromotionTrack(career?.rank, career?.rank_started_at, promoCounts);

  /* Показатели ускоренного повышения: активность (отчёты) и качество (герои дня) */
  const ACT_TARGET = 60;
  const QUAL_TARGET = 12;
  const actPct = Math.min(100, Math.round((stats.approved / ACT_TARGET) * 100));
  const qualPct = Math.min(100, Math.round((stats.heroes / QUAL_TARGET) * 100));

  return (
    <div className="flex flex-col gap-6">
      {/* Баннер привязки VK */}
      {!loading && !vkLinked && (
        <Reveal i={0}>
          <div className="border-amber/50 bg-amber/10 flex flex-wrap items-center gap-3 rounded-2xl border p-4">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">VK не привязан</p>
              <p className="text-muted-foreground text-xs">
                Привяжи VK в профиле, чтобы получать вердикты и уведо��ления от бота в ЛС
              </p>
            </div>
            <Link
              href="/profile"
              className="bg-amber-deep inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold text-white transition-transform hover:scale-[1.03] active:scale-[0.98]"
            >
              <ArrowRight className="size-3.5" />
              Привязать
            </Link>
          </div>
        </Reveal>
      )}

      {/* Баннер руководства */}
      {admin && (
        <Reveal i={0}>
          <div className="hero-surface flex flex-wrap items-center gap-4 rounded-3xl p-5 md:p-6">
            <span className="bg-green-bright/20 flex size-11 items-center justify-center rounded-2xl">
              <ClipboardCheck className="text-green-bright size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-display text-base font-semibold">Панель руководства</p>
              <p className="text-on-hero-soft text-sm">
                Проверка отчётов, неактивы и действия команды
              </p>
            </div>
            <Link
              href="/review"
              className="bg-green-bright inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold text-[oklch(0.18_0.05_150)] transition-transform hover:scale-[1.03] active:scale-[0.98]"
            >
              <ArrowRight className="size-4" />
              Открыть
              {pendingReview > 0 && (
                <span className="font-display rounded-full bg-[oklch(0.18_0.05_150)] px-2 py-0.5 text-xs text-[oklch(0.8_0.21_145)] tabular-nums">
                  {pendingReview}
                </span>
              )}
            </Link>
          </div>
        </Reveal>
      )}

      {/* Hero профиля */}
      <Reveal i={1}>
        <div className="hero-surface relative overflow-hidden rounded-3xl p-5 md:p-8">
          {/* 3D-декор в правой части hero — только на десктопе */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-0 hidden w-[46%] opacity-70 lg:block"
          >
            <NeonScene compact className="size-full" />
            <div className="absolute inset-0 bg-linear-to-r from-[oklch(0.24_0.05_152)] via-transparent to-transparent" />
          </div>
          <div className="relative flex flex-wrap items-start gap-5">
            <motion.div
              whileHover={{ rotate: -4, scale: 1.04 }}
              className="from-green-bright to-green-deep font-display text-primary-foreground flex size-16 items-center justify-center rounded-2xl bg-linear-to-br text-2xl font-extrabold md:size-[72px]"
            >
              {displayName.slice(0, 1).toUpperCase()}
            </motion.div>
            <div className="min-w-0 flex-1">
              <span className="bg-green-bright/16 text-green-bright mb-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold tracking-[0.14em] uppercase">
                <Star className="size-3" /> {roleTitle}
              </span>
              <h1 className="font-display text-2xl font-extrabold text-balance md:text-3xl">
                {displayName}
              </h1>
              <p className="text-on-hero-soft mt-1.5 text-sm">
                {daysOnRank !== null ? (
                  <>
                    На ступени <b className="text-on-hero">{daysOnRank} дн.</b> ·{" "}
                  </>
                ) : null}
                Уровень <b className="text-on-hero">{lvl.level}</b> ·{" "}
                {lvl.intoLevel}/{lvl.needed} XP до следующего
              </p>
            </div>
            <div className="text-left sm:ml-auto sm:text-right">
              <div className="font-display text-3xl font-extrabold tabular-nums">
                <CountUp value={xp.modXp} className="text-green-bright text-glow" />
              </div>
              <div className="text-on-hero-soft text-xs">реальный XP</div>
              <div className="text-on-hero-soft/70 mt-0.5 text-[11px] tabular-nums">
                + {xp.gameXp.toLocaleString("ru-RU")} игрового
              </div>
            </div>
          </div>
          <div className="relative mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-[oklch(0.97_0.01_148/0.1)] md:grid-cols-4">
            {[
              { v: loading ? "—" : stats.total, k: "отчётов всего" },
              { v: loading ? "—" : stats.heroes, k: "Героев дня" },
              { v: loading ? "—" : `${stats.pct}%`, k: "одобрено" },
              { v: loading ? "—" : stats.approved, k: "одобренных" },
            ].map((s) => (
              <div key={s.k} className="hero-cell px-4 py-3.5">
                <div className="font-display text-xl font-semibold tabular-nums">{s.v}</div>
                <div className="text-on-hero-soft text-xs">{s.k}</div>
              </div>
            ))}
          </div>
        </div>
      </Reveal>

      <div className="grid items-start gap-6 lg:grid-cols-[1.9fr_1fr]">
        <div className="flex flex-col gap-8">
          {/* Повышение по срокам */}
          <Reveal i={2}>
            <SecHead title="Повышение" hint="срок на текущей ступени" />
            {promo.nextLabel ? (
              <div className="bg-card rounded-2xl border p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <Activity className="text-green-deep size-[18px]" />
                    <h3 className="font-display text-sm font-semibold">
                      {promo.rankLabel} <span className="text-muted-foreground">→</span>{" "}
                      {promo.nextLabel}
                    </h3>
                  </div>
                  {promo.eligibleStandard ? (
                    <span className="bg-green/15 text-green-deep rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wide uppercase">
                      Срок пройден
                    </span>
                  ) : promo.eligibleFast ? (
                    <span className="bg-amber/20 text-amber-deep rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wide uppercase">
                      Доступно ускоренное
                    </span>
                  ) : null}
                </div>
                <p className="text-muted-foreground mt-1 mb-4 text-sm">
                  Стандартно через <b className="text-foreground">{promo.standardDays} дней</b>, за
                  отличные показатели — через <b className="text-foreground">{promo.fastDays} дней</b>
                </p>
                <div className="bg-secondary relative h-[9px] overflow-hidden rounded-full">
                  <span
                    className="bar-grow from-green to-green-bright block h-full rounded-full bg-linear-to-r"
                    style={{ width: `${Math.round(promo.progress * 100)}%` }}
                  />
                  {/* Отметка ускоренного срока */}
                  {promo.fastDays && promo.standardDays && (
                    <span
                      aria-hidden
                      className="bg-amber-deep absolute top-0 h-full w-0.5"
                      style={{ left: `${Math.round((promo.fastDays / promo.standardDays) * 100)}%` }}
                    />
                  )}
                </div>
                <div className="text-muted-foreground mt-2.5 flex justify-between text-xs font-semibold">
                  <span>
                    {promo.daysOnRank} / {promo.standardDays} дней
                    {promo.fastDays ? ` (ускоренно от ${promo.fastDays})` : ""}
                  </span>
                  <span className="font-display">{Math.round(promo.progress * 100)}%</span>
                </div>
                <p className="text-muted-foreground mt-3 text-xs">
                  Решение о повышении принимает руководство — бот присылает уведомление в STAFF,
                  когда срок подходит.
                </p>
              </div>
            ) : (
              <div className="bg-card text-muted-foreground rounded-2xl border p-5 text-sm">
                {career
                  ? "Вы на высшей ступени автоматического трека — дальнейшие повышения решает руководство."
                  : "Карьерная ступень ещё не назначена ботом. Как только вас назначат модератором, здесь появится прогресс до повышения."}
              </div>
            )}
          </Reveal>

          {/* Пути ускоренного повышения */}
          <Reveal i={3}>
            <SecHead title="Показатели для ускорения" hint="активность и качество" />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="bg-card rounded-2xl border p-5">
                <div className="mb-1 flex items-center gap-2.5">
                  <Activity className="text-green-deep size-[18px]" />
                  <h3 className="font-display text-sm font-semibold">Активность</h3>
                </div>
                <p className="text-muted-foreground mb-4 text-sm">
                  Ориентир — <b className="text-foreground">{ACT_TARGET} одобренных</b> отчётов
                </p>
                <div className="bg-secondary h-[9px] overflow-hidden rounded-full">
                  <span
                    className="bar-grow from-green to-green-bright block h-full rounded-full bg-linear-to-r"
                    style={{ width: `${actPct}%` }}
                  />
                </div>
                <div className="text-muted-foreground mt-2.5 flex justify-between text-xs font-semibold">
                  <span>
                    {stats.approved} / {ACT_TARGET} отчётов
                  </span>
                  <span className="font-display">{actPct}%</span>
                </div>
              </div>
              <div className="bg-card rounded-2xl border p-5">
                <div className="mb-1 flex items-center gap-2.5">
                  <Gem className="text-amber-deep size-[18px]" />
                  <h3 className="font-display text-sm font-semibold">Качество</h3>
                </div>
                <p className="text-muted-foreground mb-4 text-sm">
                  Ориентир — <b className="text-foreground">{QUAL_TARGET} Героев дня</b>
                </p>
                <div className="bg-secondary h-[9px] overflow-hidden rounded-full">
                  <span
                    className="bar-grow from-amber-deep to-amber block h-full rounded-full bg-linear-to-r"
                    style={{ width: `${qualPct}%` }}
                  />
                </div>
                <div className="text-muted-foreground mt-2.5 flex justify-between text-xs font-semibold">
                  <span>
                    {stats.heroes} / {QUAL_TARGET} героев
                  </span>
                  <span className="font-display">{qualPct}%</span>
                </div>
              </div>
            </div>
          </Reveal>

          {/* Неделя */}
          <Reveal i={3}>
            <SecHead title="Неделя" hint="последние 7 дней" />
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {[
                { icon: CheckCheck, v: stats.week, k: "сдано", cls: "bg-green/15 text-green-deep" },
                { icon: BadgeCheck, v: stats.weekApproved, k: "одобрено", cls: "bg-blue/15 text-blue" },
                { icon: Flame, v: stats.weekStrong, k: "сильных", cls: "bg-amber/20 text-amber-deep" },
                { icon: Clock, v: stats.weekPending, k: "на проверке", cls: "bg-violet/15 text-violet" },
              ].map((t, idx) => (
                <motion.div
                  key={t.k}
                  whileHover={{ y: -3 }}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25 + idx * 0.06 }}
                  className="bg-card rounded-2xl border p-4"
                >
                  <span className={`mb-3 flex size-8 items-center justify-center rounded-lg ${t.cls}`}>
                    <t.icon className="size-4" />
                  </span>
                  <div className="font-display text-2xl font-semibold tabular-nums">
                    {loading ? "—" : t.v}
                  </div>
                  <div className="text-muted-foreground text-xs">{t.k}</div>
                </motion.div>
              ))}
            </div>
          </Reveal>
        </div>

        <aside className="flex flex-col gap-4">
          {/* Иерархия */}
          <Reveal i={2} className="bg-card rounded-2xl border p-5">
            <h3 className="font-display mb-4 flex items-center gap-2 text-sm font-semibold">
              <Trophy className="text-muted-foreground size-4" /> Иерархия
            </h3>
            <ul className="flex flex-col">
              {HIERARCHY.map((h, idx) => (
                <li
                  key={h.short}
                  className={`flex items-center gap-3 py-2 ${idx > 0 ? "border-t" : ""}`}
                >
                  <span
                    className={`bg-secondary flex size-[30px] shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                      h.violet ? "text-violet" : "text-muted-foreground"
                    }`}
                  >
                    {h.short}
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{h.title}</div>
                    <div className="text-muted-foreground text-xs">{h.sub}</div>
                  </div>
                </li>
              ))}
            </ul>
          </Reveal>

          {/* Активность за неделю */}
          <Reveal i={3} className="bg-card rounded-2xl border p-5">
            <h3 className="font-display mb-4 flex items-center gap-2 text-sm font-semibold">
              <BarChart3 className="text-muted-foreground size-4" /> Активность
            </h3>
            <div className="flex h-[140px] items-end gap-2">
              {chart.days.map((d, idx) => (
                <div key={idx} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
                  <span className="text-muted-foreground font-display text-[10px] tabular-nums">
                    {d.xp > 0 ? d.xp : ""}
                  </span>
                  <motion.span
                    initial={{ scaleY: 0 }}
                    animate={{ scaleY: 1 }}
                    transition={{ delay: 0.3 + idx * 0.05, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                    className="from-green to-green-bright w-full max-w-7 origin-bottom rounded-md bg-linear-to-t"
                    style={{ height: `${Math.max(4, Math.round((d.xp / chart.max) * 100))}%` }}
                  />
                  <span className="text-muted-foreground text-[10px] font-semibold">{d.label}</span>
                </div>
              ))}
            </div>
          </Reveal>
        </aside>
      </div>
    </div>
  );
}

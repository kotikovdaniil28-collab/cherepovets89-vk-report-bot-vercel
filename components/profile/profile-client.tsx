"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Award, Zap, FileText, Flame, Pencil, Check, Star, UserRound } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth-provider";
import { getSupabase } from "@/lib/supabase/client";
import { APPROVED_STATUSES, RANKS, KV_EMAILS } from "@/lib/constants";
import { reportDayMs, type ReportRow } from "@/lib/reports";
import { levelFromXp } from "@/lib/level";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Reveal } from "@/components/ui/reveal";
import { VkLinkCard } from "@/components/profile/vk-link-card";

type Career = {
  rank?: string | null;
  nickname?: string | null;
  appointed_at?: string | null;
  rank_started_at?: string | null;
};

function computeStreak(days: number[]): number {
  if (days.length === 0) return 0;
  const uniq = Array.from(new Set(days)).sort((a, b) => b - a);
  const DAY = 86400000;
  const today = Math.floor(Date.now() / DAY);
  let streak = 0;
  let expected = today;
  for (const d of uniq) {
    const dd = Math.floor(d / DAY);
    if (dd === expected || (streak === 0 && dd === expected - 1)) {
      streak += 1;
      expected = dd - 1;
    } else if (dd < expected) {
      break;
    }
  }
  return streak;
}

export function ProfileClient() {
  const { user, xp, roles } = useAuth();
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [career, setCareer] = useState<Career | null>(null);
  const [nickname, setNickname] = useState("");
  const [editingNick, setEditingNick] = useState(false);
  const [nickDraft, setNickDraft] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const supa = getSupabase();
    const email = user.email || "";
    const [repRes, statsRes, careerRes] = await Promise.all([
      supa.from("reports").select("*").eq("email", email),
      supa.from("user_stats").select("nickname").eq("user_id", user.id).maybeSingle(),
      supa.from("moderator_careers").select("*").eq("site_user_id", user.id).maybeSingle(),
    ]);
    setRows(((repRes.data || []) as ReportRow[]).filter((r) => !KV_EMAILS.has(String(r.email))));
    setNickname(String(statsRes.data?.nickname || ""));
    setCareer((careerRes.data as Career) || null);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const saveNick = async () => {
    if (!user || !nickDraft.trim()) return;
    try {
      const { data: sessionData } = await getSupabase().auth.getSession();
      const token = sessionData.session?.access_token;
      const res = await fetch("/api/profile/bootstrap", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: nickDraft.trim() }),
      });
      if (!res.ok) throw new Error("save failed");
      setNickname(nickDraft.trim());
      setEditingNick(false);
      toast.success("Ник обновлён");
    } catch {
      toast.error("Не удалось сохранить ник");
    }
  };

  const stats = useMemo(() => {
    const approved = rows.filter(
      (r) => APPROVED_STATUSES.has(String(r.status)) || (Number(r.xp) || 0) > 0
    );
    const heroDays = rows.filter((r) => r.status === "Герой дня").length;
    const days = approved.map((r) => reportDayMs(r)).filter((t) => t > 0);
    return {
      total: rows.length,
      approved: approved.length,
      heroDays,
      streak: computeStreak(days),
    };
  }, [rows]);

  const lvl = levelFromXp(xp.total);
  const rank = career?.rank ? RANKS[career.rank] : null;
  const displayName = nickname || career?.nickname || user?.email?.split("@")[0] || "Модератор";

  const roleBadges: string[] = [];
  if (roles.isCreator) roleBadges.push("Создатель");
  else if (roles.isLeadership) roleBadges.push("Руководство");
  if (roles.kinds.has("moderator")) roleBadges.push("Модератор");
  if (roles.kinds.has("ap")) roleBadges.push("АП");
  if (roles.kinds.has("fsb")) roleBadges.push("ФСБ");
  if (roles.isApAdmin) roleBadges.push("Рук. АП");
  if (roles.isFsbAdmin) roleBadges.push("Рук. ФСБ");

  return (
    <div className="flex flex-col gap-6">
      {/* Hero профиля */}
      <Reveal i={0}>
        <div className="hero-surface rounded-3xl p-5 md:p-8">
          <div className="flex flex-wrap items-start gap-5">
            <motion.div
              whileHover={{ rotate: -4, scale: 1.04 }}
              className="from-green-bright to-green-deep font-display text-primary-foreground flex size-16 items-center justify-center rounded-2xl bg-linear-to-br text-2xl font-extrabold md:size-[72px]"
            >
              {displayName.slice(0, 1).toUpperCase()}
            </motion.div>
            <div className="min-w-0 flex-1">
              <span className="bg-green-bright/16 text-green-bright mb-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold tracking-[0.14em] uppercase">
                <Star className="size-3" /> {rank?.title || roleBadges[0] || "Модератор"}
              </span>
              <div className="flex flex-wrap items-center gap-2">
                {editingNick ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={nickDraft}
                      onChange={(e) => setNickDraft(e.target.value)}
                      className="text-foreground h-9 w-48 bg-white"
                      placeholder="Новый ник"
                    />
                    <Button size="icon" variant="secondary" onClick={saveNick} aria-label="Сохранить ник">
                      <Check className="size-4" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <h1 className="font-display truncate text-2xl font-extrabold md:text-3xl">
                      {displayName}
                    </h1>
                    <button
                      className="text-on-hero-soft hover:text-on-hero"
                      onClick={() => {
                        setNickDraft(nickname);
                        setEditingNick(true);
                      }}
                      aria-label="Изменить ник"
                    >
                      <Pencil className="size-4" />
                    </button>
                  </>
                )}
              </div>
              <p className="text-on-hero-soft mt-1.5 truncate text-sm">{user?.email}</p>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {roleBadges.map((b) => (
                  <span
                    key={b}
                    className="rounded-full bg-[oklch(0.97_0.01_148/0.12)] px-2.5 py-1 text-xs font-semibold"
                  >
                    {b}
                  </span>
                ))}
              </div>
            </div>
            <div className="text-left sm:ml-auto sm:text-right">
              <div className="font-display text-3xl font-extrabold tabular-nums">
                <span className="text-green-bright">{xp.total}</span>
              </div>
              <div className="text-on-hero-soft text-xs">XP · уровень {lvl.level}</div>
            </div>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-[oklch(0.97_0.01_148/0.1)] md:grid-cols-4">
            {[
              { icon: FileText, v: stats.total, k: "отчётов всего" },
              { icon: Award, v: stats.approved, k: "одобрено" },
              { icon: Zap, v: stats.heroDays, k: "Героев дня" },
              { icon: Flame, v: stats.streak, k: "серия дней" },
            ].map((s) => (
              <div key={s.k} className="hero-cell px-4 py-3.5">
                <div className="font-display text-xl font-semibold tabular-nums">
                  {loading ? "—" : s.v}
                </div>
                <div className="text-on-hero-soft text-xs">{s.k}</div>
              </div>
            ))}
          </div>
        </div>
      </Reveal>

      <div className="grid items-start gap-4 lg:grid-cols-3">
        {/* Прогресс уровня */}
        <Reveal i={1} className="bg-card rounded-2xl border p-5">
          <h3 className="font-display mb-4 flex items-center gap-2 text-sm font-semibold">
            <Zap className="text-amber-deep size-4" /> Прогресс уровня
          </h3>
          <div className="bg-secondary h-[9px] overflow-hidden rounded-full">
            <span
              className="bar-grow from-green to-green-bright block h-full rounded-full bg-linear-to-r"
              style={{ width: `${lvl.progressPct}%` }}
            />
          </div>
          <p className="text-muted-foreground mt-2.5 text-sm">
            {lvl.intoLevel} / {lvl.needed} XP до уровня {lvl.level + 1}
          </p>
          <div className="mt-4 flex flex-col gap-1 text-sm">
            <div className="flex justify-between py-1">
              <span className="text-muted-foreground">XP за отчёты</span>
              <span className="font-display text-xs font-semibold tabular-nums">{xp.reportXp}</span>
            </div>
            <div className="flex justify-between border-t py-1 pt-2">
              <span className="text-muted-foreground">Игры и бонусы</span>
              <span className="font-display text-xs font-semibold tabular-nums">{xp.gameXp}</span>
            </div>
          </div>
        </Reveal>

        {/* Карьера */}
        <Reveal i={2} className="bg-card rounded-2xl border p-5">
          <h3 className="font-display mb-4 flex items-center gap-2 text-sm font-semibold">
            <UserRound className="text-muted-foreground size-4" /> Карьера
          </h3>
          {career?.rank && RANKS[career.rank] ? (
            <div className="flex flex-col gap-1 text-sm">
              <div className="flex justify-between py-1.5">
                <span className="text-muted-foreground">Должность</span>
                <Badge>{RANKS[career.rank].title}</Badge>
              </div>
              {RANKS[career.rank].next && (
                <div className="flex justify-between border-t py-1.5 pt-2.5">
                  <span className="text-muted-foreground">Следующий ранг</span>
                  <span className="font-semibold">{RANKS[career.rank].next}</span>
                </div>
              )}
              {career.rank_started_at && (
                <div className="flex justify-between border-t py-1.5 pt-2.5">
                  <span className="text-muted-foreground">В ранге с</span>
                  <span>{new Date(career.rank_started_at).toLocaleDateString("ru-RU")}</span>
                </div>
              )}
              {career.appointed_at && (
                <div className="flex justify-between border-t py-1.5 pt-2.5">
                  <span className="text-muted-foreground">В команде с</span>
                  <span>{new Date(career.appointed_at).toLocaleDateString("ru-RU")}</span>
                </div>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground py-4 text-center text-sm">
              Карьерная запись не найдена. Обратитесь к руководству.
            </p>
          )}
        </Reveal>

        {/* VK-бот */}
        <Reveal i={3}>
          <VkLinkCard />
        </Reveal>
      </div>
    </div>
  );
}

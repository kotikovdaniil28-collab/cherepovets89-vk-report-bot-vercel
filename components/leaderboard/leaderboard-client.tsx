"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Trophy, Medal, Crown } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { getSupabase } from "@/lib/supabase/client";
import { computeLeaderboard } from "@/lib/xp";
import { levelFromXp } from "@/lib/level";
import { Reveal } from "@/components/ui/reveal";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Entry = {
  email: string;
  nickname: string;
  xp: number;
  rank: number;
};

export function LeaderboardClient() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const supa = getSupabase();
      const [{ byEmail, byUserId }, statsRes] = await Promise.all([
        computeLeaderboard(supa),
        supa.from("user_stats").select("email,nickname,user_id"),
      ]);
      if (!mounted) return;
      const stats = statsRes.data || [];
      const emailByUserId = new Map<string, string>();
      const nickByEmail = new Map<string, string>();
      for (const s of stats) {
        if (s.user_id && s.email) emailByUserId.set(String(s.user_id), String(s.email));
        if (s.email && s.nickname) nickByEmail.set(String(s.email).toLowerCase(), String(s.nickname));
      }
      const total = new Map<string, number>(byEmail);
      for (const [uid, xp] of byUserId) {
        const email = emailByUserId.get(uid);
        if (email) total.set(email, (total.get(email) || 0) + xp);
      }
      const list = Array.from(total.entries())
        .map(([email, xp]) => ({
          email,
          nickname: nickByEmail.get(email.toLowerCase()) || email.split("@")[0],
          xp,
          rank: 0,
        }))
        .filter((e) => e.xp > 0)
        .sort((a, b) => b.xp - a.xp)
        .map((e, i) => ({ ...e, rank: i + 1 }));
      setEntries(list);
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const top3 = entries.slice(0, 3);
  const rest = entries.slice(3);
  const myEmail = (user?.email || "").toLowerCase();

  const podiumIcons = [Crown, Medal, Medal];
  const podiumStyle = [
    "text-chart-4 bg-chart-4/10",
    "text-muted-foreground bg-muted",
    "text-chart-5 bg-chart-5/10",
  ];

  return (
    <div className="flex flex-col gap-6">
      <Reveal>
        {/* Баннер с иллюстрацией трофея */}
        <div className="relative min-h-36 overflow-hidden rounded-2xl border md:min-h-44">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/leaderboard-trophy.png"
            alt=""
            aria-hidden
            className="absolute inset-0 size-full object-cover object-right"
          />
          <div className="absolute inset-0 bg-linear-to-r from-black/80 via-black/40 to-transparent" />
          <div className="relative flex min-h-36 items-center gap-3 p-6 md:min-h-44 md:p-8">
            <span className="bg-chart-4/20 text-chart-4 flex size-10 shrink-0 items-center justify-center rounded-xl backdrop-blur-sm">
              <Trophy className="size-5" />
            </span>
            <div>
              <h1 className="font-display text-xl font-bold tracking-tight text-white md:text-2xl">
                Лидерборд
              </h1>
              <p className="text-sm text-white/70">Рейтинг модераторов по суммарному XP</p>
            </div>
          </div>
        </div>
      </Reveal>

      {loading && (
        <div className="grid gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="bg-card border-border/60 h-40 animate-pulse rounded-2xl border" />
          ))}
        </div>
      )}

      {!loading && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            {top3.map((e, i) => {
              const Icon = podiumIcons[i];
              const lvl = levelFromXp(e.xp);
              const isMe = e.email.toLowerCase() === myEmail;
              return (
                <motion.div
                  key={e.email}
                  initial={{ opacity: 0, y: 24, scale: 0.94 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ delay: i * 0.12, type: "spring", stiffness: 220, damping: 20 }}
                >
                  <div
                    className={cn(
                      "bg-card border-border/60 relative overflow-hidden rounded-2xl border p-5",
                      i === 0 && "border-chart-4/50 shadow-lg"
                    )}
                  >
                    {i === 0 && (
                      <div className="bg-chart-4/10 pointer-events-none absolute -top-10 -right-10 size-32 rounded-full blur-2xl" />
                    )}
                    <div className="flex flex-col items-center gap-2 text-center">
                      <span className={cn("flex size-12 items-center justify-center rounded-2xl", podiumStyle[i])}>
                        <Icon className="size-6" />
                      </span>
                      <span className="text-base font-bold">
                        {e.nickname}
                        {isMe && <span className="text-primary ml-1 text-xs">(вы)</span>}
                      </span>
                      <span className="text-muted-foreground text-xs">Уровень {lvl.level} · #{e.rank}</span>
                      <Badge variant={i === 0 ? "default" : "secondary"} className="tabular-nums">
                        {e.xp} XP
                      </Badge>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>

          <Reveal delay={0.2}>
            <div className="bg-card border-border/60 flex flex-col overflow-hidden rounded-2xl border">
              {rest.map((e, i) => {
                const isMe = e.email.toLowerCase() === myEmail;
                return (
                  <motion.div
                    key={e.email}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: Math.min(i * 0.03, 0.5) }}
                    className={cn(
                      "border-border/40 flex items-center gap-3 border-b px-4 py-3 last:border-0 md:px-5",
                      isMe && "bg-primary/5"
                    )}
                  >
                    <span className="text-muted-foreground w-7 shrink-0 text-right text-sm font-semibold tabular-nums">
                      {e.rank}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">
                      {e.nickname}
                      {isMe && (
                        <Badge variant="outline" className="ml-2">
                          Вы
                        </Badge>
                      )}
                    </span>
                    <span className="text-muted-foreground hidden text-xs sm:block">
                      Ур. {levelFromXp(e.xp).level}
                    </span>
                    <span className="w-20 shrink-0 text-right text-sm font-semibold tabular-nums">
                      {e.xp} XP
                    </span>
                  </motion.div>
                );
              })}
              {entries.length === 0 && (
                <p className="text-muted-foreground py-10 text-center text-sm">Пока нет данных.</p>
              )}
            </div>
          </Reveal>
        </>
      )}
    </div>
  );
}

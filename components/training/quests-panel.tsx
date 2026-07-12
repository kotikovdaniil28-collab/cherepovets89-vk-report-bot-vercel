"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Gift, Target } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth-provider";
import { getSupabase } from "@/lib/supabase/client";
import { addGameXp, hasGameXpNote } from "@/lib/xp";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

// Квесты — 1:1 из legacy (прогресс за текущую сессию, награда — игровой XP)
const QUESTS = [
  { id: "q1", title: "Младший Модератор", desc: "Рассмотреть 50 сообщений в тренажёре", max: 50, source: "mod", reward: 150 },
  { id: "q2", title: "Активный Помощник", desc: "Ответить на 25 вопросов игроков", max: 25, source: "sup", reward: 100 },
  { id: "q3", title: "Детектив", desc: "Вынести вердикт по 15 жалобам", max: 15, source: "comp", reward: 120 },
  { id: "q4", title: "Мастер Своего Дела", desc: "Рассмотреть 200 сообщений в тренажёре", max: 200, source: "mod", reward: 500 },
] as const;

export function QuestsPanel({
  modResolved,
  supResolved,
  compResolved,
}: {
  modResolved: number;
  supResolved: number;
  compResolved: number;
}) {
  const { user, refreshXp } = useAuth();
  const [claimed, setClaimed] = useState<Record<string, boolean>>({});
  const [claiming, setClaiming] = useState<string | null>(null);

  // Проверяем, какие квесты уже получены (награда навсегда одна)
  useEffect(() => {
    if (!user) return;
    let mounted = true;
    (async () => {
      const supa = getSupabase();
      const entries = await Promise.all(
        QUESTS.map(async (q) => [q.id, await hasGameXpNote(supa, user.id, `Квест: ${q.id}`)] as const),
      );
      if (mounted) setClaimed(Object.fromEntries(entries));
    })();
    return () => {
      mounted = false;
    };
  }, [user]);

  const progressOf = (source: string) =>
    source === "mod" ? modResolved : source === "sup" ? supResolved : compResolved;

  const claim = async (q: (typeof QUESTS)[number]) => {
    if (!user || claimed[q.id] || claiming) return;
    setClaiming(q.id);
    try {
      // Двойная защита от повторного клейма
      if (await hasGameXpNote(getSupabase(), user.id, `Квест: ${q.id}`)) {
        setClaimed((c) => ({ ...c, [q.id]: true }));
        return;
      }
      await addGameXp(getSupabase(), user.id, q.reward, `Квест: ${q.id}`);
      setClaimed((c) => ({ ...c, [q.id]: true }));
      await refreshXp();
      toast.success(`+${q.reward} игровых XP за квест «${q.title}»`);
    } catch {
      toast.error("Не удалось получить награду");
    } finally {
      setClaiming(null);
    }
  };

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {QUESTS.map((q, i) => {
        const progress = Math.min(q.max, progressOf(q.source));
        const done = progress >= q.max;
        const got = claimed[q.id];
        return (
          <motion.div
            key={q.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
          >
            <Card className={done && !got ? "border-success" : undefined}>
              <CardContent className="flex flex-col gap-2 p-5">
                <div className="flex items-center justify-between">
                  <h3 className="flex items-center gap-2 text-sm font-semibold">
                    <Target className="text-primary size-4" /> {q.title}
                  </h3>
                  <span className="text-muted-foreground text-xs font-medium">
                    +{q.reward} игровых XP
                  </span>
                </div>
                <p className="text-muted-foreground text-xs text-pretty">{q.desc}</p>
                <Progress value={(progress / q.max) * 100} />
                <div className="flex items-center justify-between">
                  <p className="text-muted-foreground text-xs">
                    {progress} / {q.max}
                  </p>
                  {got ? (
                    <span className="text-muted-foreground text-xs font-semibold">Получено</span>
                  ) : done ? (
                    <Button size="sm" onClick={() => claim(q)} disabled={claiming === q.id}>
                      <Gift className="size-3.5" />
                      {claiming === q.id ? "..." : "Забрать награду"}
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        );
      })}
      <p className="text-muted-foreground col-span-full text-xs">
        Прогресс квестов считается за текущую сессию тренажёров. Награда за каждый квест выдаётся
        один раз.
      </p>
    </div>
  );
}

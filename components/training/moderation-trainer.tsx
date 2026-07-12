"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, TriangleAlert, Hammer } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth-provider";
import { getSupabase } from "@/lib/supabase/client";
import { addGameXp } from "@/lib/xp";
import { MOD_MESSAGES } from "@/lib/data/trainer";
import { RULE_MESSAGES } from "@/lib/data/trainer-rules";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

// Тренажёр чата: как в legacy — 15 XP за каждые 10 правильных решений
const XP_PER_10 = 15;

// Объединённый пул: legacy-сообщения + новые вопросы с привязкой к пунктам правил
type TrainerMessage = { type: string; text: string; rule?: string };
const ALL_MESSAGES: TrainerMessage[] = [...MOD_MESSAGES, ...RULE_MESSAGES];

export function ModerationTrainer({ onResolved }: { onResolved: () => void }) {
  const { user, refreshXp } = useAuth();
  const [current, setCurrent] = useState<TrainerMessage | null>(null);
  const [resolved, setResolved] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const grantedRef = useRef(0);

  const next = useCallback(() => {
    setCurrent(ALL_MESSAGES[Math.floor(Math.random() * ALL_MESSAGES.length)]);
    setFeedback(null);
  }, []);

  useEffect(() => {
    next();
  }, [next]);

  const act = async (action: "good" | "warn" | "ban") => {
    if (!current || feedback) return;
    const ok = current.type === action;
    setResolved((n) => n + 1);
    onResolved();
    if (ok) {
      const newCorrect = correct + 1;
      setCorrect(newCorrect);
      setFeedback({ ok: true, text: current.rule ? `Верно! ${current.rule}` : "Верное решение!" });
      // Начисляем 15 XP за каждые полные 10 правильных
      const earned = Math.floor(newCorrect / 10) * XP_PER_10;
      if (earned > grantedRef.current && user) {
        const delta = earned - grantedRef.current;
        grantedRef.current = earned;
        try {
          await addGameXp(getSupabase(), user.id, delta, "Тренажёр чата");
          await refreshXp();
          toast.success(`+${delta} игровых XP за тренажёр`);
        } catch {
          toast.error("Не удалось начислить XP");
        }
      }
    } else {
      setMistakes((n) => n + 1);
      const expected =
        current.type === "good" ? "сообщение нормальное" : current.type === "warn" ? "нужен пред/мут" : "нужен бан";
      const why = current.rule ? ` ${current.rule}` : "";
      setFeedback({ ok: false, text: `Ошибка: ${expected}.${why}` });
    }
    // Даем больше времени прочитать объяснение при ошибке или наличии пункта правил
    setTimeout(next, !ok || current.rule ? 3200 : 900);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Рассмотрено" value={resolved} />
        <Stat label="Верно" value={correct} />
        <Stat label="Ошибок" value={mistakes} />
      </div>

      <Card>
        <CardContent className="p-6">
          <p className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
            Сообщение в чате
          </p>
          <AnimatePresence mode="wait">
            <motion.p
              key={current?.text}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="min-h-12 text-lg font-medium text-pretty"
            >
              {current?.text}
            </motion.p>
          </AnimatePresence>
          {feedback && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className={`mt-2 text-sm font-semibold ${feedback.ok ? "text-success" : "text-destructive"}`}
            >
              {feedback.text}
            </motion.p>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-3 gap-3">
        <Button variant="outline" onClick={() => act("good")} disabled={!!feedback}>
          <Check className="size-4" /> Пропустить
        </Button>
        <Button variant="secondary" onClick={() => act("warn")} disabled={!!feedback}>
          <TriangleAlert className="size-4" /> Пред / Мут
        </Button>
        <Button variant="destructive" onClick={() => act("ban")} disabled={!!feedback}>
          <Hammer className="size-4" /> Бан
        </Button>
      </div>
      <p className="text-muted-foreground text-xs">
        За каждые 10 правильных решений начисляется {XP_PER_10} XP.
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="border-border bg-card rounded-lg border p-3 text-center">
      <p className="text-xl font-bold">{value}</p>
      <p className="text-muted-foreground text-xs">{label}</p>
    </div>
  );
}

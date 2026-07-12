"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth-provider";
import { getSupabase } from "@/lib/supabase/client";
import { grantApPoints } from "@/lib/shop";
import { SUP_QUESTIONS, type SupQuestion } from "@/lib/data/trainer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

// Тренажёр поддержки: как в legacy — 15 баллов АП за каждые 10 правильных ответов
const PTS_PER_10 = 15;

export function SupportTrainer({ onResolved }: { onResolved: () => void }) {
  const { user } = useAuth();
  const [current, setCurrent] = useState<SupQuestion | null>(null);
  const [answer, setAnswer] = useState("");
  const [resolved, setResolved] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const grantedRef = useRef(0);

  const next = useCallback(() => {
    setCurrent(SUP_QUESTIONS[Math.floor(Math.random() * SUP_QUESTIONS.length)]);
    setAnswer("");
    setFeedback(null);
  }, []);

  useEffect(() => {
    next();
  }, [next]);

  const submit = async () => {
    if (!current || feedback) return;
    const low = answer.trim().toLowerCase();
    if (!low) return;
    // Проверка по ключевым словам — как в legacy
    const ok = current.keywords.some((k) => low.includes(k.toLowerCase()));
    setResolved((n) => n + 1);
    onResolved();
    if (ok) {
      const newCorrect = correct + 1;
      setCorrect(newCorrect);
      setFeedback({ ok: true, text: "Ответ засчитан!" });
      const earned = Math.floor(newCorrect / 10) * PTS_PER_10;
      if (earned > grantedRef.current && user) {
        const delta = earned - grantedRef.current;
        grantedRef.current = earned;
        try {
          await grantApPoints(getSupabase(), user.id, delta, "Тренажёр поддержки");
          toast.success(`+${delta} баллов АП`);
        } catch {
          toast.error("Не удалось начислить баллы");
        }
      }
    } else {
      setMistakes((n) => n + 1);
      setFeedback({ ok: false, text: `Неверно. Подсказка: ${current.keywords[0]}` });
    }
    setTimeout(next, 1200);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Отвечено" value={resolved} />
        <Stat label="Верно" value={correct} />
        <Stat label="Ошибок" value={mistakes} />
      </div>

      <Card>
        <CardContent className="p-6">
          <p className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
            {current?.title || "Вопрос игрока"}
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

      <div className="flex gap-2">
        <Input
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing && e.keyCode !== 229) submit();
          }}
          placeholder="Ваш ответ игроку..."
          disabled={!!feedback}
        />
        <Button onClick={submit} disabled={!!feedback || !answer.trim()}>
          <Send className="size-4" /> Ответить
        </Button>
      </div>
      <p className="text-muted-foreground text-xs">
        За каждые 10 правильных ответов начисляется {PTS_PER_10} баллов АП.
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

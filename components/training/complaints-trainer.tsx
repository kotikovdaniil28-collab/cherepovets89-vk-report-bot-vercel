"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CircleCheck, CircleX, ArrowRightLeft } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth-provider";
import { getSupabase } from "@/lib/supabase/client";
import { addGameXp } from "@/lib/xp";
import { COMPLAINTS } from "@/lib/data/trainer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type Complaint = { text: string; evidence: string; type: string };

// 15 игровых XP за каждые 10 верных вердиктов
const XP_PER_10 = 15;

export function ComplaintsTrainer({ onResolved }: { onResolved: () => void }) {
  const { user, refreshXp } = useAuth();
  const [current, setCurrent] = useState<Complaint | null>(null);
  const [resolved, setResolved] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const grantedRef = useRef(0);

  const next = useCallback(() => {
    setCurrent(COMPLAINTS[Math.floor(Math.random() * COMPLAINTS.length)] as Complaint);
    setFeedback(null);
  }, []);

  useEffect(() => {
    next();
  }, [next]);

  const act = async (action: "approve" | "reject" | "pass") => {
    if (!current || feedback) return;
    const ok = current.type === action;
    setResolved((n) => n + 1);
    onResolved();
    if (ok) {
      const newCorrect = correct + 1;
      setCorrect(newCorrect);
      setFeedback({ ok: true, text: "Верный вердикт!" });
      const earned = Math.floor(newCorrect / 10) * XP_PER_10;
      if (earned > grantedRef.current && user) {
        const delta = earned - grantedRef.current;
        grantedRef.current = earned;
        try {
          await addGameXp(getSupabase(), user.id, delta, "Тренажёр жалоб");
          await refreshXp();
          toast.success(`+${delta} игровых XP за тренажёр`);
        } catch {
          toast.error("Не удалось начислить XP");
        }
      }
    } else {
      setMistakes((n) => n + 1);
      const expected =
        current.type === "approve"
          ? "жалобу нужно одобрить"
          : current.type === "reject"
            ? "жалобу нужно отклонить"
            : "жалобу нужно передать выше";
      setFeedback({ ok: false, text: `Ошибка: ${expected}.` });
    }
    setTimeout(next, 1100);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Рассмотрено" value={resolved} />
        <Stat label="Верно" value={correct} />
        <Stat label="Ошибок" value={mistakes} />
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3 p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={current?.text}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="flex flex-col gap-3"
            >
              <div>
                <p className="text-muted-foreground mb-1 text-xs font-medium uppercase tracking-wide">
                  Жалоба
                </p>
                <p className="text-base font-medium text-pretty">{current?.text}</p>
              </div>
              <div>
                <p className="text-muted-foreground mb-1 text-xs font-medium uppercase tracking-wide">
                  Доказательства
                </p>
                <p className="text-muted-foreground text-sm text-pretty">{current?.evidence}</p>
              </div>
            </motion.div>
          </AnimatePresence>
          {feedback && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className={`text-sm font-semibold ${feedback.ok ? "text-success" : "text-destructive"}`}
            >
              {feedback.text}
            </motion.p>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-3 gap-3">
        <Button variant="outline" onClick={() => act("approve")} disabled={!!feedback}>
          <CircleCheck className="size-4" /> Одобрить
        </Button>
        <Button variant="destructive" onClick={() => act("reject")} disabled={!!feedback}>
          <CircleX className="size-4" /> Отклонить
        </Button>
        <Button variant="secondary" onClick={() => act("pass")} disabled={!!feedback}>
          <ArrowRightLeft className="size-4" /> Передать выше
        </Button>
      </div>
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

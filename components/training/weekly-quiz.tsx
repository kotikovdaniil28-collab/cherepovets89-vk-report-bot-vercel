"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { useAuth } from "@/components/auth-provider";
import { getSupabase } from "@/lib/supabase/client";
import { makeId } from "@/lib/reports";
import { addGameXp } from "@/lib/xp";
import { QUIZZES, type Quiz, type QuizQuestion } from "@/lib/data/quizzes";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

// Викторина недели: ротация по номеру недели, запись WEEKLY_QUIZ_DONE — формат legacy
function getWeekIndex() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const week = Math.floor((now.getTime() - start.getTime()) / (7 * 24 * 3600 * 1000));
  return week % QUIZZES.length;
}

const QUESTIONS_PER_RUN = 5;

export function WeeklyQuiz() {
  const { user } = useAuth();
  const [quiz] = useState<Quiz>(() => QUIZZES[getWeekIndex()]);
  const [played, setPlayed] = useState<boolean | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);
  const [reward, setReward] = useState(0);

  const checkPlayed = useCallback(async () => {
    if (!user) return;
    const supa = getSupabase();
    const who = user.email || user.id;
    const { data } = await supa
      .from("reports")
      .select("id")
      .eq("email", "WEEKLY_QUIZ_DONE")
      .eq("link", who)
      .eq("status", quiz.id)
      .limit(1);
    setPlayed(!!data?.length);
  }, [user, quiz.id]);

  useEffect(() => {
    checkPlayed();
  }, [checkPlayed]);

  const start = () => {
    const shuffled = [...quiz.questions].sort(() => 0.5 - Math.random()).slice(0, QUESTIONS_PER_RUN);
    setQuestions(shuffled);
    setIndex(0);
    setCorrectCount(0);
    setFinished(false);
    setPicked(null);
  };

  const pick = (opt: string) => {
    if (picked) return;
    setPicked(opt);
    const q = questions[index];
    const ok = opt === q.ans;
    if (ok) setCorrectCount((n) => n + 1);
    setTimeout(async () => {
      if (index + 1 < questions.length) {
        setIndex((n) => n + 1);
        setPicked(null);
      } else {
        const finalCorrect = correctCount + (ok ? 1 : 0);
        const rew = finalCorrect === questions.length ? quiz.reward : Math.round((quiz.reward * finalCorrect) / questions.length / 2);
        setReward(rew);
        setFinished(true);
        // Запись в базу — формат legacy: WEEKLY_QUIZ_DONE
        if (user) {
          try {
            const who = user.email || user.id;
            await getSupabase()
              .from("reports")
              .insert([
                {
                  id: makeId("weekly_quiz_done_"),
                  email: "WEEKLY_QUIZ_DONE",
                  link: who,
                  status: quiz.id,
                  date: JSON.stringify({ correct: finalCorrect, total: questions.length, reward: rew }),
                  xp: rew,
                },
              ]);
            // Начисляем награду в кошелёк игрового XP (иначе она нигде не учтётся)
            if (rew > 0) await addGameXp(getSupabase(), user.id, rew, `Викторина: ${quiz.id}`);
            setPlayed(true);
            if (rew > 0) toast.success(`Викторина завершена: +${rew} игровых XP`);
          } catch {
            toast.error("Не удалось сохранить результат");
          }
        }
      }
    }, 800);
  };

  if (played === null) {
    return <p className="text-muted-foreground text-sm">Загрузка...</p>;
  }

  if (played && !finished) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 p-8 text-center">
          <span className="text-4xl" aria-hidden>
            {quiz.icon}
          </span>
          <h3 className="text-lg font-semibold">{quiz.title}</h3>
          <p className="text-muted-foreground text-sm text-pretty">
            Вы уже прошли викторину этой недели. Новая викторина появится на следующей неделе.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (finished) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 p-8 text-center">
          <span className="text-4xl" aria-hidden>
            {correctCount === questions.length ? "🏆" : "🎬"}
          </span>
          <h3 className="text-lg font-semibold">
            Результат: {correctCount} из {questions.length}
          </h3>
          <p className="text-muted-foreground text-sm">
            {reward > 0 ? `Начислено ${reward} XP` : "Награда не начислена"}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!questions.length) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
          <span className="text-4xl" aria-hidden>
            {quiz.icon}
          </span>
          <h3 className="text-lg font-semibold">Викторина недели: {quiz.title}</h3>
          <p className="text-muted-foreground max-w-md text-sm text-pretty">
            {quiz.desc} {QUESTIONS_PER_RUN} вопросов, награда до {quiz.reward} XP. Пройти можно один
            раз.
          </p>
          <Button onClick={start}>Начать викторину</Button>
        </CardContent>
      </Card>
    );
  }

  const q = questions[index];
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Progress value={((index + 1) / questions.length) * 100} className="flex-1" />
        <span className="text-muted-foreground text-xs font-medium">
          {index + 1} / {questions.length}
        </span>
      </div>
      <Card>
        <CardContent className="p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={q.q}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
            >
              <h3 className="mb-4 text-lg font-semibold text-pretty">{q.q}</h3>
              <div className="grid gap-2 sm:grid-cols-2">
                {q.opts.map((opt) => {
                  const isPicked = picked === opt;
                  const isAns = picked && opt === q.ans;
                  return (
                    <Button
                      key={opt}
                      variant={isAns ? "default" : isPicked ? "destructive" : "outline"}
                      className="h-auto justify-start whitespace-normal py-3 text-left"
                      onClick={() => pick(opt)}
                      disabled={!!picked}
                    >
                      {opt}
                    </Button>
                  );
                })}
              </div>
            </motion.div>
          </AnimatePresence>
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

import { useState } from "react";
import { GraduationCap } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ModerationTrainer } from "@/components/training/moderation-trainer";
import { SupportTrainer } from "@/components/training/support-trainer";
import { ComplaintsTrainer } from "@/components/training/complaints-trainer";
import { WeeklyQuiz } from "@/components/training/weekly-quiz";
import { QuestsPanel } from "@/components/training/quests-panel";

export function TrainingClient() {
  // Прогресс тренажёров за текущую сессию (для квестов)
  const [modResolved, setModResolved] = useState(0);
  const [supResolved, setSupResolved] = useState(0);
  const [compResolved, setCompResolved] = useState(0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <span className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-xl">
          <GraduationCap className="size-5" />
        </span>
        <div>
          <h1 className="font-display text-xl font-bold tracking-tight md:text-2xl">Обучение</h1>
          <p className="text-muted-foreground text-sm">
            Тренажёры, викторина недели и квесты — XP за правильные решения
          </p>
        </div>
      </div>

      <Tabs defaultValue="moderation">
        <TabsList className="h-auto w-full flex-wrap justify-start sm:w-auto">
          <TabsTrigger value="moderation">Тренажёр чата</TabsTrigger>
          <TabsTrigger value="support">Поддержка</TabsTrigger>
          <TabsTrigger value="complaints">Жалобы</TabsTrigger>
          <TabsTrigger value="quiz">Викторина недели</TabsTrigger>
          <TabsTrigger value="quests">Квесты</TabsTrigger>
        </TabsList>
        <TabsContent value="moderation" className="mt-4">
          <ModerationTrainer onResolved={() => setModResolved((n) => n + 1)} />
        </TabsContent>
        <TabsContent value="support" className="mt-4">
          <SupportTrainer onResolved={() => setSupResolved((n) => n + 1)} />
        </TabsContent>
        <TabsContent value="complaints" className="mt-4">
          <ComplaintsTrainer onResolved={() => setCompResolved((n) => n + 1)} />
        </TabsContent>
        <TabsContent value="quiz" className="mt-4">
          <WeeklyQuiz />
        </TabsContent>
        <TabsContent value="quests" className="mt-4">
          <QuestsPanel modResolved={modResolved} supResolved={supResolved} compResolved={compResolved} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

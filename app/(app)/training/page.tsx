import type { Metadata } from "next";
import { TrainingClient } from "@/components/training/training-client";

export const metadata: Metadata = {
  title: "Обучение — CHEREPOVETS Moderation",
  description: "Тренажёры модерации, поддержки и жалоб, викторины и квесты",
};

export default function TrainingPage() {
  return <TrainingClient />;
}

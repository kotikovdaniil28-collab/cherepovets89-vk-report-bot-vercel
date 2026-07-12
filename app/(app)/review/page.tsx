import type { Metadata } from "next";
import { ReviewClient } from "@/components/review/review-client";

export const metadata: Metadata = {
  title: "Проверка отчётов — CHEREPOVETS Moderation",
};

export default function ReviewPage() {
  return <ReviewClient />;
}

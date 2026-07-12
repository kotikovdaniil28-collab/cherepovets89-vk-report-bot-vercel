import type { Metadata } from "next";
import { GamesClient } from "@/components/games/games-client";

export const metadata: Metadata = {
  title: "Игры — CHEREPOVETS Moderation",
};

export default function GamesPage() {
  return <GamesClient />;
}

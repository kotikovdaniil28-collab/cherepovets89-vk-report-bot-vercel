import type { Metadata } from "next";
import { HelpClient } from "@/components/help/help-client";

export const metadata: Metadata = {
  title: "Инструкция — CHEREPOVETS Moderation",
};

export default function HelpPage() {
  return <HelpClient />;
}

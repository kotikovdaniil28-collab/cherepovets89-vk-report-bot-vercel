import type { Metadata } from "next";
import { InactivesClient } from "@/components/inactives/inactives-client";

export const metadata: Metadata = {
  title: "Неактивы — CHEREPOVETS Moderation",
};

export default function InactivesPage() {
  return <InactivesClient />;
}

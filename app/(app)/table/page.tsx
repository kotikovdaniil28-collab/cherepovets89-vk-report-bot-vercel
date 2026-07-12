import type { Metadata } from "next";
import { TableClient } from "@/components/table/table-client";

export const metadata: Metadata = {
  title: "Таблица отчётов — CHEREPOVETS Moderation",
};

export default function TablePage() {
  return <TableClient />;
}

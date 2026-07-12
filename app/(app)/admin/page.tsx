import type { Metadata } from "next";
import { AdminClient } from "@/components/admin/admin-client";

export const metadata: Metadata = {
  title: "Администрирование — CHEREPOVETS Moderation",
};

export default function AdminPage() {
  return <AdminClient />;
}

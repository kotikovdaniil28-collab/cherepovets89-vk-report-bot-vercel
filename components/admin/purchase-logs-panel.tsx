"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { PackageCheck, PackageOpen } from "lucide-react";
import { toast } from "sonner";
import { getSupabase } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type LogRow = {
  id: string;
  user_email: string;
  nickname: string;
  item_name: string;
  cost: number;
  type: string;
  status: string;
  created_at: string;
};

function LogList({ type }: { type: "mod_shop" | "ap_shop" }) {
  const [rows, setRows] = useState<LogRow[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supa = getSupabase();
    const { data } = await supa
      .from("admin_logs")
      .select("*")
      .eq("type", type)
      .order("created_at", { ascending: false })
      .limit(200);
    setRows((data || []) as LogRow[]);
  }, [type]);

  useEffect(() => {
    load();
  }, [load]);

  const markIssued = async (id: string) => {
    setBusy(id);
    try {
      const supa = getSupabase();
      const { error } = await supa.from("admin_logs").update({ status: "Выдано" }).eq("id", id);
      if (error) throw error;
      setRows((r) => r.map((x) => (x.id === id ? { ...x, status: "Выдано" } : x)));
      toast.success("Отмечено как выдано");
    } catch {
      toast.error("Не удалось обновить статус");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {rows.map((r, i) => {
        const issued = r.status === "Выдано" || r.status === "Автоматически зачислено";
        return (
          <motion.div
            key={r.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i * 0.02, 0.3) }}
          >
            <Card>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <div className="text-sm font-semibold">{r.item_name}</div>
                  <div className="text-muted-foreground text-xs">
                    {r.nickname} · {r.cost} {type === "ap_shop" ? "баллов" : "XP"} ·{" "}
                    {r.created_at ? new Date(r.created_at).toLocaleString("ru-RU") : ""}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={issued ? "secondary" : "default"}>{r.status}</Badge>
                  {!issued && (
                    <Button size="sm" disabled={busy === r.id} onClick={() => markIssued(r.id)}>
                      <PackageCheck className="size-4" /> Выдано
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        );
      })}
      {rows.length === 0 && (
        <div className="text-muted-foreground flex flex-col items-center gap-2 py-12 text-center text-sm">
          <PackageOpen className="size-8" />
          Покупок пока нет
        </div>
      )}
    </div>
  );
}

export function PurchaseLogsPanel() {
  return (
    <Tabs defaultValue="mod_shop">
      <TabsList>
        <TabsTrigger value="mod_shop">Магазин модерации</TabsTrigger>
        <TabsTrigger value="ap_shop">Магазин АП</TabsTrigger>
      </TabsList>
      <TabsContent value="mod_shop">
        <LogList type="mod_shop" />
      </TabsContent>
      <TabsContent value="ap_shop">
        <LogList type="ap_shop" />
      </TabsContent>
    </Tabs>
  );
}

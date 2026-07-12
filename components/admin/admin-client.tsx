"use client";

import { ShieldCheck } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { isAnyAdmin } from "@/lib/roles";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UsersPanel } from "@/components/admin/users-panel";
import { PurchaseLogsPanel } from "@/components/admin/purchase-logs-panel";
import { ShopEditorPanel } from "@/components/admin/shop-editor-panel";
import { InstructionEditorPanel } from "@/components/admin/instruction-editor-panel";
import { AiSettingsPanel } from "@/components/admin/ai-settings-panel";

export function AdminClient() {
  const { roles, loading } = useAuth();

  if (loading) return null;
  if (!isAnyAdmin(roles)) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-24 text-center">
        <ShieldCheck className="text-muted-foreground size-10" />
        <h1 className="text-lg font-semibold">Доступ ограничен</h1>
        <p className="text-muted-foreground text-sm">Этот раздел доступен только руководству.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <span className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-xl">
          <ShieldCheck className="size-5" />
        </span>
        <div>
          <h1 className="font-display text-xl font-bold tracking-tight md:text-2xl">
            Администрирование
          </h1>
          <p className="text-muted-foreground text-sm">
            Пользователи, роли, выдача покупок, товары и инструкции
          </p>
        </div>
      </div>

      <Tabs defaultValue="users">
        <TabsList className="h-auto w-full flex-wrap justify-start sm:w-auto">
          <TabsTrigger value="users">Пользователи</TabsTrigger>
          <TabsTrigger value="purchases">Покупки</TabsTrigger>
          <TabsTrigger value="shop">Товары</TabsTrigger>
          {(roles.isCreator || roles.isLeadership) && (
            <TabsTrigger value="instructions">Инструкции</TabsTrigger>
          )}
          {(roles.isCreator || roles.isLeadership) && <TabsTrigger value="ai">AI (API-ключ)</TabsTrigger>}
        </TabsList>
        <TabsContent value="users">
          <UsersPanel />
        </TabsContent>
        <TabsContent value="purchases">
          <PurchaseLogsPanel />
        </TabsContent>
        <TabsContent value="shop">
          <ShopEditorPanel />
        </TabsContent>
        {(roles.isCreator || roles.isLeadership) && (
          <TabsContent value="instructions">
            <InstructionEditorPanel />
          </TabsContent>
        )}
        {(roles.isCreator || roles.isLeadership) && (
          <TabsContent value="ai">
            <AiSettingsPanel />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

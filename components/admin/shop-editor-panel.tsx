"use client";

import { useCallback, useEffect, useState } from "react";
import { Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import { getSupabase } from "@/lib/supabase/client";
import { KV } from "@/lib/constants";
import { makeId } from "@/lib/reports";
import { loadCustomShop, type ShopItem } from "@/lib/shop";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function CustomShopEditor({ sentinel, currency }: { sentinel: string; currency: string }) {
  const [items, setItems] = useState<ShopItem[]>([]);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [price, setPrice] = useState("");
  const [icon, setIcon] = useState("🎁");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setItems(await loadCustomShop(getSupabase(), sentinel));
  }, [sentinel]);

  useEffect(() => {
    load();
  }, [load]);

  const add = async () => {
    const p = Number(price);
    if (!title.trim() || !Number.isFinite(p) || p <= 0) {
      toast.error("Заполните название и цену");
      return;
    }
    setBusy(true);
    try {
      const supa = getSupabase();
      // Формат legacy: { date: title, status: desc, xp: price, link: icon }
      const { error } = await supa.from("reports").insert([
        {
          id: makeId("shop_"),
          email: sentinel,
          date: title.trim(),
          status: desc.trim(),
          xp: p,
          link: icon.trim() || "🎁",
        },
      ]);
      if (error) throw error;
      setTitle("");
      setDesc("");
      setPrice("");
      await load();
      toast.success("Товар добавлен");
    } catch {
      toast.error("Ошибка добавления товара");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    setBusy(true);
    try {
      const supa = getSupabase();
      const { error } = await supa.from("reports").delete().eq("email", sentinel).eq("id", id);
      if (error) throw error;
      setItems((arr) => arr.filter((i) => i.id !== id));
      toast.success("Товар удалён");
    } catch {
      toast.error("Ошибка удаления");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Добавить товар</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${sentinel}-title`}>Название</Label>
            <Input id={`${sentinel}-title`} value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${sentinel}-desc`}>Описание</Label>
            <Input id={`${sentinel}-desc`} value={desc} onChange={(e) => setDesc(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${sentinel}-price`}>{`Цена (${currency})`}</Label>
              <Input
                id={`${sentinel}-price`}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                inputMode="numeric"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${sentinel}-icon`}>Иконка</Label>
              <Input id={`${sentinel}-icon`} value={icon} onChange={(e) => setIcon(e.target.value)} />
            </div>
          </div>
          <Button onClick={add} disabled={busy}>
            <Plus className="size-4" /> Добавить
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Кастомные товары</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {items.map((i) => (
            <div key={i.id} className="flex items-center justify-between gap-2 rounded-md border p-3">
              <div className="flex min-w-0 items-center gap-2">
                <span aria-hidden>{i.icon}</span>
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{i.title}</div>
                  <div className="text-muted-foreground truncate text-xs">
                    {i.price} {currency}
                    {i.desc ? ` · ${i.desc}` : ""}
                  </div>
                </div>
              </div>
              <Button size="icon" variant="ghost" onClick={() => remove(i.id)} disabled={busy}>
                <Trash2 className="size-4" />
                <span className="sr-only">Удалить товар</span>
              </Button>
            </div>
          ))}
          {items.length === 0 && (
            <p className="text-muted-foreground py-6 text-center text-sm">Кастомных товаров нет</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function ShopEditorPanel() {
  return (
    <Tabs defaultValue="mod">
      <TabsList>
        <TabsTrigger value="mod">Магазин модерации</TabsTrigger>
        <TabsTrigger value="ap">Магазин АП</TabsTrigger>
      </TabsList>
      <TabsContent value="mod">
        <CustomShopEditor sentinel={KV.SHOP_MOD} currency="XP" />
      </TabsContent>
      <TabsContent value="ap">
        <CustomShopEditor sentinel={KV.SHOP_AP} currency="баллов" />
      </TabsContent>
    </Tabs>
  );
}

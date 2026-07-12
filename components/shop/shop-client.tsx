"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ShoppingBag, Zap, Coins, ShieldHalf } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth-provider";
import { getSupabase } from "@/lib/supabase/client";
import { KV } from "@/lib/constants";
import {
  DEFAULT_MOD_SHOP,
  DEFAULT_AP_SHOP,
  DEFAULT_FSB_SHOP,
  loadCustomShop,
  loadPriceOverrides,
  spendModXp,
  computeApPoints,
  spendApPoints,
  computeFsbPoints,
  spendFsbPoints,
  logPurchase,
  type ShopItem,
} from "@/lib/shop";
import { Reveal } from "@/components/ui/reveal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function ItemCard({
  item,
  balance,
  onBuy,
  busy,
  currency,
  index,
}: {
  item: ShopItem;
  balance: number;
  onBuy: (item: ShopItem) => void;
  busy: boolean;
  currency: string;
  index: number;
}) {
  const affordable = balance >= item.price;
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0, transition: { delay: Math.min(index * 0.05, 0.4) } }}
      layout
      whileHover={{ y: -3 }}
    >
      <div className="bg-card border-border/60 hover:border-primary/40 flex h-full flex-col gap-3 rounded-2xl border p-4 transition-colors md:p-5">
        <div className="flex items-start justify-between">
          <span
            aria-hidden
            className="bg-primary/10 flex size-11 items-center justify-center rounded-xl text-2xl"
          >
            {item.icon}
          </span>
          {item.custom && <Badge variant="secondary">Особый</Badge>}
        </div>
        <div className="flex flex-1 flex-col gap-1">
          <h3 className="text-sm font-semibold text-pretty">{item.title}</h3>
          <p className="text-muted-foreground text-xs leading-relaxed">{item.desc}</p>
        </div>
        <Button
          size="sm"
          variant={affordable ? "default" : "outline"}
          disabled={!affordable || busy}
          onClick={() => onBuy(item)}
          className="tabular-nums"
        >
          {item.price} {currency}
        </Button>
      </div>
    </motion.div>
  );
}

export function ShopClient() {
  const { user, roles, xp, refreshXp } = useAuth();
  const [modItems, setModItems] = useState<ShopItem[]>(DEFAULT_MOD_SHOP);
  const [apItems, setApItems] = useState<ShopItem[]>(DEFAULT_AP_SHOP);
  const [fsbItems] = useState<ShopItem[]>(DEFAULT_FSB_SHOP);
  const [apPoints, setApPoints] = useState(0);
  const [fsbPoints, setFsbPoints] = useState(0);
  const [nickname, setNickname] = useState("");
  const [busy, setBusy] = useState(false);

  const showAp = roles.kinds.has("ap") || roles.isApAdmin || roles.isCreator;
  const showFsb = roles.kinds.has("fsb") || roles.isFsbAdmin || roles.isCreator;

  const load = useCallback(async () => {
    if (!user) return;
    const supa = getSupabase();
    const [customMod, customAp, overrides, ap, fsb, nickRes] = await Promise.all([
      loadCustomShop(supa, KV.SHOP_MOD),
      loadCustomShop(supa, KV.SHOP_AP),
      loadPriceOverrides(supa),
      computeApPoints(supa, user.id),
      computeFsbPoints(supa, user.id),
      supa.from("user_stats").select("nickname").eq("user_id", user.id).maybeSingle(),
    ]);
    const fetchedNick = nickRes.data?.nickname;
    if (fetchedNick) setNickname(String(fetchedNick));
    const withOverrides = (items: ShopItem[]) =>
      items.map((i) => (overrides.has(i.id) ? { ...i, price: overrides.get(i.id)! } : i));
    setModItems(withOverrides([...DEFAULT_MOD_SHOP, ...customMod]));
    setApItems(withOverrides([...DEFAULT_AP_SHOP, ...customAp]));
    setApPoints(ap);
    setFsbPoints(fsb);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const buy = async (item: ShopItem, kind: "mod" | "ap" | "fsb") => {
    if (!user) return;
    setBusy(true);
    try {
      const supa = getSupabase();
      const note = `Покупка: ${item.title}`;
      if (kind === "mod") {
        await spendModXp(supa, user.id, item.price, note);
        await refreshXp();
      } else if (kind === "ap") {
        await spendApPoints(supa, user.id, item.price, note);
        setApPoints((p) => p - item.price);
      } else {
        await spendFsbPoints(supa, user.id, item.price, note);
        setFsbPoints((p) => p - item.price);
      }
      await logPurchase(supa, {
        userEmail: user.email || "",
        nickname: nickname || user.email || "",
        itemName: item.title,
        cost: item.price,
        kind,
      });
      toast.success(`Куплено: ${item.title}. Сообщите руководству для выдачи.`);
    } catch {
      toast.error("Не удалось совершить покупку");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <Reveal>
        {/* Баннер с сундуком сокровищ */}
        <div className="relative min-h-36 overflow-hidden rounded-2xl border md:min-h-44">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/shop-vault.png"
            alt=""
            aria-hidden
            className="absolute inset-0 size-full object-cover object-right"
          />
          <div className="absolute inset-0 bg-linear-to-r from-black/80 via-black/40 to-transparent" />
          <div className="relative flex min-h-36 items-center gap-3 p-6 md:min-h-44 md:p-8">
            <span className="bg-primary/20 text-primary flex size-10 shrink-0 items-center justify-center rounded-xl backdrop-blur-sm">
              <ShoppingBag className="size-5" />
            </span>
            <div>
              <h1 className="font-display text-xl font-bold tracking-tight text-white md:text-2xl">
                Магазин
              </h1>
              <p className="text-sm text-white/70">
                Покупки за XP и баллы — предмет выдаёт руководство
              </p>
            </div>
          </div>
        </div>
      </Reveal>

      <Reveal delay={0.05}>
        <Tabs defaultValue="mod">
          <TabsList className="w-full justify-start overflow-x-auto sm:w-auto">
            <TabsTrigger value="mod">
              <Zap className="size-4" /> Модерация · {xp.modXp} XP
            </TabsTrigger>
            {showAp && (
              <TabsTrigger value="ap">
                <Coins className="size-4" /> АП · {apPoints} баллов
              </TabsTrigger>
            )}
            {showFsb && (
              <TabsTrigger value="fsb">
                <ShieldHalf className="size-4" /> ФСБ · {fsbPoints} баллов
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="mod">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {modItems.map((item, i) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  index={i}
                  balance={xp.modXp}
                  busy={busy}
                  currency="XP"
                  onBuy={(it) => buy(it, "mod")}
                />
              ))}
            </div>
          </TabsContent>

          {showAp && (
            <TabsContent value="ap">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {apItems.map((item, i) => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    index={i}
                    balance={apPoints}
                    busy={busy}
                    currency="��аллов"
                    onBuy={(it) => buy(it, "ap")}
                  />
                ))}
              </div>
            </TabsContent>
          )}

          {showFsb && (
            <TabsContent value="fsb">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {fsbItems.map((item, i) => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    index={i}
                    balance={fsbPoints}
                    busy={busy}
                    currency="баллов"
                    onBuy={(it) => buy(it, "fsb")}
                  />
                ))}
              </div>
            </TabsContent>
          )}
        </Tabs>
      </Reveal>
    </div>
  );
}

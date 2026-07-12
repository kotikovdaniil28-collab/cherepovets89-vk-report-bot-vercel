"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link2, Unlink, Copy, Check, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth-provider";
import { getSupabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

/**
 * Привязка VK-бота через одноразовый код (перенос логики со старого сайта):
 * 1. Сайт создаёт код в vk_link_codes (действует 15 минут)
 * 2. Пользователь отправляет боту: /привязать код XXXXXX
 * 3. Бот записывает связь в vk_links
 */
export function VkLinkCard() {
  const { user } = useAuth();
  const [linked, setLinked] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [checking, setChecking] = useState(true);

  const checkLink = useCallback(async () => {
    if (!user) return;
    const { data } = await getSupabase()
      .from("vk_links")
      .select("vk_user_id")
      .eq("site_user_id", user.id)
      .maybeSingle();
    setLinked(data?.vk_user_id ? String(data.vk_user_id) : null);
    setChecking(false);
  }, [user]);

  useEffect(() => {
    checkLink();
  }, [checkLink]);

  const createCode = async () => {
    if (!user) return;
    setCreating(true);
    try {
      const supa = getSupabase();
      const newCode = String(Math.floor(100000 + Math.random() * 900000));
      const { data: statsData } = await supa
        .from("user_stats")
        .select("nickname")
        .eq("user_id", user.id)
        .maybeSingle();
      const { error } = await supa.from("vk_link_codes").insert([
        {
          code: newCode,
          site_user_id: user.id,
          email: user.email || "",
          nickname: statsData?.nickname || user.email?.split("@")[0] || null,
          status: "pending",
          expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        },
      ]);
      if (error) throw error;
      setCode(newCode);
      toast.success("Код создан — отправь его боту в VK");
    } catch {
      toast.error("Не удалось создать код привязки");
    } finally {
      setCreating(false);
    }
  };

  const command = code ? `/привязать код ${code}` : "";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Команда скопирована");
    } catch {
      toast.error("Не удалось скопировать");
    }
  };

  return (
    <div className="bg-card rounded-2xl border p-5">
      <h3 className="font-display mb-1 flex items-center gap-2 text-sm font-semibold">
        <MessageCircle className="text-blue size-4" /> VK-бот
      </h3>
      <p className="text-muted-foreground mb-4 text-sm leading-relaxed">
        {linked
          ? "Аккаунт привязан — вердикты по отчётам приходят в VK."
          : "Привяжи VK, чтобы получать вердикты по отчётам от бота."}
      </p>

      {checking ? (
        <div className="bg-secondary h-11 animate-pulse rounded-xl" />
      ) : linked ? (
        <div className="flex flex-col gap-3">
          <div className="bg-green/10 text-green-deep flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-semibold">
            <Check className="size-4" /> VK id{linked}
          </div>
          <p className="text-muted-foreground text-xs">
            Чтобы отвязать, отправь боту команду{" "}
            <code className="bg-secondary rounded px-1.5 py-0.5 font-mono">/отвязать</code> и обнови
            страницу.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <AnimatePresence mode="wait">
            {code ? (
              <motion.div
                key="code"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col gap-2.5"
              >
                <div className="border-blue/40 bg-blue/10 flex items-center justify-between gap-2 rounded-xl border px-4 py-3">
                  <span className="font-display text-lg font-bold tracking-[0.12em] tabular-nums">
                    {code}
                  </span>
                  <Button size="sm" variant="ghost" onClick={copy} aria-label="Скопировать команду">
                    {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                  </Button>
                </div>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  Отправь VK-боту команду{" "}
                  <code className="bg-secondary rounded px-1.5 py-0.5 font-mono">{command}</code>.
                  Код действует 15 минут. После привязки обнови страницу.
                </p>
                <Button variant="outline" size="sm" onClick={checkLink}>
                  Проверить привязку
                </Button>
              </motion.div>
            ) : (
              <motion.div key="btn" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <Button className="w-full gap-2" onClick={createCode} disabled={creating}>
                  <Link2 className="size-4" />
                  {creating ? "Создаю код..." : "Создать код привязки"}
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {linked && (
        <button
          onClick={checkLink}
          className="text-muted-foreground hover:text-foreground mt-3 inline-flex items-center gap-1.5 text-xs font-semibold"
        >
          <Unlink className="size-3" /> Обновить статус
        </button>
      )}
    </div>
  );
}

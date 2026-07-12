"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText,
  Link2,
  Trash2,
  ExternalLink,
  Send,
  CheckCircle2,
  Clock,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth-provider";
import { getSupabase } from "@/lib/supabase/client";
import { KV_EMAILS, REJECT_REASONS } from "@/lib/constants";
import { makeId, parseReportPayload, serializeReportPayload, type ReportRow } from "@/lib/reports";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Reveal, SecHead } from "@/components/ui/reveal";
import { cn } from "@/lib/utils";

function todayIso() {
  const d = new Date();
  const msk = new Date(d.toLocaleString("en-US", { timeZone: "Europe/Moscow" }));
  const y = msk.getFullYear();
  const m = String(msk.getMonth() + 1).padStart(2, "0");
  const day = String(msk.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Цветные теги статусов как в макете */
export function statusTagClass(status: string | null | undefined, xpVal: number) {
  const pending = !status || status === "pending" || status === "На проверке";
  if (pending) return "bg-amber/20 text-amber-deep";
  if (status === "Герой дня") return "bg-amber/25 text-amber-deep";
  if (status === "Перенорма") return "bg-green/18 text-green-deep";
  if (status === "Норма") return "bg-secondary text-secondary-foreground";
  if (status === "Натяг") return "bg-blue/15 text-blue";
  if (xpVal > 0) return "bg-green/18 text-green-deep";
  return "bg-red/13 text-red";
}

export function ReportsClient() {
  const { user, refreshXp } = useAuth();
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [nick, setNick] = useState("");
  const [day, setDay] = useState(todayIso());
  const [work, setWork] = useState("");
  const [quality, setQuality] = useState("Норма");
  const [proofLinks, setProofLinks] = useState<string[]>([""]);

  const load = useCallback(async () => {
    if (!user?.email) return;
    setLoading(true);
    const supa = getSupabase();
    const [repRes, nickRes] = await Promise.all([
      // В таблице reports нет created_at — сортируем по id (в нём таймстамп)
      supa.from("reports").select("*").eq("email", user.email).order("id", { ascending: false }),
      supa.from("user_stats").select("nickname").eq("email", user.email).maybeSingle(),
    ]);
    const data = ((repRes.data || []) as ReportRow[]).filter((r) => !KV_EMAILS.has(String(r.email)));
    setRows(data);
    const fetchedNick = nickRes.data?.nickname;
    if (fetchedNick) setNick((n) => n || String(fetchedNick));
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user?.email) return;
    const cleanProofs = proofLinks.map((s) => s.trim()).filter(Boolean);
    if (!nick.trim() || !work.trim()) {
      toast.error("Заполните ник и описание работы");
      return;
    }
    setSaving(true);
    try {
      const supa = getSupabase();
      const reportId = makeId("rep_site_");
      const payload = serializeReportPayload({
        nick: nick.trim(),
        day,
        work: work.trim(),
        quality,
        proofs: cleanProofs,
        userId: user.id,
        email: user.email,
      });
      // Статус "На проверке" — так его видит и VK-бот (/отчёты, вердикты в STAFF)
      const { error } = await supa.from("reports").insert([
        {
          id: reportId,
          email: user.email,
          link: cleanProofs[0] || "",
          date: payload,
          status: "На проверке",
          xp: 0,
        },
      ]);
      if (error) throw error;
      // Аудит-строка для бота: карточка вердикта, уведомления в ЛС VK
      await supa.from("moderator_report_reviews").upsert(
        {
          report_id: reportId,
          site_user_id: user.id,
          email: user.email,
          requested_status: quality,
          final_status: null,
          xp: 0,
          verdict: "pending",
          source: "site",
          notification_status: "waiting",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "report_id" },
      );
      toast.success("Отчёт отправлен на проверку");
      setWork("");
      setProofLinks([""]);
      setDay(todayIso());
      await load();
      await refreshXp();
    } catch (err) {
      toast.error("Не удалось отправить отчёт");
      console.log("[v0] submit report error:", err);
    } finally {
      setSaving(false);
    }
  };

  const removeReport = async (id: string) => {
    if (!user?.email) return;
    const supa = getSupabase();
    const { error } = await supa.from("reports").delete().eq("id", id).eq("email", user.email);
    if (error) {
      toast.error("Не удалось удалить");
      return;
    }
    toast.success("Отчёт удалён");
    setRows((r) => r.filter((x) => x.id !== id));
  };

  const stats = useMemo(() => {
    const pending = rows.filter((r) => !r.status || r.status === "pending" || r.status === "На проверке");
    const approved = rows.filter((r) => (Number(r.xp) || 0) > 0);
    const rejected = rows.filter(
      (r) => r.status && r.status !== "pending" && r.status !== "На проверке" && (Number(r.xp) || 0) === 0
    );
    return { pending: pending.length, approved: approved.length, rejected: rejected.length };
  }, [rows]);

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[1fr_1.1fr]">
      {/* Форма сдачи */}
      <div>
        <Reveal i={0}>
          <SecHead title="Сдать отчёт" hint="вердикт выносит руководство" />
        </Reveal>
        <Reveal i={1}>
          <form onSubmit={submit} className="bg-card flex flex-col gap-4 rounded-2xl border p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="rep-nick">Игровой ник</Label>
                <Input
                  id="rep-nick"
                  value={nick}
                  onChange={(e) => setNick(e.target.value)}
                  placeholder="Nick_Name"
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="rep-day">Дата</Label>
                <Input id="rep-day" type="date" value={day} onChange={(e) => setDay(e.target.value)} required />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rep-work">Что делал</Label>
              <Textarea
                id="rep-work"
                value={work}
                onChange={(e) => setWork(e.target.value)}
                placeholder="Рейд по чату, разбор жалоб, помощь пользователям. Чем конкретнее — тем выше шанс на Перенорму."
                rows={5}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Тип сдачи</Label>
              <div className="grid grid-cols-2 gap-2">
                {["Норма", "Перенорма", "Натяг", "Герой дня"].map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setQuality(q)}
                    className={cn(
                      "rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors",
                      quality === q
                        ? "border-primary bg-primary/10 text-primary"
                        : "bg-card text-muted-foreground hover:border-primary/40",
                    )}
                  >
                    {q}
                  </button>
                ))}
              </div>
              <p className="text-muted-foreground text-xs">
                На какой статус претендуешь — финальное решение за руководством
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>
                Доказательства <span className="text-muted-foreground font-normal">· ссылки</span>
              </Label>
              {proofLinks.map((p, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    value={p}
                    onChange={(e) =>
                      setProofLinks((arr) => arr.map((x, j) => (j === i ? e.target.value : x)))
                    }
                    placeholder="https://imgur.com/..."
                  />
                  {proofLinks.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setProofLinks((arr) => arr.filter((_, j) => j !== i))}
                      aria-label="Удалить ссылку"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="self-start"
                onClick={() => setProofLinks((arr) => [...arr, ""])}
              >
                <Link2 className="size-4" /> Добавить ссылку
              </Button>
            </div>
            <motion.div whileTap={{ scale: 0.985 }}>
              <Button type="submit" disabled={saving} className="h-11 w-full gap-2 text-sm font-bold">
                <Send className="size-4" />
                {saving ? "Отправка..." : "Отправить отчёт"}
              </Button>
            </motion.div>
          </form>
        </Reveal>

        {/* Мини-статистика */}
        <Reveal i={2} className="mt-4 grid grid-cols-3 gap-3">
          {[
            { icon: Clock, v: stats.pending, k: "на проверке", cls: "bg-amber/20 text-amber-deep" },
            { icon: CheckCircle2, v: stats.approved, k: "одобрено", cls: "bg-green/15 text-green-deep" },
            { icon: XCircle, v: stats.rejected, k: "отклонено", cls: "bg-red/13 text-red" },
          ].map((t) => (
            <div key={t.k} className="bg-card rounded-2xl border p-3.5">
              <span className={cn("mb-2.5 flex size-7 items-center justify-center rounded-lg", t.cls)}>
                <t.icon className="size-3.5" />
              </span>
              <div className="font-display text-xl font-semibold tabular-nums">
                {loading ? "—" : t.v}
              </div>
              <div className="text-muted-foreground text-[11px]">{t.k}</div>
            </div>
          ))}
        </Reveal>
      </div>

      {/* Список моих отчётов */}
      <div>
        <Reveal i={1}>
          <SecHead title="Мои отчёты" hint={`всего: ${rows.length}`} />
        </Reveal>
        <div className="flex flex-col gap-3">
          {loading && (
            <div className="flex flex-col gap-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="bg-card h-28 animate-pulse rounded-2xl border" />
              ))}
            </div>
          )}
          {!loading && rows.length === 0 && (
            <Reveal i={2} className="bg-card flex flex-col items-center gap-3 rounded-2xl border py-12">
              <FileText className="text-muted-foreground size-10" />
              <p className="text-muted-foreground text-sm">Пока нет отчётов — сдай первый</p>
            </Reveal>
          )}
          <AnimatePresence>
            {rows.map((r, i) => {
              const p = parseReportPayload(r);
              const pending = !r.status || r.status === "pending" || r.status === "На проверке";
              const ok = (Number(r.xp) || 0) > 0;
              const reason = String((p.json.reject_reason as string) || "");
              return (
                <motion.div
                  key={r.id}
                  layout
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0, transition: { delay: Math.min(i * 0.05, 0.4) } }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  className="bg-card rounded-2xl border p-4 transition-shadow hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold">{p.day}</div>
                      <div className="text-muted-foreground text-xs">{p.nick}</div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-1 text-[11px] font-bold whitespace-nowrap",
                          statusTagClass(r.status, Number(r.xp) || 0)
                        )}
                      >
                        {pending ? "На проверке" : String(r.status)}
                      </span>
                      {ok && (
                        <span className="font-display text-green-deep text-xs font-semibold tabular-nums">
                          +{Number(r.xp)}
                        </span>
                      )}
                      {pending && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          onClick={() => removeReport(r.id)}
                          aria-label="Удалить отчёт"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                  <p className="bg-background mt-3 rounded-xl px-3.5 py-2.5 text-sm leading-relaxed">
                    {p.work}
                  </p>
                  {!pending && !ok && reason && REJECT_REASONS[reason] && (
                    <p className="text-red mt-2 text-xs font-semibold">
                      Причина: {REJECT_REASONS[reason]}
                    </p>
                  )}
                  {p.proofs.length > 0 && (
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      {p.proofs.map((url, j) => (
                        <a
                          key={j}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary inline-flex items-center gap-1 text-xs font-semibold hover:underline"
                        >
                          <ExternalLink className="size-3" /> Доказательство {j + 1}
                        </a>
                      ))}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

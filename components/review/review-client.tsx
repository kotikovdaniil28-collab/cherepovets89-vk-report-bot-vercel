"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck, ExternalLink, Check, X, Clock, UserMinus, History } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth-provider";
import { getSupabase } from "@/lib/supabase/client";
import { KV_EMAILS, STATUS_XP } from "@/lib/constants";
import { parseReportPayload, reportDayMs, type ReportRow } from "@/lib/reports";
import { Reveal, SecHead } from "@/components/ui/reveal";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const REJECT_OPTIONS = [
  { code: "none", title: "Просто отказать" },
  { code: "no_proof", title: "Нет доказательств" },
  { code: "not_enough_work", title: "Недостаточно работы" },
  { code: "wrong_date", title: "Неверная дата" },
  { code: "duplicate", title: "Дубликат" },
  { code: "rules", title: "Не по требованиям" },
];

/** Кнопки-вердикты как в макете: название + XP снизу */
const VERDICTS: { status: string; label: string }[] = [
  { status: "Норма", label: "Норма" },
  { status: "Перенорма", label: "Перенорма" },
  { status: "Натяг", label: "Натяг" },
  { status: "Герой дня", label: "Герой" },
];

export function ReviewClient() {
  const { roles, loading: authLoading } = useAuth();
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [decided, setDecided] = useState({ approved: 0, rejected: 0 });
  const [decidedRows, setDecidedRows] = useState<ReportRow[]>([]);
  const [showDecided, setShowDecided] = useState(false);
  const [inactivesCount, setInactivesCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [reason, setReason] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const supa = getSupabase();
    const weekAgoMs = Date.now() - 7 * 86400000;
    // В таблице reports нет created_at — сортируем по id и фильтруем неделю по дате из payload
    const [pendRes, decRes, inactRes] = await Promise.all([
      supa
        .from("reports")
        .select("*")
        .or("status.is.null,status.eq.pending,status.eq.На проверке")
        .order("id", { ascending: true }),
      supa
        .from("reports")
        .select("*")
        .not("status", "is", null)
        .neq("status", "pending")
        .neq("status", "На проверке")
        .order("id", { ascending: false })
        .limit(500),
      // Неактивы живут в reports с email=INACTIVE_REQ (legacy-формат)
      supa
        .from("reports")
        .select("id", { count: "exact", head: true })
        .eq("email", "INACTIVE_REQ")
        .eq("status", "Ожидает одобрения"),
    ]);
    const pending = ((pendRes.data || []) as ReportRow[]).filter(
      (r) => !KV_EMAILS.has(String(r.email))
    );
    setRows(pending);
    // Все проверенные отчёты (без служебных KV-строк) — для списка «Проверенные»
    const allDecided = ((decRes.data || []) as ReportRow[]).filter(
      (d) => !KV_EMAILS.has(String(d.email))
    );
    setDecidedRows(allDecided);
    const dec = allDecided.filter((d) => reportDayMs(d) >= weekAgoMs);
    setDecided({
      approved: dec.filter((d) => (Number(d.xp) || 0) > 0).length,
      rejected: dec.filter((d) => (Number(d.xp) || 0) === 0).length,
    });
    setInactivesCount(inactRes.count || 0);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (roles.isLeadership || roles.isCreator) load();
  }, [roles, load]);

  const decide = async (reportId: string, status: string) => {
    setBusy(reportId);
    try {
      const supa = getSupabase();
      const { data: sess } = await supa.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error("no session");
      const res = await fetch("/api/reports/review", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({
          reportId,
          status,
          reasonCode: status === "Не засчитано" ? reason[reportId] || "none" : "",
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Ошибка");
      toast.success(
        status === "Не засчитано"
          ? "Отчёт отклонён"
          : `Одобрено: ${status} (+${STATUS_XP[status]} XP)`
      );
      setRows((r) => r.filter((x) => x.id !== reportId));
      setDecided((d) =>
        status === "Не засчитано"
          ? { ...d, rejected: d.rejected + 1 }
          : { ...d, approved: d.approved + 1 }
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось вынести вердикт");
    } finally {
      setBusy(null);
    }
  };

  const tiles = useMemo(
    () => [
      { icon: Check, v: decided.approved, k: "одобрено за 7 дней", cls: "bg-green/15 text-green-deep" },
      { icon: X, v: decided.rejected, k: "отклонено за 7 дней", cls: "bg-red/13 text-red" },
      { icon: Clock, v: rows.length, k: "ждут проверки", cls: "bg-blue/15 text-blue" },
      { icon: UserMinus, v: inactivesCount, k: "неактивов ждут", cls: "bg-violet/15 text-violet" },
    ],
    [decided, rows.length, inactivesCount]
  );

  if (!authLoading && !roles.isLeadership && !roles.isCreator) {
    return (
      <div className="flex flex-col items-center gap-3 py-20">
        <ShieldCheck className="text-muted-foreground size-10" />
        <p className="text-muted-foreground text-sm">Раздел доступен только руководству модерации.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Reveal i={0}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SecHead title="Панель руководства" hint="отчёты и быстрые решения" />
          <button
            onClick={() => setShowDecided((v) => !v)}
            className={cn(
              "flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition-colors",
              showDecided
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card hover:bg-secondary"
            )}
          >
            <History className="size-4" />
            {showDecided ? "К очереди проверки" : `Проверенные отчёты (${decidedRows.length})`}
          </button>
        </div>
      </Reveal>

      <Reveal i={1} className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.k} className="bg-card rounded-2xl border p-4">
            <span className={cn("mb-3 flex size-8 items-center justify-center rounded-lg", t.cls)}>
              <t.icon className="size-4" />
            </span>
            <div className="font-display text-2xl font-semibold tabular-nums">
              {loading ? "—" : t.v}
            </div>
            <div className="text-muted-foreground text-xs">{t.k}</div>
          </div>
        ))}
      </Reveal>

      {/* Список проверенных отчётов */}
      {showDecided && (
        <Reveal i={2} className="bg-card overflow-hidden rounded-2xl border">
          <div className="max-h-[60vh] overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/95 sticky top-0 backdrop-blur-sm">
                <tr className="text-muted-foreground text-left text-xs">
                  <th className="px-4 py-2.5 font-semibold">Дата</th>
                  <th className="px-4 py-2.5 font-semibold">Ник</th>
                  <th className="px-4 py-2.5 font-semibold">Работа</th>
                  <th className="px-4 py-2.5 font-semibold">Вердикт</th>
                  <th className="px-4 py-2.5 text-right font-semibold">XP</th>
                </tr>
              </thead>
              <tbody>
                {decidedRows.map((r) => {
                  const p = parseReportPayload(r);
                  const ok = (Number(r.xp) || 0) > 0;
                  return (
                    <tr key={r.id} className="border-border/40 hover:bg-muted/40 border-t transition-colors">
                      <td className="px-4 py-2 whitespace-nowrap tabular-nums">{p.day}</td>
                      <td className="px-4 py-2 font-medium">{p.nick}</td>
                      <td className="text-muted-foreground max-w-sm truncate px-4 py-2" title={p.work}>
                        {p.work}
                      </td>
                      <td className="px-4 py-2">
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-xs font-bold",
                            ok ? "bg-green/15 text-green-deep" : "bg-red/13 text-red"
                          )}
                        >
                          {String(r.status)}
                        </span>
                      </td>
                      <td
                        className={cn(
                          "px-4 py-2 text-right font-semibold tabular-nums",
                          ok ? "text-green-deep" : "text-muted-foreground"
                        )}
                      >
                        {ok ? `+${r.xp}` : "—"}
                      </td>
                    </tr>
                  );
                })}
                {decidedRows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-muted-foreground px-4 py-10 text-center">
                      Проверенных отчётов пока нет
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Reveal>
      )}

      {!showDecided && !loading && rows.length === 0 && (
        <Reveal i={2} className="bg-card flex flex-col items-center gap-3 rounded-2xl border py-14">
          <span className="bg-green/15 flex size-14 items-center justify-center rounded-full">
            <Check className="text-green-deep size-7" />
          </span>
          <p className="text-muted-foreground text-sm">Очередь пуста — все отчёты проверены.</p>
        </Reveal>
      )}

      <div className={cn("flex max-w-3xl flex-col gap-4", showDecided && "hidden")}>
        <AnimatePresence>
          {rows.map((r, idx) => {
            const p = parseReportPayload(r);
            const quality = String((p.json.quality as string) || "");
            return (
              <motion.div
                key={r.id}
                layout
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0, transition: { delay: Math.min(idx * 0.06, 0.4) } }}
                exit={{ opacity: 0, x: 60, transition: { duration: 0.25 } }}
                className="bg-card rounded-2xl border p-5"
              >
                <div className="mb-3.5 flex items-start gap-3">
                  <span className="bg-secondary text-muted-foreground flex size-[30px] shrink-0 items-center justify-center rounded-lg text-xs font-bold">
                    {p.nick.slice(0, 2).toLowerCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{p.nick}</div>
                    <div className="text-muted-foreground truncate text-xs">
                      {p.day} · {r.email}
                    </div>
                  </div>
                  {quality && (
                    <span className="bg-amber/20 text-amber-deep shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold">
                      Заявлено: {quality}
                    </span>
                  )}
                </div>

                <p className="bg-background mb-3.5 rounded-xl px-3.5 py-3 text-sm leading-relaxed">
                  {p.work}
                </p>

                {p.proofs.length > 0 && (
                  <div className="mb-3.5 flex flex-wrap gap-2">
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

                {/* Вердикты как в макете: сетка кнопок с XP */}
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                  {VERDICTS.map((v) => (
                    <motion.button
                      key={v.status}
                      whileTap={{ scale: 0.94 }}
                      disabled={busy === r.id}
                      onClick={() => decide(r.id, v.status)}
                      className="border-input hover:border-green hover:bg-green/10 hover:text-green-deep flex min-h-[52px] flex-col items-center justify-center gap-0.5 rounded-xl border text-sm font-bold transition-colors disabled:opacity-50"
                    >
                      {v.label}
                      <span className="font-display text-muted-foreground text-xs">
                        +{STATUS_XP[v.status]}
                      </span>
                    </motion.button>
                  ))}
                  <motion.button
                    whileTap={{ scale: 0.94 }}
                    disabled={busy === r.id}
                    onClick={() => decide(r.id, "Не засчитано")}
                    className="border-red/40 text-red hover:bg-red/10 col-span-2 flex min-h-[52px] flex-col items-center justify-center gap-0.5 rounded-xl border text-sm font-bold transition-colors disabled:opacity-50 sm:col-span-1"
                  >
                    Отказ
                    <span className="font-display text-xs opacity-70">0</span>
                  </motion.button>
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <span className="text-muted-foreground text-xs font-semibold">Причина отказа:</span>
                  <Select
                    value={reason[r.id] || "none"}
                    onValueChange={(v) => setReason((m) => ({ ...m, [r.id]: v }))}
                  >
                    <SelectTrigger className="h-8 w-52 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {REJECT_OPTIONS.map((o) => (
                        <SelectItem key={o.code} value={o.code}>
                          {o.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}

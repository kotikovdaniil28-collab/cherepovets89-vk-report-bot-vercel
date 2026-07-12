"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Table2, Search, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { getSupabase } from "@/lib/supabase/client";
import { KV_EMAILS } from "@/lib/constants";
import { parseReportPayload, reportDayMs, type ReportRow } from "@/lib/reports";
import { Reveal } from "@/components/ui/reveal";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type Row = {
  id: string;
  nick: string;
  day: string;
  dayMs: number;
  work: string;
  status: string;
  xp: number;
  email: string;
};

type SortKey = "day" | "nick" | "status" | "xp";
type SortDir = "asc" | "desc";

const COLUMNS: { key: SortKey | "work"; label: string; sortable: boolean; className?: string }[] = [
  { key: "day", label: "Дата", sortable: true, className: "w-32" },
  { key: "nick", label: "Ник", sortable: true, className: "w-44" },
  { key: "work", label: "Работа", sortable: false },
  { key: "status", label: "Статус", sortable: true, className: "w-36" },
  { key: "xp", label: "XP", sortable: true, className: "w-20 text-right" },
];

export function TableClient() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("day");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  useEffect(() => {
    let mounted = true;
    (async () => {
      const supa = getSupabase();
      // В таблице reports нет created_at — сортируем на клиенте по дате отчёта
      const { data, error } = await supa.from("reports").select("*").limit(1500);
      if (error) console.error("[table] load error:", error.message);
      if (!mounted) return;
      const mapped: Row[] = ((data || []) as ReportRow[])
        .filter((r) => !KV_EMAILS.has(String(r.email)))
        .map((r) => {
          const p = parseReportPayload(r);
          return {
            id: r.id,
            nick: p.nick,
            day: p.day,
            dayMs: reportDayMs(r),
            work: p.work,
            status: String(r.status || "На проверке"),
            xp: Number(r.xp) || 0,
            email: String(r.email || ""),
          };
        });
      setRows(mapped);
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "nick" || key === "status" ? "asc" : "desc");
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = rows.filter((r) => {
      const pending = r.status === "pending" || r.status === "На проверке";
      if (statusFilter === "approved" && r.xp <= 0) return false;
      if (statusFilter === "pending" && !pending) return false;
      if (statusFilter === "rejected" && !(r.xp <= 0 && !pending)) return false;
      if (q && !r.nick.toLowerCase().includes(q) && !r.email.toLowerCase().includes(q)) return false;
      return true;
    });
    const dir = sortDir === "asc" ? 1 : -1;
    list.sort((a, b) => {
      if (sortKey === "day") return (a.dayMs - b.dayMs) * dir;
      if (sortKey === "xp") return (a.xp - b.xp) * dir;
      return a[sortKey].localeCompare(b[sortKey], "ru") * dir;
    });
    return list;
  }, [rows, query, statusFilter, sortKey, sortDir]);

  const totals = useMemo(
    () => ({
      xp: filtered.reduce((s, r) => s + r.xp, 0),
      approved: filtered.filter((r) => r.xp > 0).length,
      pending: filtered.filter((r) => r.status === "pending" || r.status === "На проверке").length,
    }),
    [filtered]
  );

  return (
    <div className="flex flex-col gap-6">
      <Reveal>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-xl">
              <Table2 className="size-5" />
            </span>
            <div>
              <h1 className="font-display text-xl font-bold tracking-tight md:text-2xl">Таблица отчётов</h1>
              <p className="text-muted-foreground text-sm">
                {loading ? "Загрузка..." : `Всего записей: ${filtered.length}`}
              </p>
            </div>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <div className="relative flex-1 sm:flex-none">
              <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Поиск по нику или email"
                className="w-full pl-8 sm:w-64"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все статусы</SelectItem>
                <SelectItem value="approved">Одобрено</SelectItem>
                <SelectItem value="pending">На проверке</SelectItem>
                <SelectItem value="rejected">Отклонено</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Reveal>

      {/* Мобайл: карточки */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="md:hidden">
        <div className="flex flex-col gap-2">
          {filtered.slice(0, 150).map((r) => {
            const pending = r.status === "pending" || r.status === "На проверке";
            return (
              <div key={r.id} className="bg-card border-border/60 rounded-2xl border p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-semibold">{r.nick}</span>
                  <Badge variant={pending ? "secondary" : r.xp > 0 ? "success" : "destructive"}>
                    {pending ? "На проверке" : r.status}
                  </Badge>
                </div>
                <p className="text-muted-foreground mt-1 line-clamp-2 text-xs">{r.work}</p>
                <div className="text-muted-foreground mt-2 flex items-center justify-between text-xs">
                  <span className="tabular-nums">{r.day}</span>
                  <span className="text-foreground font-semibold tabular-nums">
                    {r.xp > 0 ? `+${r.xp} XP` : "—"}
                  </span>
                </div>
              </div>
            );
          })}
          {!loading && filtered.length === 0 && (
            <p className="text-muted-foreground py-10 text-center text-sm">Ничего не найдено</p>
          )}
        </div>
      </motion.div>

      {/* Десктоп: Excel-стиль — сетка ячеек, закреплённая шапка, сортировка, итоги */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="hidden md:block"
      >
        <div className="bg-card border-border/60 overflow-hidden rounded-2xl border shadow-sm">
          <div className="max-h-[65vh] overflow-auto">
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="bg-secondary/95 text-secondary-foreground backdrop-blur-sm">
                  {/* Нумерация строк как в Excel */}
                  <th className="border-border/60 text-muted-foreground w-12 border-r border-b px-2 py-2.5 text-center text-xs font-semibold">
                    №
                  </th>
                  {COLUMNS.map((col) => (
                    <th
                      key={col.key}
                      className={cn(
                        "border-border/60 border-r border-b px-3.5 py-2.5 text-left text-xs font-bold tracking-wide uppercase last:border-r-0",
                        col.className
                      )}
                    >
                      {col.sortable ? (
                        <button
                          onClick={() => toggleSort(col.key as SortKey)}
                          className={cn(
                            "hover:text-primary inline-flex items-center gap-1 transition-colors",
                            col.key === "xp" && "w-full justify-end"
                          )}
                        >
                          {col.label}
                          {sortKey === col.key ? (
                            sortDir === "asc" ? (
                              <ArrowUp className="size-3" />
                            ) : (
                              <ArrowDown className="size-3" />
                            )
                          ) : (
                            <ArrowUpDown className="size-3 opacity-40" />
                          )}
                        </button>
                      ) : (
                        col.label
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 500).map((r, i) => {
                  const pending = r.status === "pending" || r.status === "На проверке";
                  return (
                    <tr
                      key={r.id}
                      className={cn(
                        "hover:bg-primary/5 transition-colors",
                        i % 2 === 1 && "bg-muted/30"
                      )}
                    >
                      <td className="border-border/40 text-muted-foreground border-r border-b px-2 py-2 text-center text-xs tabular-nums">
                        {i + 1}
                      </td>
                      <td className="border-border/40 border-r border-b px-3.5 py-2 whitespace-nowrap tabular-nums">
                        {r.day}
                      </td>
                      <td className="border-border/40 border-r border-b px-3.5 py-2 font-medium">
                        {r.nick}
                      </td>
                      <td
                        className="border-border/40 text-muted-foreground max-w-md truncate border-r border-b px-3.5 py-2"
                        title={r.work}
                      >
                        {r.work}
                      </td>
                      <td className="border-border/40 border-r border-b px-3.5 py-2">
                        <Badge variant={pending ? "secondary" : r.xp > 0 ? "success" : "destructive"}>
                          {pending ? "На проверке" : r.status}
                        </Badge>
                      </td>
                      <td
                        className={cn(
                          "border-border/40 border-b px-3.5 py-2 text-right font-semibold tabular-nums",
                          r.xp > 0 ? "text-green-deep" : "text-muted-foreground"
                        )}
                      >
                        {r.xp > 0 ? `+${r.xp}` : "—"}
                      </td>
                    </tr>
                  );
                })}
                {!loading && filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-muted-foreground px-4 py-10 text-center">
                      Ничего не найдено
                    </td>
                  </tr>
                )}
              </tbody>
              {/* Итоговая строка как в Excel */}
              {filtered.length > 0 && (
                <tfoot className="sticky bottom-0">
                  <tr className="bg-secondary/95 font-semibold backdrop-blur-sm">
                    <td className="border-border/60 border-t px-2 py-2.5" />
                    <td colSpan={2} className="border-border/60 border-t px-3.5 py-2.5 text-xs">
                      Итого: {filtered.length} записей
                    </td>
                    <td className="border-border/60 text-muted-foreground border-t px-3.5 py-2.5 text-xs">
                      Одобрено: {totals.approved} · На проверке: {totals.pending}
                    </td>
                    <td className="border-border/60 border-t px-3.5 py-2.5 text-right text-xs" />
                    <td className="border-border/60 text-green-deep border-t px-3.5 py-2.5 text-right text-xs tabular-nums">
                      Σ +{totals.xp}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

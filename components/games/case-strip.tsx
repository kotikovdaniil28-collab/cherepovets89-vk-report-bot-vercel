"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

// Редкости в стиле CS:GO кейсов
export type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary" | "fine";

export type StripItem = {
  label: string;
  sub?: string;
  rarity: Rarity;
};

const RARITY_STYLES: Record<Rarity, { bar: string; bg: string; text: string }> = {
  common: { bar: "bg-zinc-500", bg: "bg-zinc-500/10", text: "text-zinc-400" },
  uncommon: { bar: "bg-sky-500", bg: "bg-sky-500/10", text: "text-sky-400" },
  rare: { bar: "bg-indigo-500", bg: "bg-indigo-500/10", text: "text-indigo-400" },
  epic: { bar: "bg-fuchsia-500", bg: "bg-fuchsia-500/10", text: "text-fuchsia-400" },
  legendary: { bar: "bg-amber-400", bg: "bg-amber-400/10", text: "text-amber-400" },
  fine: { bar: "bg-red-500", bg: "bg-red-500/10", text: "text-red-400" },
};

const CELL_W = 104; // ширина ячейки + gap

/**
 * Лента открытия кейса в стиле CS:GO: прокручивается и замедляясь
 * останавливается так, что выигрышный предмет оказывается под маркером.
 */
export function CaseStrip({
  pool,
  winner,
  spinning,
  onDone,
}: {
  pool: StripItem[];
  winner: StripItem | null;
  spinning: boolean;
  onDone: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState(0);

  // Лента из 50 случайных предметов; победитель — на позиции 42
  const WINNER_INDEX = 42;
  const reel = useMemo(() => {
    if (!winner) return [];
    const cells: StripItem[] = [];
    for (let i = 0; i < 50; i++) {
      cells.push(i === WINNER_INDEX ? winner : pool[Math.floor(Math.random() * pool.length)]);
    }
    return cells;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [winner]);

  useEffect(() => {
    if (!spinning || !winner || !containerRef.current) return;
    const cw = containerRef.current.clientWidth;
    // Останавливаемся так, чтобы центр победной ячейки был под маркером (+ случайный сдвиг)
    const jitter = (Math.random() - 0.5) * (CELL_W * 0.55);
    const target = WINNER_INDEX * CELL_W + CELL_W / 2 - cw / 2 + jitter;
    setOffset(-target);
    const t = setTimeout(onDone, 4300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spinning, winner]);

  if (!winner) return null;

  return (
    <div
      ref={containerRef}
      className="bg-background relative w-full max-w-full min-w-0 overflow-hidden rounded-xl border py-3"
    >
      {/* Центральный маркер */}
      <div className="bg-primary absolute inset-y-0 left-1/2 z-10 w-0.5 -translate-x-1/2" />
      <div className="border-t-primary absolute top-0 left-1/2 z-10 -translate-x-1/2 border-x-8 border-t-8 border-x-transparent" />
      <div className="border-b-primary absolute bottom-0 left-1/2 z-10 -translate-x-1/2 border-x-8 border-b-8 border-x-transparent" />
      {/* Затемнение краёв */}
      <div className="from-background pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-linear-to-r to-transparent" />
      <div className="from-background pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-linear-to-l to-transparent" />

      <motion.div
        initial={{ x: 0 }}
        animate={{ x: offset }}
        transition={{ duration: 4.2, ease: [0.08, 0.65, 0.1, 1] }}
        className="flex gap-2"
        style={{ willChange: "transform" }}
      >
        {reel.map((item, i) => {
          const s = RARITY_STYLES[item.rarity];
          return (
            <div
              key={i}
              className={cn(
                "flex h-24 w-24 shrink-0 flex-col items-center justify-center gap-1 rounded-lg border",
                s.bg
              )}
            >
              <span className={cn("text-sm font-bold tabular-nums", s.text)}>{item.label}</span>
              {item.sub && <span className="text-muted-foreground text-[10px]">{item.sub}</span>}
              <span className={cn("mt-1 h-1 w-12 rounded-full", s.bar)} />
            </div>
          );
        })}
      </motion.div>
    </div>
  );
}

export { RARITY_STYLES };

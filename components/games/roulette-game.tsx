"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CaseStrip, type StripItem } from "@/components/games/case-strip";
import { cn } from "@/lib/utils";

// Призы рулетки (веса как в legacy: 500 XP 5%, 300 XP 20%, ничего 45%, штраф 30%)
const PRIZES: (StripItem & { val: number; weight: number })[] = [
  { label: "+500 XP", sub: "Легендарно", rarity: "legendary", val: 500, weight: 5 },
  { label: "+300 XP", sub: "Редко", rarity: "epic", val: 300, weight: 20 },
  { label: "Пусто", sub: "Не повезло", rarity: "common", val: 0, weight: 45 },
  { label: "-100 XP", sub: "Штраф", rarity: "fine", val: -100, weight: 30 },
];

function rollPrize() {
  const total = PRIZES.reduce((s, p) => s + p.weight, 0);
  let r = Math.random() * total;
  for (const p of PRIZES) {
    r -= p.weight;
    if (r <= 0) return p;
  }
  return PRIZES[PRIZES.length - 1];
}

export function RouletteGame({
  onResult,
  onClose,
}: {
  onResult: (delta: number, label: string) => Promise<void>;
  onClose: () => void;
}) {
  const [winner, setWinner] = useState<(typeof PRIZES)[number] | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [done, setDone] = useState(false);

  const spin = () => {
    setWinner(rollPrize());
    setSpinning(true);
    setDone(false);
  };

  const handleDone = async () => {
    setSpinning(false);
    setDone(true);
    if (winner) {
      await onResult(winner.val, `Рулетка Модерации: ${winner.label}`);
    }
  };

  return (
    <div className="flex w-full min-w-0 flex-col items-center gap-4 overflow-hidden py-2">
      {!winner && (
        <p className="text-muted-foreground text-sm text-pretty">
          Лента остановится на твоём призе: от штрафа до +500 XP.
        </p>
      )}

      {winner && <CaseStrip pool={PRIZES} winner={winner} spinning={spinning} onDone={handleDone} />}

      {done && winner && (
        <p
          className={cn(
            "text-lg font-bold",
            winner.val > 0 ? "text-success" : winner.val < 0 ? "text-destructive" : "text-muted-foreground"
          )}
        >
          {winner.val > 0 ? `Выигрыш ${winner.label}!` : winner.val < 0 ? "Штраф -100 XP..." : "Пусто. Повезёт в следующий раз."}
        </p>
      )}

      <div className="flex gap-2">
        {!spinning && !done && <Button onClick={spin}>Крутить</Button>}
        {done && (
          <Button variant="outline" onClick={onClose}>
            Закрыть
          </Button>
        )}
      </div>
    </div>
  );
}

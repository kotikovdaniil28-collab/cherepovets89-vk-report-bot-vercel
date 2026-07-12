"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CaseStrip, type StripItem } from "@/components/games/case-strip";
import { cn } from "@/lib/utils";

// Кейс (ставка 300): призы с весами — матожидание чуть ниже ставки
const PRIZES: (StripItem & { val: number; weight: number })[] = [
  { label: "Пусто", sub: "0 XP", rarity: "common", val: 0, weight: 30 },
  { label: "+150 XP", sub: "Обычный", rarity: "uncommon", val: 150, weight: 30 },
  { label: "+300 XP", sub: "Возврат", rarity: "rare", val: 300, weight: 22 },
  { label: "+600 XP", sub: "Редкий", rarity: "epic", val: 600, weight: 13 },
  { label: "+1000 XP", sub: "Джекпот", rarity: "legendary", val: 1000, weight: 5 },
];

function rollPrize() {
  const total = PRIZES.reduce((s, p) => s + p.weight, 0);
  let r = Math.random() * total;
  for (const p of PRIZES) {
    r -= p.weight;
    if (r <= 0) return p;
  }
  return PRIZES[0];
}

export function CasesGame({
  onResult,
  onClose,
}: {
  onResult: (delta: number, label: string) => void;
  onClose: () => void;
}) {
  const [winner, setWinner] = useState<(typeof PRIZES)[number] | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [done, setDone] = useState(false);

  const open = () => {
    setWinner(rollPrize());
    setSpinning(true);
    setDone(false);
  };

  const handleDone = () => {
    setSpinning(false);
    setDone(true);
    if (winner) onResult(winner.val, `Кейсы: приз ${winner.val} XP`);
  };

  return (
    <div className="flex w-full min-w-0 flex-col items-center gap-4 overflow-hidden py-2">
      {!winner && (
        <p className="text-muted-foreground text-sm text-pretty">
          Открой кейс — внутри от 0 до 1000 XP. Джекпот выпадает с шансом 5%.
        </p>
      )}

      {winner && <CaseStrip pool={PRIZES} winner={winner} spinning={spinning} onDone={handleDone} />}

      {done && winner && (
        <p className={cn("text-lg font-bold", winner.val > 0 ? "text-success" : "text-muted-foreground")}>
          {winner.val > 0 ? `Выпало +${winner.val} XP!` : "Кейс пуст..."}
        </p>
      )}

      <div className="flex gap-2">
        {!spinning && !done && <Button onClick={open}>Открыть кейс</Button>}
        {done && (
          <Button variant="outline" onClick={onClose}>
            Закрыть
          </Button>
        )}
      </div>
    </div>
  );
}

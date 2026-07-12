"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";

// 9 клеток: 3 мины, найти 3 алмаза до подрыва — x2 (600)
export function MinesGame({
  onResult,
  onClose,
}: {
  onResult: (delta: number, label: string) => Promise<void>;
  onClose: () => void;
}) {
  const [mines] = useState<Set<number>>(() => {
    const s = new Set<number>();
    while (s.size < 3) s.add(Math.floor(Math.random() * 9));
    return s;
  });
  const [opened, setOpened] = useState<Set<number>>(new Set());
  const [gameOver, setGameOver] = useState<"win" | "lose" | null>(null);

  const open = async (i: number) => {
    if (gameOver || opened.has(i)) return;
    const next = new Set(opened);
    next.add(i);
    setOpened(next);
    if (mines.has(i)) {
      setGameOver("lose");
      await onResult(0, "Мины: подрыв");
      return;
    }
    const diamonds = Array.from(next).filter((x) => !mines.has(x)).length;
    if (diamonds >= 3) {
      setGameOver("win");
      await onResult(600, "Мины: 3 алмаза (+600)");
    }
  };

  return (
    <div className="flex flex-col items-center gap-5 py-4">
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: 9 }, (_, i) => {
          const isOpen = opened.has(i) || gameOver !== null;
          const isMine = mines.has(i);
          return (
            <motion.button
              key={i}
              type="button"
              whileHover={!isOpen ? { scale: 1.05 } : {}}
              whileTap={!isOpen ? { scale: 0.95 } : {}}
              onClick={() => open(i)}
              disabled={gameOver !== null}
              className={`flex size-16 items-center justify-center rounded-lg text-2xl transition-colors ${
                isOpen ? (isMine ? "bg-destructive/15" : "bg-emerald-500/15") : "bg-muted hover:bg-muted/70"
              }`}
              aria-label={`Клетка ${i + 1}`}
            >
              <span aria-hidden>{isOpen ? (isMine ? "💣" : "💎") : ""}</span>
            </motion.button>
          );
        })}
      </div>
      {gameOver && (
        <div className="flex flex-col items-center gap-3">
          <p className="text-lg font-semibold">
            {gameOver === "win" ? "3 алмаза! +600 XP" : "Мина! Ставка сгорела."}
          </p>
          <Button variant="outline" onClick={onClose}>
            Закрыть
          </Button>
        </div>
      )}
    </div>
  );
}

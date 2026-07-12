"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";

const DICE = ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];

export function DiceGame({
  onResult,
  onClose,
}: {
  onResult: (delta: number, label: string) => Promise<void>;
  onClose: () => void;
}) {
  const [rolling, setRolling] = useState(false);
  const [mine, setMine] = useState<number | null>(null);
  const [dealer, setDealer] = useState<number | null>(null);

  const roll = async () => {
    setRolling(true);
    setTimeout(async () => {
      const my = 1 + Math.floor(Math.random() * 6);
      const dl = 1 + Math.floor(Math.random() * 6);
      setMine(my);
      setDealer(dl);
      setRolling(false);
      const win = my > dl;
      await onResult(win ? 300 : 0, win ? "Кости: победа (+300)" : "Кости: проигрыш");
    }, 1200);
  };

  return (
    <div className="flex flex-col items-center gap-5 py-4">
      <div className="flex items-center gap-8">
        <div className="flex flex-col items-center gap-1">
          <motion.span
            aria-hidden
            className="text-6xl"
            animate={rolling ? { rotate: [0, 360, 720] } : {}}
            transition={{ duration: 1.2 }}
          >
            {mine ? DICE[mine - 1] : "⚀"}
          </motion.span>
          <span className="text-muted-foreground text-xs">Вы</span>
        </div>
        <span className="text-muted-foreground text-xl">vs</span>
        <div className="flex flex-col items-center gap-1">
          <motion.span
            aria-hidden
            className="text-6xl"
            animate={rolling ? { rotate: [0, -360, -720] } : {}}
            transition={{ duration: 1.2 }}
          >
            {dealer ? DICE[dealer - 1] : "⚀"}
          </motion.span>
          <span className="text-muted-foreground text-xs">Дилер</span>
        </div>
      </div>
      {mine !== null && dealer !== null ? (
        <div className="flex flex-col items-center gap-3">
          <p className="text-lg font-semibold">{mine > dealer ? "Победа! +300 XP" : "Дилер выиграл."}</p>
          <Button variant="outline" onClick={onClose}>
            Закрыть
          </Button>
        </div>
      ) : (
        <Button onClick={roll} disabled={rolling}>
          {rolling ? "Бросок..." : "Бросить кости"}
        </Button>
      )}
    </div>
  );
}

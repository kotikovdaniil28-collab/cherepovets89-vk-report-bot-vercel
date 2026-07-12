"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";

export function CoinGame({
  onResult,
  onClose,
}: {
  onResult: (delta: number, label: string) => Promise<void>;
  onClose: () => void;
}) {
  const [flipping, setFlipping] = useState(false);
  const [outcome, setOutcome] = useState<"win" | "lose" | null>(null);

  const play = async (choice: "heads" | "tails") => {
    setFlipping(true);
    const actual = Math.random() < 0.5 ? "heads" : "tails";
    setTimeout(async () => {
      const win = actual === choice;
      setOutcome(win ? "win" : "lose");
      setFlipping(false);
      await onResult(win ? 1000 : 0, win ? "Орёл или Решка: победа (+1000)" : "Орёл или Решка: проигрыш");
    }, 1500);
  };

  return (
    <div className="flex flex-col items-center gap-5 py-4">
      <motion.div
        animate={flipping ? { rotateY: 1800 } : { rotateY: 0 }}
        transition={{ duration: 1.5 }}
        className="bg-muted flex size-28 items-center justify-center rounded-full text-5xl"
      >
        <span aria-hidden>🪙</span>
      </motion.div>
      {outcome ? (
        <div className="flex flex-col items-center gap-3">
          <p className="text-lg font-semibold">
            {outcome === "win" ? "Победа! +1000 XP" : "Не угадали. Ставка сгорела."}
          </p>
          <Button variant="outline" onClick={onClose}>
            Закрыть
          </Button>
        </div>
      ) : (
        <div className="flex gap-3">
          <Button onClick={() => play("heads")} disabled={flipping}>
            Орёл
          </Button>
          <Button onClick={() => play("tails")} disabled={flipping} variant="secondary">
            Решка
          </Button>
        </div>
      )}
    </div>
  );
}

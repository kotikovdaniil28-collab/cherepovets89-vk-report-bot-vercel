"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";

export function SafesGame({
  onResult,
  onClose,
}: {
  onResult: (delta: number, label: string) => Promise<void>;
  onClose: () => void;
}) {
  const [winIndex] = useState(() => Math.floor(Math.random() * 3));
  const [picked, setPicked] = useState<number | null>(null);

  const pick = async (i: number) => {
    if (picked !== null) return;
    setPicked(i);
    const win = i === winIndex;
    await onResult(win ? 1200 : 0, win ? "Три Сейфа: куш x3 (+1200)" : "Три Сейфа: пусто");
  };

  return (
    <div className="flex flex-col items-center gap-5 py-4">
      <div className="flex gap-4">
        {[0, 1, 2].map((i) => (
          <motion.button
            key={i}
            type="button"
            whileHover={picked === null ? { y: -4 } : {}}
            whileTap={picked === null ? { scale: 0.95 } : {}}
            onClick={() => pick(i)}
            className="bg-muted flex size-20 items-center justify-center rounded-xl text-4xl disabled:opacity-100"
            disabled={picked !== null}
            aria-label={`Сейф ${i + 1}`}
          >
            <span aria-hidden>{picked === null ? "🧰" : i === winIndex ? "💰" : "🕸️"}</span>
          </motion.button>
        ))}
      </div>
      {picked !== null && (
        <div className="flex flex-col items-center gap-3">
          <p className="text-lg font-semibold">
            {picked === winIndex ? "Куш! +1200 XP" : "Пусто. Повезёт в следующий раз."}
          </p>
          <Button variant="outline" onClick={onClose}>
            Закрыть
          </Button>
        </div>
      )}
    </div>
  );
}

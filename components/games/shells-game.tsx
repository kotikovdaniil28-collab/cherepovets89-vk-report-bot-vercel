"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";

// Напёрстки: ставка 200 XP, угадал — 500 XP (x2.5)
export function ShellsGame({
  onResult,
  onClose,
}: {
  onResult: (delta: number, label: string) => void;
  onClose: () => void;
}) {
  const [ball] = useState(() => Math.floor(Math.random() * 3));
  const [picked, setPicked] = useState<number | null>(null);

  const pick = (i: number) => {
    if (picked !== null) return;
    setPicked(i);
    const win = i === ball;
    onResult(win ? 500 : 0, win ? "Напёрстки: победа" : "Напёрстки: проигрыш");
  };

  return (
    <div className="flex flex-col items-center gap-4 py-2">
      <p className="text-muted-foreground text-sm text-pretty">
        Под одним из напёрстков мяч. Угадаете — получите 500 XP.
      </p>
      <div className="flex gap-4">
        {[0, 1, 2].map((i) => (
          <motion.button
            key={i}
            type="button"
            whileHover={picked === null ? { y: -6 } : {}}
            whileTap={picked === null ? { scale: 0.95 } : {}}
            onClick={() => pick(i)}
            disabled={picked !== null}
            className="text-5xl"
            aria-label={`Напёрсток ${i + 1}`}
          >
            {picked !== null && i === ball ? "⚪" : "🍵"}
          </motion.button>
        ))}
      </div>
      {picked !== null && (
        <>
          <p className={`text-sm font-semibold ${picked === ball ? "text-success" : "text-destructive"}`}>
            {picked === ball ? "Победа! +500 XP" : "Мимо. Мяч был под другим."}
          </p>
          <Button variant="outline" onClick={onClose}>
            Закрыть
          </Button>
        </>
      )}
    </div>
  );
}

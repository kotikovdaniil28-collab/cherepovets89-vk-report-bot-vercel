"use client";

import { useState } from "react";
import { motion, useAnimate } from "framer-motion";
import { Button } from "@/components/ui/button";

// Колесо Иксов: ставка 250 XP, множители x0 / x0.5 / x1 / x2 / x5
const SECTORS = [
  { label: "x0", mult: 0 },
  { label: "x0.5", mult: 0.5 },
  { label: "x1", mult: 1 },
  { label: "x0", mult: 0 },
  { label: "x2", mult: 2 },
  { label: "x0.5", mult: 0.5 },
  { label: "x0", mult: 0 },
  { label: "x5", mult: 5 },
];
const COST = 250;

export function WheelGame({
  onResult,
  onClose,
}: {
  onResult: (delta: number, label: string) => void;
  onClose: () => void;
}) {
  const [scope, animate] = useAnimate();
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const spin = async () => {
    if (spinning || result) return;
    setSpinning(true);
    const idx = Math.floor(Math.random() * SECTORS.length);
    const sector = SECTORS[idx];
    const target = 360 * 5 + idx * (360 / SECTORS.length);
    await animate(scope.current, { rotate: target }, { duration: 3, ease: [0.15, 0.9, 0.3, 1] });
    const payout = Math.round(COST * sector.mult);
    setResult(`${sector.label} — ${payout > 0 ? `+${payout} XP` : "ничего"}`);
    setSpinning(false);
    onResult(payout, `Колесо Иксов: ${sector.label}`);
  };

  return (
    <div className="flex flex-col items-center gap-4 py-2">
      <div className="relative">
        <div className="absolute -top-1 left-1/2 z-10 -translate-x-1/2 text-lg" aria-hidden>
          ▼
        </div>
        <motion.div
          ref={scope}
          className="border-border bg-muted grid size-40 place-items-center rounded-full border-4 text-xs font-bold"
        >
          <div className="grid grid-cols-4 gap-1 text-center">
            {SECTORS.map((s, i) => (
              <span key={i} className={s.mult >= 2 ? "text-success" : s.mult === 0 ? "text-destructive" : ""}>
                {s.label}
              </span>
            ))}
          </div>
        </motion.div>
      </div>
      {result ? (
        <>
          <p className="text-sm font-semibold">{result}</p>
          <Button variant="outline" onClick={onClose}>
            Закрыть
          </Button>
        </>
      ) : (
        <Button onClick={spin} disabled={spinning}>
          {spinning ? "Крутится..." : "Крутить"}
        </Button>
      )}
    </div>
  );
}

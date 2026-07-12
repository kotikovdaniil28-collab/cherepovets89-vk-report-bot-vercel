"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

export function CrashGame({
  onResult,
  onClose,
}: {
  onResult: (delta: number, label: string) => Promise<void>;
  onClose: () => void;
}) {
  const [multiplier, setMultiplier] = useState(1);
  const [state, setState] = useState<"running" | "cashed" | "crashed">("running");
  const crashAt = useRef(1 + Math.random() * Math.random() * 6);
  const raf = useRef<number>(0);

  useEffect(() => {
    const start = Date.now();
    const tick = () => {
      const t = (Date.now() - start) / 1000;
      const m = Math.pow(1.35, t);
      if (m >= crashAt.current) {
        setMultiplier(crashAt.current);
        setState("crashed");
        onResult(0, "Ракетка: краш");
        return;
      }
      setMultiplier(m);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cashout = async () => {
    if (state !== "running") return;
    cancelAnimationFrame(raf.current);
    setState("cashed");
    const win = Math.floor(100 * multiplier);
    await onResult(win, `Ракетка: вывод на x${multiplier.toFixed(2)} (+${win})`);
  };

  return (
    <div className="flex flex-col items-center gap-5 py-4">
      <div
        className={`text-5xl font-bold tabular-nums ${
          state === "crashed" ? "text-destructive" : state === "cashed" ? "text-emerald-500" : ""
        }`}
      >
        x{multiplier.toFixed(2)}
      </div>
      <span aria-hidden className="text-4xl">
        {state === "crashed" ? "💥" : "🚀"}
      </span>
      {state === "running" ? (
        <Button onClick={cashout}>Забрать {Math.floor(100 * multiplier)} XP</Button>
      ) : (
        <div className="flex flex-col items-center gap-3">
          <p className="text-lg font-semibold">
            {state === "cashed" ? `Успели! +${Math.floor(100 * multiplier)} XP` : "Краш! Ставка сгорела."}
          </p>
          <Button variant="outline" onClick={onClose}>
            Закрыть
          </Button>
        </div>
      )}
    </div>
  );
}

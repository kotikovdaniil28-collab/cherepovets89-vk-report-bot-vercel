"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";

// Больше/Меньше: ставка 100 XP, угадай — выигрыш 200 XP (x2)
export function HiloGame({
  onResult,
  onClose,
}: {
  onResult: (delta: number, label: string) => void;
  onClose: () => void;
}) {
  const [current] = useState(() => Math.floor(Math.random() * 9) + 1);
  const [next, setNext] = useState<number | null>(null);
  const [done, setDone] = useState(false);
  const [won, setWon] = useState(false);

  const guess = (dir: "hi" | "lo") => {
    if (done) return;
    let n = Math.floor(Math.random() * 10) + 1;
    while (n === current) n = Math.floor(Math.random() * 10) + 1;
    setNext(n);
    const win = dir === "hi" ? n > current : n < current;
    setWon(win);
    setDone(true);
    onResult(win ? 200 : 0, win ? "Больше/Меньше: победа" : "Больше/Меньше: проигрыш");
  };

  return (
    <div className="flex flex-col items-center gap-4 py-2">
      <p className="text-muted-foreground text-sm text-pretty">
        Число: <span className="text-foreground text-lg font-bold">{current}</span>. Следующее будет
        больше или меньше? Победа = 200 XP.
      </p>
      {next !== null && (
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-4xl font-bold"
        >
          {next}
        </motion.div>
      )}
      {!done ? (
        <div className="flex gap-3">
          <Button onClick={() => guess("hi")}>Больше</Button>
          <Button variant="secondary" onClick={() => guess("lo")}>
            Меньше
          </Button>
        </div>
      ) : (
        <>
          <p className={`text-sm font-semibold ${won ? "text-success" : "text-destructive"}`}>
            {won ? "Победа! +200 XP" : "Не угадали."}
          </p>
          <Button variant="outline" onClick={onClose}>
            Закрыть
          </Button>
        </>
      )}
    </div>
  );
}

"use client";

import { useEffect, useRef } from "react";
import { useMotionValue, useSpring, useMotionValueEvent } from "framer-motion";

/**
 * Плавно "докручивающийся" числовой счётчик.
 * Используется для XP и статистики на дашборде.
 */
export function CountUp({
  value,
  className,
  format,
}: {
  value: number;
  className?: string;
  format?: (n: number) => string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const mv = useMotionValue(0);
  const spring = useSpring(mv, { stiffness: 55, damping: 18, mass: 0.6 });

  useEffect(() => {
    mv.set(value);
  }, [value, mv]);

  useMotionValueEvent(spring, "change", (latest) => {
    if (ref.current) {
      const n = Math.round(latest);
      ref.current.textContent = format ? format(n) : n.toLocaleString("ru-RU");
    }
  });

  return (
    <span ref={ref} className={className}>
      {format ? format(0) : "0"}
    </span>
  );
}

"use client";

import { motion, type HTMLMotionProps } from "framer-motion";
import type { ReactNode } from "react";

/**
 * Стаггер-появление блоков как в макете:
 * <Reveal i={0}>...</Reveal>, <Reveal i={1}>...</Reveal>
 */
export function Reveal({
  i = 0,
  delay,
  children,
  ...props
}: { i?: number; delay?: number; children: ReactNode } & HTMLMotionProps<"div">) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1], delay: delay ?? i * 0.07 }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

/** Заголовок секции: h2 + подсказка справа */
export function SecHead({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-baseline gap-3">
      <h2 className="font-display text-lg font-semibold">{title}</h2>
      {hint && <span className="text-muted-foreground text-sm">{hint}</span>}
      {action && <span className="ml-auto">{action}</span>}
    </div>
  );
}

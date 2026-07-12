"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { isStaff } from "@/lib/roles";
import { Topbar } from "@/components/shell/topbar";
import { Tabbar } from "@/components/shell/tabbar";
import { AccessGate } from "@/components/shell/access-gate";

/** Страницы, доступные до выдачи статуса модератора */
const GATE_ALLOWED = new Set(["/profile"]);

export function AppShell({ children }: { children: ReactNode }) {
  const { user, roles, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="bg-background bg-grid-pattern flex min-h-svh items-center justify-center">
        <div className="text-muted-foreground flex flex-col items-center gap-4">
          <div className="animate-pulse-glow bg-card flex size-14 items-center justify-center rounded-2xl border">
            <Loader2 className="text-primary size-6 animate-spin" />
          </div>
          <span className="font-mono text-xs tracking-[0.2em] uppercase">Загрузка панели...</span>
        </div>
      </div>
    );
  }

  // Без статуса модератора (USER_ROLE от бота/руководства) — только профиль и VK-привязка
  if (!isStaff(roles) && !GATE_ALLOWED.has(pathname)) {
    return (
      <div className="bg-background min-h-svh">
        <Topbar />
        <AccessGate />
      </div>
    );
  }

  return (
    <div className="bg-background relative min-h-svh">
      {/* Амбиентный фон: сетка + мягкие пятна свечения */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0">
        <div className="bg-grid-pattern absolute inset-0 [mask-image:radial-gradient(120%_80%_at_50%_0%,black_30%,transparent_75%)]" />
        <div className="bg-primary/8 absolute -top-40 left-1/2 h-96 w-[52rem] -translate-x-1/2 rounded-full blur-3xl" />
        <div className="bg-cyan/6 absolute top-1/3 -right-40 hidden h-80 w-80 rounded-full blur-3xl lg:block" />
      </div>
      <Topbar />
      <AnimatePresence mode="wait">
        <motion.main
          key={pathname}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          className="relative z-10 mx-auto w-full max-w-7xl px-4 pt-5 pb-[calc(96px+env(safe-area-inset-bottom))] md:px-8 md:pt-8 lg:pb-10"
        >
          {children}
        </motion.main>
      </AnimatePresence>
      <Tabbar />
    </div>
  );
}

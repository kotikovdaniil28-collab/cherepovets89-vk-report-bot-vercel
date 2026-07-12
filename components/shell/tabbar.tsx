"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { LayoutGrid, X } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { NAV_ITEMS, TAB_HREFS, visibleItems } from "@/components/shell/nav-items";
import { cn } from "@/lib/utils";

/** Нижний таб-бар для телефона + шит «Ещё» со всеми разделами */
export function Tabbar() {
  const pathname = usePathname();
  const { roles } = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);

  // Закрываем шит при переходе на другую страницу
  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  const all = visibleItems(roles, NAV_ITEMS);
  const tabs = all.filter((i) => TAB_HREFS.includes(i.href));
  const extra = all.filter((i) => !TAB_HREFS.includes(i.href));
  const extraActive = extra.some((i) =>
    i.href === "/" ? pathname === "/" : pathname.startsWith(i.href),
  );

  return (
    <>
      <AnimatePresence>
        {moreOpen && (
          <>
            <motion.button
              type="button"
              aria-label="Закрыть меню"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMoreOpen(false)}
              className="fixed inset-0 z-40 bg-black/45 lg:hidden"
            />
            <motion.div
              role="dialog"
              aria-label="Все разделы"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 320 }}
              className="bg-card fixed inset-x-0 bottom-0 z-50 rounded-t-3xl border-t p-5 pb-[calc(88px+env(safe-area-inset-bottom))] lg:hidden"
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-display text-sm font-bold">Все разделы</h2>
                <button
                  type="button"
                  onClick={() => setMoreOpen(false)}
                  className="text-muted-foreground hover:text-foreground rounded-lg p-1.5"
                  aria-label="Закрыть"
                >
                  <X className="size-5" />
                </button>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {extra.map((item) => {
                  const active =
                    item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex flex-col items-center gap-1.5 rounded-xl border px-1 py-3 text-[11px] font-semibold",
                        active
                          ? "border-primary bg-primary/10 text-primary"
                          : "text-muted-foreground hover:border-primary/40",
                      )}
                    >
                      <Icon className="size-5" />
                      <span className="truncate">{item.short}</span>
                    </Link>
                  );
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <nav
        aria-label="Мобильная навигация"
        className="nav-blur fixed inset-x-0 bottom-0 z-50 flex border-t px-1 pt-2 pb-[calc(8px+env(safe-area-inset-bottom))] lg:hidden"
      >
        {tabs.map((item) => {
          const active =
            !moreOpen && (item.href === "/" ? pathname === "/" : pathname.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-xl px-1 py-1.5 text-[10px] font-semibold",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              {active && (
                <motion.span
                  layoutId="tabbar-active"
                  className="bg-accent absolute inset-0 rounded-xl"
                  transition={{ type: "spring", damping: 30, stiffness: 320 }}
                />
              )}
              <motion.span
                animate={active ? { y: -1, scale: 1.08 } : { y: 0, scale: 1 }}
                transition={{ type: "spring", damping: 18, stiffness: 300 }}
                className="relative z-10"
              >
                <Icon className="size-[21px]" />
              </motion.span>
              <span className="relative z-10 truncate">{item.short}</span>
            </Link>
          );
        })}
        {extra.length > 0 && (
          <button
            type="button"
            onClick={() => setMoreOpen((v) => !v)}
            className={cn(
              "relative flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-xl px-1 py-1.5 text-[10px] font-semibold",
              moreOpen || extraActive ? "text-primary" : "text-muted-foreground"
            )}
            aria-expanded={moreOpen}
          >
            {(moreOpen || extraActive) && (
              <motion.span
                layoutId="tabbar-active"
                className="bg-accent absolute inset-0 rounded-xl"
                transition={{ type: "spring", damping: 30, stiffness: 320 }}
              />
            )}
            <span className="relative z-10">
              <LayoutGrid className="size-[21px]" />
            </span>
            <span className="relative z-10 truncate">Ещё</span>
          </button>
        )}
      </nav>
    </>
  );
}

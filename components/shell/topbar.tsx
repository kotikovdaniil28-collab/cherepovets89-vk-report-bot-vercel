"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useTheme } from "next-themes";
import { Moon, Sun, LogOut, Zap, ShieldCheck, Gamepad2, ChevronLeft, ChevronRight } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { NAV_ITEMS, visibleItems } from "@/components/shell/nav-items";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export function Topbar() {
  const { user, roles, xp, signOut } = useAuth();
  const { resolvedTheme, setTheme } = useTheme();
  const router = useRouter();
  const pathname = usePathname();

  const nickname =
    (user?.user_metadata?.nickname as string) || user?.email?.split("@")[0] || "Пользователь";

  const roleLabel = roles.isCreator
    ? "Создатель"
    : roles.isLeadership
      ? "Руководство"
      : roles.isApAdmin
        ? "Рук. АП"
        : roles.isFsbAdmin
          ? "Рук. ФСБ"
          : roles.kinds.has("fsb")
            ? "ФСБ"
            : roles.kinds.has("ap")
              ? "АП"
              : "Модератор";

  const items = visibleItems(roles, NAV_ITEMS);

  // Прокрутка навигации: колесо мыши + явные кнопки-стрелки по краям
  const navRef = useRef<HTMLElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const scrollNav = (dir: -1 | 1) => {
    navRef.current?.scrollBy({ left: dir * 220, behavior: "smooth" });
  };

  useEffect(() => {
    const el = navRef.current;
    if (!el) return;

    const update = () => {
      setCanScrollLeft(el.scrollLeft > 8);
      setCanScrollRight(el.scrollWidth - el.clientWidth - el.scrollLeft > 8);
    };
    update();

    const onWheel = (e: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY + e.deltaX;
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [items.length]);

  // Автопрокрутка к активному пункту, чтобы он не оставался за краем
  useEffect(() => {
    const el = navRef.current;
    if (!el) return;
    const active = el.querySelector<HTMLElement>("[data-active='true']");
    active?.scrollIntoView({ inline: "nearest", block: "nearest", behavior: "smooth" });
  }, [pathname]);

  return (
    <header className="nav-blur sticky top-0 z-40 border-b">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 md:px-8">
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          <motion.span
            whileHover={{ rotate: -8, scale: 1.06 }}
            className="bg-linear-to-br from-green-bright to-green-deep text-primary-foreground glow-primary flex size-9 items-center justify-center rounded-xl"
          >
            <ShieldCheck className="size-5" />
          </motion.span>
          <span className="leading-tight">
            <span className="font-display block text-sm font-extrabold tracking-tight">
              CHEREPOVETS
            </span>
            <span className="text-muted-foreground block text-[10px] font-semibold tracking-[0.18em]">
              МОДЕРАЦИЯ
            </span>
          </span>
        </Link>

        {/* Десктоп-навигация: колесо мыши листает, справа градиент-подсказка */}
        <div className="relative ml-2 hidden min-w-0 flex-1 lg:block">
          <nav
            ref={navRef}
            className="scrollbar-none flex items-center gap-0.5 overflow-x-auto"
            aria-label="Основная навигация"
          >
          {items.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                data-active={active}
                className={cn(
                  "relative inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold whitespace-nowrap transition-colors",
                  active
                    ? "text-primary-foreground"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                {active && (
                  <motion.span
                    layoutId="topnav-active"
                    className="bg-foreground dark:bg-primary absolute inset-0 rounded-lg"
                    transition={{ type: "spring", damping: 30, stiffness: 350 }}
                  />
                )}
                <Icon className="relative z-10 size-3.5" />
                <span
                  className={cn("relative z-10", active && "text-background dark:text-primary-foreground")}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
          </nav>
          {/* Кнопки-стрелки: явное листание навигации */}
          {canScrollLeft && (
            <div className="absolute inset-y-0 left-0 flex items-center">
              <div aria-hidden className="from-background absolute inset-y-0 left-0 w-12 bg-linear-to-r to-transparent" />
              <button
                onClick={() => scrollNav(-1)}
                aria-label="Прокрутить меню влево"
                className="bg-card hover:bg-secondary relative z-10 flex size-7 items-center justify-center rounded-full border shadow-sm transition-colors"
              >
                <ChevronLeft className="size-4" />
              </button>
            </div>
          )}
          {canScrollRight && (
            <div className="absolute inset-y-0 right-0 flex items-center">
              <div aria-hidden className="from-background absolute inset-y-0 right-0 w-12 bg-linear-to-l to-transparent" />
              <button
                onClick={() => scrollNav(1)}
                aria-label="Прокрутить меню вправо"
                className="bg-card hover:bg-secondary relative z-10 flex size-7 items-center justify-center rounded-full border shadow-sm transition-colors"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-1 items-center justify-end gap-2 lg:flex-none">
          {/* Два кошелька: XP модерации и игровой XP */}
          <span
            className="bg-secondary inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm"
            title="XP модерации — за отчёты, тратится в магазине"
          >
            <Zap className="text-amber-deep size-3.5" />
            <span className="font-display text-xs font-semibold tabular-nums">{xp.modXp}</span>
            <span className="text-muted-foreground hidden text-xs sm:inline">XP</span>
          </span>
          <span
            className="bg-secondary hidden items-center gap-1.5 rounded-full px-3 py-1.5 text-sm sm:inline-flex"
            title="Игровой XP — за тренажёры и квесты, тратится на игры"
          >
            <Gamepad2 className="text-green-deep size-3.5" />
            <span className="font-display text-xs font-semibold tabular-nums">{xp.gameXp}</span>
          </span>

          <button
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            aria-label="Переключить тему"
            className="border-input bg-secondary relative h-8 w-14 rounded-full border"
          >
            <span className="bg-card absolute top-0.5 left-0.5 flex size-[26px] items-center justify-center rounded-full shadow-sm transition-transform duration-400 ease-out dark:translate-x-6">
              <Sun className="size-3.5 dark:hidden" />
              <Moon className="hidden size-3.5 dark:block" />
            </span>
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="gap-2 px-1.5" aria-label="Меню профиля">
                <span className="bg-linear-to-br from-green-bright to-green-deep text-primary-foreground font-display flex size-8 items-center justify-center rounded-xl text-xs font-bold">
                  {nickname.slice(0, 1).toUpperCase()}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel>
                <div className="text-sm">{nickname}</div>
                <div className="text-muted-foreground text-xs font-normal">{roleLabel}</div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push("/profile")}>Профиль</DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={async () => {
                  await signOut();
                  router.replace("/login");
                }}
              >
                <LogOut className="size-4" />
                Выйти
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}

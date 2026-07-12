"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Gamepad2,
  Cherry,
  CircleDollarSign,
  Vault,
  Rocket,
  Package,
  Dices,
  Gem,
  TrendingUp,
  LifeBuoy,
  Shuffle,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth-provider";
import { getSupabase } from "@/lib/supabase/client";
import { addGameXp, addModXp } from "@/lib/xp";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RouletteGame } from "@/components/games/roulette-game";
import { CoinGame } from "@/components/games/coin-game";
import { SafesGame } from "@/components/games/safes-game";
import { CrashGame } from "@/components/games/crash-game";
import { DiceGame } from "@/components/games/dice-game";
import { MinesGame } from "@/components/games/mines-game";
import { HiloGame } from "@/components/games/hilo-game";
import { WheelGame } from "@/components/games/wheel-game";
import { ShellsGame } from "@/components/games/shells-game";
import { CasesGame } from "@/components/games/cases-game";

const GAMES: {
  id: string;
  title: string;
  desc: string;
  icon: LucideIcon;
  cost: number;
}[] = [
  { id: "roulette", title: "Рулетка Модерации", desc: "100 XP · выиграй до 500 XP", icon: Cherry, cost: 100 },
  { id: "coin", title: "Орёл или Решка", desc: "500 XP · угадай и удвой", icon: CircleDollarSign, cost: 500 },
  { id: "safes", title: "Три Сейфа", desc: "400 XP · найди куш x3", icon: Vault, cost: 400 },
  { id: "crash", title: "Ракетка (Краш)", desc: "100 XP · забери до краша", icon: Rocket, cost: 100 },
  { id: "cases", title: "Кейсы", desc: "300 XP · открывай кейсы", icon: Package, cost: 300 },
  { id: "dice", title: "Кости", desc: "150 XP · брось больше дилера", icon: Dices, cost: 150 },
  { id: "mines", title: "Мины (Алмазы)", desc: "300 XP · найди 3 алмаза", icon: Gem, cost: 300 },
  { id: "hilo", title: "Больше / Меньше", desc: "100 XP · угадай число", icon: TrendingUp, cost: 100 },
  { id: "wheel", title: "Колесо Иксов", desc: "250 XP · множитель до 5x", icon: LifeBuoy, cost: 250 },
  { id: "shells", title: "Напёрстки", desc: "200 XP · найди мяч x2.5", icon: Shuffle, cost: 200 },
];

type GameId =
  | "roulette"
  | "coin"
  | "safes"
  | "crash"
  | "cases"
  | "dice"
  | "mines"
  | "hilo"
  | "wheel"
  | "shells";

type Wallet = "game" | "mod";

export function GamesClient() {
  const { user, xp, refreshXp } = useAuth();
  const [active, setActive] = useState<GameId | null>(null);
  const [paying, setPaying] = useState(false);
  // Выбор валюты: игровые XP или реальные (XP модерации).
  // Ставка и выигрыш ВСЕГДА в одной и той же валюте.
  const [wallet, setWallet] = useState<Wallet>("game");

  const balance = wallet === "game" ? xp.gameXp : xp.modXp;
  const addDelta = wallet === "game" ? addGameXp : addModXp;
  const walletName = wallet === "game" ? "игровых XP" : "XP модерации";

  const openGame = async (id: string, cost: number) => {
    if (!user) return;
    if (balance < cost) {
      toast.error(
        wallet === "game"
          ? `Не хватает игрового XP: нужно ${cost}. Заработай в тренажёрах!`
          : `Не хватает XP модерации: нужно ${cost}. Сдавай отчёты!`
      );
      return;
    }
    setPaying(true);
    try {
      const game = GAMES.find((g) => g.id === id)!;
      await addDelta(getSupabase(), user.id, -cost, `Игра: ${game.title}`);
      await refreshXp();
      setActive(id as GameId);
    } catch {
      toast.error("Не удалось оплатить игру");
    } finally {
      setPaying(false);
    }
  };

  const onResult = async (delta: number, label: string) => {
    if (!user) return;
    try {
      if (delta !== 0) {
        await addDelta(getSupabase(), user.id, delta, label);
      }
      await refreshXp();
    } catch {
      toast.error("Не удалось начислить результат");
    }
  };

  const activeGame = GAMES.find((g) => g.id === active);

  return (
    <div className="flex flex-col gap-6">
      {/* Баннер с аркадной иллюстрацией */}
      <div className="relative min-h-36 overflow-hidden rounded-2xl border md:min-h-44">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/games-arcade.png"
          alt=""
          aria-hidden
          className="absolute inset-0 size-full object-cover object-right"
        />
        <div className="absolute inset-0 bg-linear-to-r from-black/80 via-black/40 to-transparent" />
        <div className="relative flex min-h-36 flex-wrap items-center justify-between gap-3 p-6 md:min-h-44 md:p-8">
          <div className="flex items-center gap-3">
            <span className="bg-primary/20 text-primary flex size-10 shrink-0 items-center justify-center rounded-xl backdrop-blur-sm">
              <Gamepad2 className="size-5" />
            </span>
            <div>
              <h1 className="font-display text-xl font-bold tracking-tight text-white md:text-2xl">Игры</h1>
              <p className="text-sm text-white/70">Ставка и выигрыш — в выбранной валюте</p>
            </div>
          </div>
          <div className="bg-primary text-primary-foreground rounded-xl px-4 py-2 text-sm font-bold tabular-nums">
            {balance} {walletName}
          </div>
        </div>
      </div>

      {/* Переключатель валюты: на что играем */}
      <div className="bg-card flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-3">
        <p className="text-muted-foreground px-1 text-sm">Играть на:</p>
        <div className="bg-secondary flex rounded-xl p-1">
          <button
            onClick={() => setWallet("game")}
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-semibold transition-colors",
              wallet === "game" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            Игровые XP · {xp.gameXp}
          </button>
          <button
            onClick={() => setWallet("mod")}
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-semibold transition-colors",
              wallet === "mod" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            Реальные XP · {xp.modXp}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {GAMES.map((g, i) => (
          <motion.button
            key={g.id}
            type="button"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, type: "spring", stiffness: 260, damping: 22 }}
            whileHover={{ y: -4, scale: 1.02 }}
            whileTap={{ scale: 0.96 }}
            onClick={() => openGame(g.id, g.cost)}
            disabled={paying}
            className="text-left"
          >
            <Card className="hover:border-primary/40 h-full cursor-pointer rounded-2xl transition-colors">
              <CardContent className="flex h-full flex-col gap-2 p-4 md:p-5">
                <span
                  aria-hidden
                  className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-xl"
                >
                  <g.icon className="size-5" />
                </span>
                <h3 className="text-sm font-semibold">{g.title}</h3>
                <p className="text-muted-foreground text-xs">{g.desc}</p>
              </CardContent>
            </Card>
          </motion.button>
        ))}
      </div>

      <Dialog open={active !== null} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{activeGame?.title}</DialogTitle>
          </DialogHeader>
          {active === "roulette" && <RouletteGame onResult={onResult} onClose={() => setActive(null)} />}
          {active === "coin" && <CoinGame onResult={onResult} onClose={() => setActive(null)} />}
          {active === "safes" && <SafesGame onResult={onResult} onClose={() => setActive(null)} />}
          {active === "crash" && <CrashGame onResult={onResult} onClose={() => setActive(null)} />}
          {active === "cases" && <CasesGame onResult={onResult} onClose={() => setActive(null)} />}
          {active === "dice" && <DiceGame onResult={onResult} onClose={() => setActive(null)} />}
          {active === "mines" && <MinesGame onResult={onResult} onClose={() => setActive(null)} />}
          {active === "hilo" && <HiloGame onResult={onResult} onClose={() => setActive(null)} />}
          {active === "wheel" && <WheelGame onResult={onResult} onClose={() => setActive(null)} />}
          {active === "shells" && <ShellsGame onResult={onResult} onClose={() => setActive(null)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

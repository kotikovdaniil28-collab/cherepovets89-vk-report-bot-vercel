"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { ShieldCheck, Loader2, Zap, Trophy, GraduationCap } from "lucide-react";
import { getSupabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const NeonScene = dynamic(
  () => import("@/components/three/neon-scene").then((m) => m.NeonScene),
  { ssr: false }
);

type Mode = "login" | "register" | "reset";

const FEATURES = [
  { icon: Zap, text: "XP за отчёты и активность" },
  { icon: Trophy, text: "Лидерборд и магазин наград" },
  { icon: GraduationCap, text: "Тренажёры, квизы и квесты" },
];

export function LoginClient() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    const supa = getSupabase();
    try {
      if (mode === "login") {
        const { error } = await supa.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Добро пожаловать!");
        router.replace("/");
      } else if (mode === "register") {
        const { error } = await supa.auth.signUp({
          email,
          password,
          options: { data: { nickname } },
        });
        if (error) throw error;
        toast.success("Аккаунт создан. Проверьте почту для подтверждения.");
        setMode("login");
      } else {
        const { error } = await supa.auth.resetPasswordForEmail(email);
        if (error) throw error;
        toast.success("Письмо для сброса пароля отправлено.");
        setMode("login");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка авторизации");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="bg-background relative min-h-svh overflow-hidden lg:grid lg:grid-cols-[1.15fr_1fr]">
      {/* ===== Левая половина: 3D-сцена ===== */}
      <section className="relative hidden lg:block" aria-hidden>
        <NeonScene className="absolute inset-0" />
        {/* Градиент-переход к форме */}
        <div className="to-background pointer-events-none absolute inset-0 bg-linear-to-r from-transparent via-transparent" />
        {/* Затемнение снизу-слева для читаемости текста поверх 3D */}
        <div className="from-background/85 pointer-events-none absolute inset-0 bg-linear-to-tr via-transparent to-transparent" />

        <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-10">
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="flex items-center gap-2.5"
          >
            <span className="bg-linear-to-br from-green-bright to-green-deep text-primary-foreground glow-primary flex size-10 items-center justify-center rounded-xl">
              <ShieldCheck className="size-5" />
            </span>
            <span className="font-mono text-xs tracking-[0.25em] uppercase opacity-70">
              sys.online // mod.ready
            </span>
          </motion.div>

          <div>
            <motion.h1
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.15 }}
              className="font-display text-glow max-w-md text-4xl font-extrabold tracking-tight text-balance xl:text-5xl"
            >
              CHEREPOVETS
              <span className="text-primary block text-xl font-semibold tracking-[0.3em] xl:text-2xl">
                МОДЕРАЦИЯ
              </span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.3 }}
              className="text-foreground/75 mt-4 max-w-sm text-sm leading-relaxed text-pretty drop-shadow-md"
            >
              Порядок на сервере — наша работа. Отчёты, проверки, рейтинги и обучение — всё в
              одной панели.
            </motion.p>

            <motion.ul
              initial="hidden"
              animate="show"
              variants={{ show: { transition: { staggerChildren: 0.12, delayChildren: 0.45 } } }}
              className="mt-6 flex flex-col gap-2.5"
            >
              {FEATURES.map(({ icon: Icon, text }) => (
                <motion.li
                  key={text}
                  variants={{
                    hidden: { opacity: 0, x: -16 },
                    show: { opacity: 1, x: 0, transition: { duration: 0.45 } },
                  }}
                  className="text-foreground/80 flex items-center gap-2.5 text-sm"
                >
                  <span className="bg-primary/12 text-primary flex size-7 items-center justify-center rounded-lg">
                    <Icon className="size-3.5" />
                  </span>
                  {text}
                </motion.li>
              ))}
            </motion.ul>
          </div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            transition={{ delay: 0.8 }}
            className="font-mono text-[10px] tracking-[0.2em] uppercase"
          >
            v58 // internal tool // access restricted
          </motion.p>
        </div>
      </section>

      {/* ===== Правая половина: форма ===== */}
      <section className="relative flex min-h-svh items-center justify-center p-4 lg:p-10">
        {/* Мобильный фон-сетка */}
        <div aria-hidden className="bg-grid-pattern absolute inset-0 [mask-image:radial-gradient(100%_70%_at_50%_30%,black_20%,transparent_80%)] lg:hidden" />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="relative w-full max-w-sm"
        >
          {/* Шапка — на мобильном */}
          <div className="mb-8 flex flex-col items-center gap-3 lg:hidden">
            <span className="bg-linear-to-br from-green-bright to-green-deep text-primary-foreground animate-pulse-glow flex size-14 items-center justify-center rounded-2xl">
              <ShieldCheck className="size-7" />
            </span>
            <div className="text-center">
              <h1 className="font-display text-xl font-extrabold tracking-tight">CHEREPOVETS</h1>
              <p className="text-muted-foreground font-mono text-[10px] tracking-[0.3em] uppercase">
                Модерация
              </p>
            </div>
          </div>

          <div className="glass-panel glow-primary rounded-3xl p-6 sm:p-8">
            <AnimatePresence mode="wait">
              <motion.div
                key={mode}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.22 }}
              >
                <h2 className="font-display text-lg font-bold">
                  {mode === "login" ? "Вход в панель" : mode === "register" ? "Регистрация" : "Сброс пароля"}
                </h2>
                <p className="text-muted-foreground mt-1 text-sm">
                  {mode === "login"
                    ? "Войдите в рабочий аккаунт"
                    : mode === "register"
                      ? "Создайте новый аккаунт"
                      : "Укажите email для восстановления"}
                </p>
              </motion.div>
            </AnimatePresence>

            <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
              <AnimatePresence mode="popLayout">
                {mode === "register" && (
                  <motion.div
                    key="nickname"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex flex-col gap-2"
                  >
                    <Label htmlFor="nickname">Игровой ник</Label>
                    <Input
                      id="nickname"
                      value={nickname}
                      onChange={(e) => setNickname(e.target.value)}
                      placeholder="Ivan_Petrov"
                      required
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex flex-col gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                />
              </div>

              {mode !== "reset" && (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="password">Пароль</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    minLength={6}
                    required
                  />
                </div>
              )}

              <motion.div whileHover={{ scale: 1.015 }} whileTap={{ scale: 0.985 }}>
                <Button type="submit" disabled={busy} className="glow-primary w-full font-semibold">
                  {busy && <Loader2 className="size-4 animate-spin" />}
                  {mode === "login" ? "Войти" : mode === "register" ? "Создать аккаунт" : "Отправить письмо"}
                </Button>
              </motion.div>
            </form>

            <div className="text-muted-foreground mt-5 flex flex-col gap-1.5 text-center text-sm">
              {mode === "login" ? (
                <>
                  <button
                    className="hover:text-primary transition-colors"
                    onClick={() => setMode("register")}
                  >
                    Нет аккаунта? Зарегистрироваться
                  </button>
                  <button
                    className="hover:text-primary transition-colors"
                    onClick={() => setMode("reset")}
                  >
                    Забыли пароль?
                  </button>
                </>
              ) : (
                <button
                  className="hover:text-primary transition-colors"
                  onClick={() => setMode("login")}
                >
                  Вернуться ко входу
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </section>
    </main>
  );
}

"use client";

import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { Bot, Loader2, Send, User } from "lucide-react";
import { getSupabase } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Msg = { role: "user" | "assistant"; text: string };

/** AI-помощник по инструкции модерации (DeepSeek через серверный роут) */
export function AiAssistant({ instruction }: { instruction: string }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  async function ask() {
    const question = input.trim();
    if (!question || busy) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", text: question }]);
    setBusy(true);
    try {
      const { data } = await getSupabase().auth.getSession();
      const token = data.session?.access_token;
      const res = await fetch("/api/ai/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ question, instruction }),
      });
      const json = await res.json();
      setMessages((m) => [
        ...m,
        { role: "assistant", text: res.ok ? json.answer : `Ошибка: ${json.error}` },
      ]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", text: "Ошибка сети — попробуй ещё раз." }]);
    } finally {
      setBusy(false);
      setTimeout(() => listRef.current?.scrollTo({ top: 1e6, behavior: "smooth" }), 50);
    }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <Card>
        <CardContent className="flex flex-col gap-4 p-5">
          <div className="flex items-center gap-2.5">
            <span className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-xl">
              <Bot className="size-4.5" />
            </span>
            <div>
              <h2 className="font-display text-sm font-bold">AI-помощник</h2>
              <p className="text-muted-foreground text-xs">
                Задай вопрос по инструкции модерации — ответит DeepSeek
              </p>
            </div>
          </div>

          {messages.length > 0 && (
            <div ref={listRef} className="flex max-h-80 flex-col gap-2.5 overflow-y-auto">
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={cn("flex gap-2", m.role === "user" ? "justify-end" : "justify-start")}
                >
                  {m.role === "assistant" && (
                    <span className="bg-primary/10 text-primary mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full">
                      <Bot className="size-3.5" />
                    </span>
                  )}
                  <div
                    className={cn(
                      "max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed whitespace-pre-wrap",
                      m.role === "user"
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : "bg-secondary rounded-bl-sm",
                    )}
                  >
                    {m.text}
                  </div>
                  {m.role === "user" && (
                    <span className="bg-secondary text-muted-foreground mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full">
                      <User className="size-3.5" />
                    </span>
                  )}
                </div>
              ))}
              {busy && (
                <div className="text-muted-foreground flex items-center gap-2 text-xs">
                  <Loader2 className="size-3.5 animate-spin" />
                  Думаю...
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (
                  e.key === "Enter" &&
                  !e.shiftKey &&
                  !e.nativeEvent.isComposing &&
                  e.keyCode !== 229
                ) {
                  e.preventDefault();
                  void ask();
                }
              }}
              placeholder="Например: что делать с нарушителем в голосовом чате?"
              className="border-input bg-background focus-visible:ring-ring/50 h-10 min-w-0 flex-1 rounded-xl border px-3.5 text-sm outline-none focus-visible:ring-2"
              aria-label="Вопрос AI-помощнику"
            />
            <Button onClick={() => void ask()} disabled={busy || !input.trim()} size="icon" className="size-10 shrink-0 rounded-xl">
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              <span className="sr-only">Отправить</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

"use client";

import { useEffect, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { BookOpen } from "lucide-react";
import { getSupabase } from "@/lib/supabase/client";
import { INSTRUCTION_ROW, loadInstruction } from "@/lib/instructions";
import { AiAssistant } from "@/components/help/ai-assistant";
import { Card, CardContent } from "@/components/ui/card";

// Безопасный рендер простого Markdown в React-элементы (без innerHTML)
function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const regex = /\*\*(.+?)\*\*|`(.+?)`/g;
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > lastIndex) parts.push(text.slice(lastIndex, m.index));
    if (m[1] !== undefined) {
      parts.push(<strong key={`${keyPrefix}-b${k++}`}>{m[1]}</strong>);
    } else if (m[2] !== undefined) {
      parts.push(
        <code key={`${keyPrefix}-c${k++}`} className="bg-muted rounded px-1 py-0.5 font-mono text-xs">
          {m[2]}
        </code>
      );
    }
    lastIndex = m.index + m[0].length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}

function MarkdownLite({ text }: { text: string }) {
  const lines = text.split("\n");
  const blocks: ReactNode[] = [];
  let listItems: string[] = [];
  let key = 0;

  const flushList = () => {
    if (listItems.length > 0) {
      blocks.push(
        <ul key={`ul-${key++}`} className="list-disc space-y-1 pl-6 text-sm leading-relaxed">
          {listItems.map((item, i) => (
            <li key={i}>{renderInline(item, `li-${key}-${i}`)}</li>
          ))}
        </ul>
      );
      listItems = [];
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const trimmed = line.trim();
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      listItems.push(trimmed.slice(2));
      continue;
    }
    flushList();
    if (trimmed.startsWith("### ")) {
      blocks.push(
        <h4 key={`h-${key++}`} className="pt-2 text-sm font-semibold">
          {renderInline(trimmed.slice(4), `h4-${key}`)}
        </h4>
      );
    } else if (trimmed.startsWith("## ")) {
      blocks.push(
        <h3 key={`h-${key++}`} className="pt-3 text-base font-semibold">
          {renderInline(trimmed.slice(3), `h3-${key}`)}
        </h3>
      );
    } else if (trimmed.startsWith("# ")) {
      blocks.push(
        <h2 key={`h-${key++}`} className="pt-3 text-lg font-bold">
          {renderInline(trimmed.slice(2), `h2-${key}`)}
        </h2>
      );
    } else if (trimmed === "") {
      blocks.push(<div key={`sp-${key++}`} className="h-1" />);
    } else {
      blocks.push(
        <p key={`p-${key++}`} className="text-sm leading-relaxed">
          {renderInline(trimmed, `p-${key}`)}
        </p>
      );
    }
  }
  flushList();
  return <div className="flex flex-col gap-1.5">{blocks}</div>;
}

export function HelpClient() {
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    loadInstruction(getSupabase(), INSTRUCTION_ROW).then(setText);
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <span className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-xl">
          <BookOpen className="size-5" />
        </span>
        <div>
          <h1 className="font-display text-xl font-bold tracking-tight md:text-2xl">Инструкция</h1>
          <p className="text-muted-foreground text-sm">
            Правила и инструкции команды модерации Cherepovets 89
          </p>
        </div>
      </div>

      <AiAssistant instruction={text || ""} />

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <Card>
          <CardContent className="p-6">
            {text === null ? (
              <p className="text-muted-foreground text-sm">Загрузка…</p>
            ) : text.trim() === "" ? (
              <p className="text-muted-foreground text-sm">
                Инструкция ещё не заполнена. Руководство может добавить её в разделе
                «Администрирование».
              </p>
            ) : (
              <MarkdownLite text={text} />
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

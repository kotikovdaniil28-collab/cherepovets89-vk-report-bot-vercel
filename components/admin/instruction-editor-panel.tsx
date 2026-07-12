"use client";

import { useCallback, useEffect, useState } from "react";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { getSupabase } from "@/lib/supabase/client";
import {
  INSTRUCTION_ROW,
  REPORT_INSTRUCTION_ROW,
  loadInstruction,
  saveInstruction,
} from "@/lib/instructions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

function Editor({
  rowId,
  link,
  title,
  description,
}: {
  rowId: string;
  link: string;
  title: string;
  description: string;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setText(await loadInstruction(getSupabase(), rowId));
  }, [rowId]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    if (!text.trim()) {
      toast.error("Нельзя сохранить пустую инструкцию");
      return;
    }
    setBusy(true);
    try {
      await saveInstruction(getSupabase(), rowId, link, text.trim());
      toast.success("Инструкция сохранена");
    } catch {
      toast.error("Ошибка сохранения");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={12}
          className="font-mono text-xs"
          aria-label={title}
        />
        <Button onClick={save} disabled={busy} className="self-start">
          <Save className="size-4" /> Сохранить
        </Button>
      </CardContent>
    </Card>
  );
}

export function InstructionEditorPanel() {
  return (
    <div className="flex flex-col gap-4">
      <Editor
        rowId={INSTRUCTION_ROW}
        link="HELP_INSTRUCTION"
        title="Инструкция для модераторов"
        description="Отображается в разделе «Инструкция». Поддерживает простой Markdown (заголовки #, списки -, **жирный**)."
      />
      <Editor
        rowId={REPORT_INSTRUCTION_ROW}
        link="REPORT_CHECK_INSTRUCTION"
        title="Инструкция проверки отчётов"
        description="Правила, по которым проверяются отчёты (используется руководством при проверке)."
      />
    </div>
  );
}


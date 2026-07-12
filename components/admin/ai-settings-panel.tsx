"use client";

import { useEffect, useState } from "react";
import { Bot, Loader2, Save } from "lucide-react";
import { getSupabase } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Общий DeepSeek-ключ для AI-помощника — тот же KV-формат, что в старом сайте:
 * reports.id='t73_deepseek_ai_config_v167', date=JSON {apiKey, endpoint, model}.
 */
const ROW_ID = "t73_deepseek_ai_config_v167";
const DEFAULT_ENDPOINT = "https://api.deepseek.com/chat/completions";
const DEFAULT_MODEL = "deepseek-chat";

export function AiSettingsPanel() {
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [hasSaved, setHasSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    getSupabase()
      .from("reports")
      .select("date")
      .eq("id", ROW_ID)
      .maybeSingle()
      .then(({ data }) => {
        if (!data?.date) return;
        try {
          const cfg = JSON.parse(String(data.date));
          setHasSaved(Boolean(cfg.apiKey));
          if (cfg.model) setModel(String(cfg.model));
        } catch {
          /* строка старого формата */
        }
      });
  }, []);

  async function save() {
    const key = apiKey.trim();
    if (!key) {
      setStatus("Вставьте API-ключ (DeepSeek «sk-...» или xAI «xai-...»).");
      return;
    }
    setBusy(true);
    setStatus("");
    try {
      const supa = getSupabase();
      // xAI-ключи получают свой endpoint и модель автоматически
      const isXai = key.startsWith("xai-");
      const cfg = {
        apiKey: key,
        endpoint: isXai ? "https://api.x.ai/v1/chat/completions" : DEFAULT_ENDPOINT,
        model: model.trim() || (isXai ? "grok-3-mini" : DEFAULT_MODEL),
      };
      const row = {
        id: ROW_ID,
        email: "ACCESS_KEY",
        link: "DEEPSEEK_AI_CONFIG",
        date: JSON.stringify(cfg),
        status: "deepseek_ai_config",
        xp: 0,
      };
      const { error } = await supa.from("reports").upsert([row], { onConflict: "id" });
      if (error) throw error;
      setHasSaved(true);
      setApiKey("");
      setStatus("Ключ сохранён — AI-помощник в разделе «Гайд» готов к работе.");
    } catch (e) {
      setStatus(`Не удалось сохранить: ${e instanceof Error ? e.message : "ошибка"}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-5">
        <div className="flex items-center gap-2.5">
          <span className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-xl">
            <Bot className="size-4.5" />
          </span>
          <div>
            <h2 className="font-display text-sm font-bold">AI-помощник (DeepSeek / Grok)</h2>
            <p className="text-muted-foreground text-xs">
              {hasSaved
                ? "Ключ настроен. Можно заменить на новый."
                : "Ключ не настроен — AI-помощник в «Гайде» не работает."}
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ds-key">API-ключ (DeepSeek или xAI/Grok)</Label>
          <Input
            id="ds-key"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-..."
            autoComplete="off"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ds-model">Модель</Label>
          <Input
            id="ds-model"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder={DEFAULT_MODEL}
          />
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={() => void save()} disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Сохранить
          </Button>
          {status && <p className="text-muted-foreground text-xs">{status}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

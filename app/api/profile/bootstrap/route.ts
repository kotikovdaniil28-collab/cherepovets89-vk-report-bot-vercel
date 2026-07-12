import { NextRequest, NextResponse } from "next/server";
import { getServiceClient, getAnonServerClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// Создаёт/обновляет строку user_stats для текущего пользователя.
// Клиентские записи в user_stats запрещены RLS, поэтому используется service role.
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const anon = getAnonServerClient();
    const { data: userData, error: userErr } = await anon.auth.getUser(token);
    if (userErr || !userData?.user) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }
    const user = userData.user;

    const body = (await req.json().catch(() => ({}))) as { nickname?: string };
    const requestedNick = typeof body.nickname === "string" ? body.nickname.trim().slice(0, 64) : "";

    const service = getServiceClient();
    const { data: existing } = await service
      .from("user_stats")
      .select("user_id, nickname")
      .eq("user_id", user.id)
      .maybeSingle();

    const metaNick = ((user.user_metadata?.nickname as string) || "").trim().slice(0, 64);
    const emailPrefix = user.email?.split("@")[0] || "";

    let nickname: string | null = null;

    if (requestedNick) {
      // Явное переименование из профиля
      nickname = requestedNick;
    } else if (!existing) {
      nickname = metaNick || emailPrefix;
    } else if (metaNick && (!existing.nickname || existing.nickname === emailPrefix) && existing.nickname !== metaNick) {
      // Строка создана триггером с ником из email — заменяем на ник из регистрации
      nickname = metaNick;
    }

    if (nickname === null && existing) {
      return NextResponse.json({ ok: true, nickname: existing.nickname });
    }

    const { error: upsertErr } = await service
      .from("user_stats")
      .upsert(
        { user_id: user.id, email: user.email, nickname: nickname || emailPrefix },
        { onConflict: "user_id" }
      );
    if (upsertErr) {
      return NextResponse.json({ error: upsertErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, nickname: nickname || emailPrefix });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Internal error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

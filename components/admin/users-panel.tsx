"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Search, Zap, Coins, UserCog } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth-provider";
import { getSupabase } from "@/lib/supabase/client";
import { KV, type AdminRole, type UserKind } from "@/lib/constants";
import { makeId } from "@/lib/reports";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type UserRow = {
  user_id: string;
  nickname: string;
  email: string;
};

type RoleRow = { link: string; status: string };

const ADMIN_ROLE_LABELS: Record<string, string> = {
  leadership: "Руководство модерации",
  ap_admin: "Руководство АП",
  fsb_admin: "Руководство ФСБ",
};

const KIND_LABELS: Record<string, string> = {
  moderator: "Модератор",
  ap: "АП",
  fsb: "ФСБ",
};

export function UsersPanel() {
  const { user: me, roles: myRoles } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [adminRoles, setAdminRoles] = useState<Map<string, Set<string>>>(new Map());
  const [kinds, setKinds] = useState<Map<string, Set<string>>>(new Map());
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<UserRow | null>(null);
  const [grantAmount, setGrantAmount] = useState("");
  const [grantReason, setGrantReason] = useState("");
  const [grantType, setGrantType] = useState<"xp" | "game">("xp");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const supa = getSupabase();
    const [usersRes, adminRes, kindRes] = await Promise.all([
      supa.from("user_stats").select("user_id,nickname,email").order("nickname"),
      supa.from("reports").select("link,status").eq("email", KV.ADMIN_ROLE),
      supa.from("reports").select("link,status").eq("email", KV.USER_ROLE),
    ]);
    setUsers((usersRes.data || []) as UserRow[]);
    const am = new Map<string, Set<string>>();
    for (const r of (adminRes.data || []) as RoleRow[]) {
      if (!am.has(r.link)) am.set(r.link, new Set());
      am.get(r.link)!.add(String(r.status));
    }
    setAdminRoles(am);
    const km = new Map<string, Set<string>>();
    for (const r of (kindRes.data || []) as RoleRow[]) {
      if (!km.has(r.link)) km.set(r.link, new Set());
      km.get(r.link)!.add(String(r.status));
    }
    setKinds(km);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) => u.nickname?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q)
    );
  }, [users, query]);

  const toggleAdminRole = async (u: UserRow, role: AdminRole) => {
    if (!myRoles.isCreator && !myRoles.isLeadership) {
      toast.error("Недостаточно прав");
      return;
    }
    setBusy(true);
    try {
      const supa = getSupabase();
      const has = adminRoles.get(u.user_id)?.has(role);
      if (has) {
        await supa.from("reports").delete().eq("email", KV.ADMIN_ROLE).eq("link", u.user_id).eq("status", role);
      } else {
        await supa.from("reports").insert([
          {
            id: makeId("arole_"),
            email: KV.ADMIN_ROLE,
            link: u.user_id,
            date: new Date().toLocaleString("ru-RU"),
            status: role,
            xp: 0,
          },
        ]);
      }
      await load();
      toast.success(has ? "Роль снята" : "Роль выдана");
    } catch {
      toast.error("Ошибка изменения роли");
    } finally {
      setBusy(false);
    }
  };

  const toggleKind = async (u: UserRow, kind: UserKind) => {
    setBusy(true);
    try {
      const supa = getSupabase();
      const has = kinds.get(u.user_id)?.has(kind);
      if (has) {
        await supa.from("reports").delete().eq("email", KV.USER_ROLE).eq("link", u.user_id).eq("status", kind);
      } else {
        await supa.from("reports").insert([
          {
            id: makeId("urole_"),
            email: KV.USER_ROLE,
            link: u.user_id,
            date: new Date().toLocaleString("ru-RU"),
            status: kind,
            xp: 0,
          },
        ]);
      }
      await load();
      toast.success(has ? "Тип снят" : "Тип выдан");
    } catch {
      toast.error("Ошибка изменения типа");
    } finally {
      setBusy(false);
    }
  };

  const grant = async () => {
    if (!selected) return;
    const amount = Number(grantAmount);
    if (!Number.isFinite(amount) || amount === 0) {
      toast.error("Введите число (можно отрицательное для списания)");
      return;
    }
    setBusy(true);
    try {
      const supa = getSupabase();
      const reason = grantReason.trim();
      // Кошельки считаются из строк GAME_XP: status='mod' → XP модерации, status='game' → игровые
      const { error } = await supa.from("reports").insert([
        {
          id: makeId(grantType === "xp" ? "mxp_" : "mgxp_"),
          email: KV.GAME_XP,
          link: selected.user_id,
          date: reason || (grantType === "xp" ? "Ручная выдача XP" : "Ручная выдача игровых XP"),
          status: grantType === "xp" ? "mod" : "game",
          xp: amount,
        },
      ]);
      if (error) throw new Error(error.message);
      toast.success(
        `Начислено ${amount} ${grantType === "xp" ? "XP" : "игровых XP"} для ${selected.nickname}`
      );
      setGrantAmount("");
      setGrantReason("");
    } catch {
      toast.error("Ошибка начисления");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="relative max-w-sm">
        <Search className="text-muted-foreground absolute left-2.5 top-1/2 size-4 -translate-y-1/2" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск по нику или email…"
          className="pl-8"
          aria-label="Поиск пользователя"
        />
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((u, i) => {
          const ar = adminRoles.get(u.user_id) || new Set();
          const uk = kinds.get(u.user_id) || new Set();
          return (
            <motion.div
              key={u.user_id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.02, 0.3) }}
            >
              <Card>
                <CardContent className="flex flex-col gap-2 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{u.nickname || "Без ника"}</div>
                      <div className="text-muted-foreground truncate text-xs">{u.email}</div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSelected(u)}
                      disabled={u.user_id === me?.id && !myRoles.isCreator}
                    >
                      <UserCog className="size-4" /> Управлять
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {[...ar].map((r) => (
                      <Badge key={r} variant="default" className="text-[10px]">
                        {ADMIN_ROLE_LABELS[r] || r}
                      </Badge>
                    ))}
                    {[...uk].map((k) => (
                      <Badge key={k} variant="secondary" className="text-[10px]">
                        {KIND_LABELS[k] || k}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
        {filtered.length === 0 && (
          <p className="text-muted-foreground col-span-full py-8 text-center text-sm">
            Пользователи не найдены
          </p>
        )}
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selected?.nickname || selected?.email}</DialogTitle>
            <DialogDescription>Роли и начисления</DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="flex flex-col gap-5">
              {(myRoles.isCreator || myRoles.isLeadership) && (
                <div className="flex flex-col gap-2">
                  <Label>Административные роли</Label>
                  <div className="flex flex-wrap gap-2">
                    {(Object.keys(ADMIN_ROLE_LABELS) as AdminRole[]).map((r) => {
                      const has = adminRoles.get(selected.user_id)?.has(r);
                      return (
                        <Button
                          key={r}
                          size="sm"
                          variant={has ? "default" : "outline"}
                          disabled={busy}
                          onClick={() => toggleAdminRole(selected, r)}
                        >
                          {ADMIN_ROLE_LABELS[r]}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-2">
                <Label>Тип пользователя</Label>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(KIND_LABELS) as UserKind[]).map((k) => {
                    const has = kinds.get(selected.user_id)?.has(k);
                    return (
                      <Button
                        key={k}
                        size="sm"
                        variant={has ? "default" : "outline"}
                        disabled={busy}
                        onClick={() => toggleKind(selected, k)}
                      >
                        {KIND_LABELS[k]}
                      </Button>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Label>Начисление / списание</Label>
                <div className="flex gap-2">
                  <Select value={grantType} onValueChange={(v) => setGrantType(v as typeof grantType)}>
                    <SelectTrigger className="w-44">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="xp">
                        <Zap className="size-4" /> XP модерации
                      </SelectItem>
                      <SelectItem value="game">
                        <Coins className="size-4" /> Игровые XP
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    value={grantAmount}
                    onChange={(e) => setGrantAmount(e.target.value)}
                    placeholder="Сумма, напр. 50 или -20"
                    inputMode="numeric"
                    aria-label="Сумма начисления"
                  />
                </div>
                <Input
                  value={grantReason}
                  onChange={(e) => setGrantReason(e.target.value)}
                  placeholder="Причина (необязательно)"
                  aria-label="Причина начисления"
                />
                <Button onClick={grant} disabled={busy}>
                  Начислить
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

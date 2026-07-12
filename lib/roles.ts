import type { SupabaseClient, User } from "@supabase/supabase-js";
import { CREATOR_EMAIL, LEADERSHIP_EMAILS, KV, type AdminRole, type UserKind } from "@/lib/constants";

export type RoleInfo = {
  isCreator: boolean;
  isLeadership: boolean; // руководство модерации
  isApAdmin: boolean; // руководство АП
  isFsbAdmin: boolean; // руководство ФСБ
  kinds: Set<UserKind>; // moderator | ap | fsb
  adminRoles: Set<AdminRole>;
};

export function emptyRoleInfo(): RoleInfo {
  return {
    isCreator: false,
    isLeadership: false,
    isApAdmin: false,
    isFsbAdmin: false,
    kinds: new Set(),
    adminRoles: new Set(),
  };
}

export async function resolveRoles(supa: SupabaseClient, user: User): Promise<RoleInfo> {
  const info = emptyRoleInfo();
  const email = (user.email || "").toLowerCase();
  info.isCreator = email === CREATOR_EMAIL;
  if (LEADERSHIP_EMAILS.has(email)) info.isLeadership = true;

  const [adminRes, kindRes] = await Promise.all([
    supa.from("reports").select("status").eq("email", KV.ADMIN_ROLE).eq("link", user.id),
    supa.from("reports").select("status").eq("email", KV.USER_ROLE).eq("link", user.id),
  ]);

  for (const row of adminRes.data || []) {
    const s = String(row.status || "");
    if (s === "leadership") info.isLeadership = true;
    if (s === "ap_admin") info.isApAdmin = true;
    if (s === "fsb_admin") info.isFsbAdmin = true;
    if (s === "leadership" || s === "ap_admin" || s === "fsb_admin") info.adminRoles.add(s as AdminRole);
  }
  for (const row of kindRes.data || []) {
    const s = String(row.status || "");
    if (s === "moderator" || s === "ap" || s === "fsb") info.kinds.add(s as UserKind);
  }
  // Создатель имеет все права
  if (info.isCreator) {
    info.isLeadership = true;
    info.isApAdmin = true;
    info.isFsbAdmin = true;
  }
  return info;
}

export function isAnyAdmin(info: RoleInfo) {
  return info.isCreator || info.isLeadership || info.isApAdmin || info.isFsbAdmin;
}

/**
 * Состав: пользователь принят (модератор/АП/ФСБ через USER_ROLE от бота
 * «состав синхронизировать» или выдачу руководством) либо является админом.
 * Без этого доступен только профиль с VK-привязкой.
 */
export function isStaff(info: RoleInfo) {
  return info.kinds.size > 0 || isAnyAdmin(info);
}

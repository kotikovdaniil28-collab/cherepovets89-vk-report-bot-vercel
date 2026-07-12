// Уровень из XP — как в legacy: каждый уровень требует 100 XP * уровень
export function levelFromXp(totalXp: number) {
  let level = 1;
  let remaining = Math.max(0, totalXp);
  while (remaining >= level * 100) {
    remaining -= level * 100;
    level += 1;
  }
  const needed = level * 100;
  return {
    level,
    intoLevel: remaining,
    needed,
    progressPct: Math.min(100, Math.round((remaining / needed) * 100)),
  };
}

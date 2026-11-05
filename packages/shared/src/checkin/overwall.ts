export interface CheckInGrantRow {
  userId: string;
  amount: number;
  expiresAt: Date;
}

/** Soma grants ativos por usuário (ignora expirados). */
export function sumActiveCheckInGrants(
  grants: CheckInGrantRow[],
  now = new Date(),
): Map<string, number> {
  const byUser = new Map<string, number>();
  for (const grant of grants) {
    if (grant.expiresAt <= now) continue;
    byUser.set(grant.userId, (byUser.get(grant.userId) ?? 0) + grant.amount);
  }
  return byUser;
}

/** Mescla bônus de check-in ao mapa de power da escalação. */
export function mergeCheckInBonusIntoPower(
  powerByUser: Map<string, number>,
  bonusByUser: Map<string, number>,
): Map<string, number> {
  const merged = new Map(powerByUser);
  for (const [userId, bonus] of bonusByUser) {
    if (bonus <= 0) continue;
    merged.set(userId, (merged.get(userId) ?? 0) + bonus);
  }
  return merged;
}

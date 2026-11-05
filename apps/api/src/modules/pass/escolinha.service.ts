import type { PrismaClient } from '@prisma/client';
import { findRankForLevel, parsePassRankConfig, type PassRankConfigDTO } from '@mll/shared';
import { logger } from '../../common/lib/logger.js';
import { findConfiguredPassSeason, passLevelFromConfiguredXp } from './pass-season.service.js';

/**
 * Escolinha: jogadores Free-to-Play (sem premium) geram XP para si e para o
 * referrer ("dono"). O XP propagado ao dono é modulado pelo rank do F2P, que
 * é derivado do nível atual do passe.
 */
export class EscolinhaService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly grantOwnerXp: (ownerId: string, amount: number) => Promise<void>,
  ) {}

  async propagateXpToOwner(f2pUserId: string, baseXp: number): Promise<void> {
    if (baseXp <= 0) return;
    try {
      const f2p = await this.prisma.user.findUnique({
        where: { id: f2pUserId },
        select: { id: true, referredBy: true },
      });
      if (!f2p?.referredBy) return;

      const referrer = await this.prisma.user.findFirst({
        where: { referralCode: f2p.referredBy },
        select: { id: true },
      });
      if (!referrer) return;

      const season = await findConfiguredPassSeason(this.prisma);
      if (!season) return;

      const progress = await this.prisma.passProgress.findUnique({
        where: { userId_seasonId: { userId: f2pUserId, seasonId: season.id } },
        select: { xp: true, premium: true },
      });
      if (progress?.premium) return; // premium não conta como escolinha

      const xp = progress?.xp ?? 0;
      const level = passLevelFromConfiguredXp(xp, season.levels);
      const cfg = await this.loadRankConfig();
      const rank = findRankForLevel(level, cfg);
      const bonusXp = Math.floor(baseXp * (1 + rank.bonusPct));
      if (bonusXp <= 0) return;

      await this.grantOwnerXp(referrer.id, bonusXp);
    } catch (err) {
      logger.error({ err, f2pUserId, baseXp }, 'escolinha xp propagation failed');
    }
  }

  private async loadRankConfig(): Promise<PassRankConfigDTO> {
    const row = await this.prisma.platformConfig.findUnique({
      where: { id: 'default' },
      select: { passRankConfig: true },
    });
    return parsePassRankConfig(row?.passRankConfig);
  }
}

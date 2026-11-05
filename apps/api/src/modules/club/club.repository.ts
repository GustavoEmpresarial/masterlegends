import { PrismaClient, Prisma } from '@prisma/client';
import type { Building } from '@mll/shared';
import { MgtTxType, parseLineupAssignments } from '@mll/shared';
import { STAMINA_MAX } from '../../common/lib/stamina.js';
import { writeStaminaLedger } from '../stamina/stamina-ledger.js';
import { applyMgtDebit } from '../wallet/mgt-ledger.js';

export class ClubRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findByUserId(userId: string) {
    return this.prisma.club.findUnique({
      where: { userId },
      include: { user: { select: { wallet: true, referralCode: true } } },
    });
  }

  findByName(name: string) {
    return this.prisma.club.findUnique({ where: { name } });
  }

  async create(userId: string, name: string) {
    return this.prisma.$transaction(async (tx) => {
      const club = await tx.club.create({ data: { userId, name, lastFarmAt: new Date() } });
      await tx.mGTBalance.upsert({
        where: { userId },
        create: { userId, amount: new Prisma.Decimal(0), usdcAmount: new Prisma.Decimal(0) },
        update: {},
      });
      return club;
    });
  }

  async getInventory(userId: string, wallet: string | null | undefined) {
    const [nfts, basePlayers] = await Promise.all([
      wallet
        ? this.prisma.playerCache.findMany({
            where: { ownerWallet: wallet },
            orderBy: { overwall: 'desc' },
          })
        : Promise.resolve([]),
      this.prisma.basePlayer.findMany({
        where: { userId, retiredAt: null },
        orderBy: { overwall: 'desc' },
        include: { template: { select: { name: true, imageUrl: true } } },
      }),
    ]);
    return { nfts, basePlayers };
  }

  getBasePlayerOverwalls(userId: string) {
    return this.prisma.basePlayer.findMany({
      where: { userId },
      select: { overwall: true },
    });
  }

  /** Soma overwall dos jogadores escalados no estádio com stamina > 0. */
  async getLineupFarmOverwall(
    userId: string,
    clubId: string,
    wallet: string | null | undefined,
  ): Promise<number> {
    const lineup = await this.prisma.clubLineup.findUnique({ where: { clubId } });
    if (!lineup) return 0;

    const assignments = parseLineupAssignments(lineup.assignments);
    let power = 0;

    for (const a of Object.values(assignments)) {
      if (a.kind === 'base') {
        const player = await this.prisma.basePlayer.findFirst({
          where: { id: a.playerId, userId },
          select: { overwall: true, stamina: true },
        });
        if (player && player.stamina > 0) power += player.overwall;
      } else if (wallet) {
        const player = await this.prisma.playerCache.findFirst({
          where: { tokenId: BigInt(a.playerId), ownerWallet: wallet.toLowerCase() },
          select: { overwall: true, stamina: true },
        });
        if (player && player.stamina > 0) power += player.overwall;
      }
    }

    return power;
  }

  async getStadiumBonusPct(clubId: string): Promise<number> {
    const lineup = await this.prisma.clubLineup.findUnique({
      where: { clubId },
      include: { stadiumTemplate: { select: { farmBonusPct: true } } },
    });
    if (lineup?.stadiumTemplate) return Number(lineup.stadiumTemplate.farmBonusPct);
    const fallback = await this.prisma.stadiumTemplate.findFirst({
      where: { isDefault: true },
      select: { farmBonusPct: true },
    });
    return fallback ? Number(fallback.farmBonusPct) : 0;
  }

  getMgtBalance(userId: string) {
    return this.prisma.mGTBalance.findUnique({ where: { userId } });
  }

  async restoreAllStamina(
    userId: string,
    wallet: string | null | undefined,
    clubId: string,
    now: Date,
    points = 100,
  ) {
    const gain = Math.max(0, Math.min(STAMINA_MAX, Math.floor(points)));
    return this.prisma.$transaction(async (tx) => {
      const basePlayers = await tx.basePlayer.findMany({
        where: { userId },
        select: { id: true, stamina: true },
      });
      for (const player of basePlayers) {
        const staminaAfter = Math.min(STAMINA_MAX, player.stamina + gain);
        await tx.basePlayer.update({
          where: { id: player.id },
          data: { stamina: staminaAfter, staminaUpdatedAt: now },
        });
        await writeStaminaLedger(tx, {
          userId,
          playerKind: 'base',
          playerId: player.id,
          reason: 'daily_rest',
          before: player.stamina,
          after: staminaAfter,
        });
      }
      if (wallet) {
        const nfts = await tx.playerCache.findMany({
          where: { ownerWallet: wallet },
          select: { tokenId: true, stamina: true },
        });
        for (const player of nfts) {
          const staminaAfter = Math.min(STAMINA_MAX, player.stamina + gain);
          await tx.playerCache.update({
            where: { tokenId: player.tokenId },
            data: { stamina: staminaAfter, staminaUpdatedAt: now },
          });
          await writeStaminaLedger(tx, {
            userId,
            playerKind: 'nft',
            playerId: player.tokenId.toString(),
            reason: 'daily_rest',
            before: player.stamina,
            after: staminaAfter,
          });
        }
      }
      await tx.club.update({
        where: { id: clubId },
        data: { lastDailyRestAt: now },
      });
    });
  }

  async upgradeBuildingTx(
    userId: string,
    clubId: string,
    building: Building,
    cost: number,
    newLevel: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await applyMgtDebit(tx, userId, cost, MgtTxType.UPGRADE, { building, newLevel });
      await tx.club.update({
        where: { id: clubId },
        data: { [`${building}Lvl`]: newLevel },
      });
    });
  }
}

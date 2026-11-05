import type { PrismaClient } from '@prisma/client';
import { Prisma } from '@prisma/client';
import {
  MgtTxType,
  STADIUM_WATCH_OFFLINE_RATE,
  STADIUM_WATCH_ONLINE_RATE,
  fieldRole,
  parseLineupAssignments,
  positionPower,
  readPlayerAttributes,
  rolesFromSlots,
  stadiumFarmBonusOverwall,
  stadiumWatchKey,
} from '@mll/shared';
import { PlatformConfigService } from '../platform/platform-config.service.js';
import { applyUsdtCredit } from '../wallet/mgt-ledger.js';
import { CheckInRepository } from '../checkin/checkin.repository.js';

export class MiningService {
  private readonly platform: PlatformConfigService;
  private readonly checkInRepo: CheckInRepository;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly redis?: { exists(key: string): Promise<number> },
  ) {
    this.platform = new PlatformConfigService(prisma);
    this.checkInRepo = new CheckInRepository(prisma);
  }

  /** Sem Redis a estimativa fica em 100% (testes). Com Redis, chave ausente = 70%. */
  private async resolvePresenceRate(userId: string): Promise<number> {
    if (!this.redis) return STADIUM_WATCH_ONLINE_RATE;
    const watching = (await this.redis.exists(stadiumWatchKey(userId))) === 1;
    return watching ? STADIUM_WATCH_ONLINE_RATE : STADIUM_WATCH_OFFLINE_RATE;
  }

  /**
   * Soma o overwall dos jogadores escalados no estádio (lineup salva).
   * Jogadores fora do campo não entram nos patrocínios.
   * Inclui bônus de gear equipado e farm do estádio ativo.
   */
  async getLineupOverwall(userId: string): Promise<number> {
    const parts = await this.getLineupOverwallParts(userId);
    return parts.playersBaseOverwall + parts.gearBonusOverwall + parts.stadiumBonusOverwall;
  }

  /** Partes do OW da escalação (base + gear + farm do estádio). */
  async getLineupOverwallParts(userId: string): Promise<{
    playersBaseOverwall: number;
    gearBonusOverwall: number;
    stadiumBonusOverwall: number;
    stadiumFarmBonusPct: number;
    stadiumName: string | null;
  }> {
    const empty = {
      playersBaseOverwall: 0,
      gearBonusOverwall: 0,
      stadiumBonusOverwall: 0,
      stadiumFarmBonusPct: 0,
      stadiumName: null as string | null,
    };

    const club = await this.prisma.club.findUnique({
      where: { userId },
      select: {
        id: true,
        user: { select: { wallet: true } },
      },
    });
    if (!club) return empty;

    const lineup = await this.prisma.clubLineup.findUnique({
      where: { clubId: club.id },
      select: {
        assignments: true,
        stadiumTemplateId: true,
        stadiumTemplate: { select: { name: true, farmBonusPct: true } },
      },
    });
    if (!lineup) return empty;

    const assignments = parseLineupAssignments(lineup.assignments);
    const wallet = club.user?.wallet?.toLowerCase() ?? null;
    const vest = await this.prisma.vestiarioTemplate.findFirst({
      where: { isDefault: true },
      select: { slots: true },
    });
    const slotRoles = rolesFromSlots(vest?.slots);
    const licensed = lineup.stadiumTemplateId
      ? await this.prisma.clubStadiumLicense.findUnique({
          where: {
            clubId_stadiumTemplateId: {
              clubId: club.id,
              stadiumTemplateId: lineup.stadiumTemplateId,
            },
          },
          select: { status: true },
        })
      : null;
    const stadiumFarmBonusPct =
      licensed?.status === 'signed' ? Number(lineup.stadiumTemplate?.farmBonusPct ?? 0) : 0;
    const stadiumName = licensed?.status === 'signed' ? lineup.stadiumTemplate?.name ?? null : null;

    const baseIds: string[] = [];
    const nftIds: bigint[] = [];
    for (const assignment of Object.values(assignments)) {
      if (assignment.kind === 'base') {
        baseIds.push(assignment.playerId);
      } else if (wallet) {
        try {
          nftIds.push(BigInt(assignment.playerId));
        } catch {
          // ignore invalid token id in saved lineup
        }
      }
    }

    let playersBaseOverwall = 0;
    const contributingOw = new Map<string, number>();
    const addPower = (
      id: string,
      player: { stamina: number; position: number; rarity: number; attributes: unknown; overwall: number },
      slotRole?: string,
    ) => {
      if (player.stamina <= 0) return;
      if (slotRole && fieldRole(player.position) !== fieldRole(slotRole)) return;
      const attributes = readPlayerAttributes(player.attributes, id, player.rarity, player.position);
      playersBaseOverwall += positionPower(attributes, player.position);
      contributingOw.set(id, player.overwall);
    };

    if (baseIds.length > 0) {
      const rows = await this.prisma.basePlayer.findMany({
        where: { id: { in: baseIds }, userId },
        select: { id: true, stamina: true, position: true, rarity: true, attributes: true, overwall: true },
      });
      const byId = new Map(rows.map((row) => [row.id, row]));
      for (const [slotId, assignment] of Object.entries(assignments)) {
        if (assignment.kind !== 'base') continue;
        const player = byId.get(assignment.playerId);
        if (player) addPower(player.id, player, slotRoles[slotId]);
      }
    }

    if (nftIds.length > 0 && wallet) {
      const rows = await this.prisma.playerCache.findMany({
        where: { tokenId: { in: nftIds }, ownerWallet: wallet },
        select: { tokenId: true, stamina: true, position: true, rarity: true, attributes: true, overwall: true },
      });
      const byId = new Map(rows.map((row) => [row.tokenId.toString(), row]));
      for (const [slotId, assignment] of Object.entries(assignments)) {
        if (assignment.kind !== 'nft') continue;
        const player = byId.get(assignment.playerId);
        if (player) addPower(player.tokenId.toString(), player, slotRoles[slotId]);
      }
    }

    let gearBonusOverwall = 0;
    const lineupPlayers = [
      ...baseIds.map((playerId) => ({ playerId, kind: 'base' as const })),
      ...nftIds.map((t) => ({ playerId: t.toString(), kind: 'nft' as const })),
    ];
    if (lineupPlayers.length > 0) {
      const gearRows = await this.prisma.playerGearEquip.findMany({
        where: {
          userId,
          OR: lineupPlayers.map((p) => ({
            playerId: p.playerId,
            playerKind: p.kind,
          })),
        },
        include: { userGear: { include: { catalogItem: true } } },
      });
      const pctByPlayer = new Map<string, number>();
      for (const row of gearRows) {
        const ow = contributingOw.get(row.playerId);
        if (ow == null) continue;
        pctByPlayer.set(row.playerId, (pctByPlayer.get(row.playerId) ?? 0) + row.userGear.catalogItem.owBonus);
      }
      gearBonusOverwall = [...pctByPlayer.entries()].reduce(
        (sum, [playerId, pct]) => sum + Math.floor((contributingOw.get(playerId) ?? 0) * pct / 100),
        0,
      );
    }

    const lineupOverwall = playersBaseOverwall + gearBonusOverwall;
    const stadiumBonusOverwall = stadiumFarmBonusOverwall(lineupOverwall, stadiumFarmBonusPct);

    return {
      playersBaseOverwall,
      gearBonusOverwall,
      stadiumBonusOverwall,
      stadiumFarmBonusPct,
      stadiumName,
    };
  }

  async getCheckInOverwall(userId: string): Promise<number> {
    return this.checkInRepo.getActiveOverwallForUser(userId);
  }

  /** Overwall total = escalação (jogadores + gear + farm estádio) + bônus de check-in ativo. */
  async getUserOverwall(userId: string): Promise<number> {
    const [lineup, bonus] = await Promise.all([
      this.getLineupOverwall(userId),
      this.getCheckInOverwall(userId),
    ]);
    return lineup + bonus;
  }

  /**
   * Retorna o painel de patrocínios do usuário (share %, estimativa por rodada).
   */
  async getSummary(userId: string) {
    try {
      await this.flushLegacyPending(userId);
    } catch (err) {
      // Nunca derruba /api/club por flush lento / lock — tenta de novo na próxima leitura.
      console.warn('[mining] flushLegacyPending failed', userId, err);
    }

    const [cfg, balance, lastBlock, lineupParts, checkInOverwall, presenceRate] = await Promise.all([
      this.platform.get(),
      this.prisma.miningBalance.findUnique({ where: { userId } }),
      this.prisma.miningBlock.findFirst({ orderBy: { blockNumber: 'desc' } }),
      this.getLineupOverwallParts(userId),
      this.getCheckInOverwall(userId),
      this.resolvePresenceRate(userId),
    ]);

    const {
      playersBaseOverwall,
      gearBonusOverwall,
      stadiumBonusOverwall,
      stadiumFarmBonusPct,
      stadiumName,
    } = lineupParts;
    const lineupOverwall = playersBaseOverwall + gearBonusOverwall;
    const overwall = lineupOverwall + stadiumBonusOverwall + checkInOverwall;
    const bonusTotal = gearBonusOverwall + stadiumBonusOverwall + checkInOverwall;
    const bonusPctOnBase =
      playersBaseOverwall > 0 ? (bonusTotal / playersBaseOverwall) * 100 : bonusTotal > 0 ? 100 : 0;

    const totalNetworkOverwall = lastBlock ? Number(lastBlock.totalOverwall) : 0;
    const share =
      totalNetworkOverwall > 0 && overwall > 0 ? overwall / totalNetworkOverwall : 0;
    const estimatedPerBlock = share * cfg.miningBlockRewardUsdc * presenceRate;

    return {
      stadiumWatching: presenceRate === STADIUM_WATCH_ONLINE_RATE,
      presenceRate,
      lifetimeEarned: Number(balance?.lifetimeEarned ?? 0),
      currentOverwall: overwall,
      lineupOverwall,
      playersBaseOverwall,
      gearBonusOverwall,
      stadiumBonusOverwall,
      stadiumFarmBonusPct,
      stadiumName,
      checkInOverwall,
      bonusTotal,
      bonusPctOnBase,
      networkOverwall: totalNetworkOverwall,
      sharePct: share * 100,
      estimatedPerBlock,
      blockRewardUsdc: cfg.miningBlockRewardUsdc,
      blockIntervalMin: cfg.miningBlockIntervalMin,
      paused: cfg.miningPaused,
      lastBlockNumber: lastBlock ? Number(lastBlock.blockNumber) : null,
      lastBlockAt: lastBlock?.minedAt.toISOString() ?? null,
    };
  }

  async listBlocks(limit = 20) {
    const blocks = await this.prisma.miningBlock.findMany({
      orderBy: { blockNumber: 'desc' },
      take: Math.min(100, Math.max(1, limit)),
    });
    return blocks.map((b) => ({
      blockNumber: Number(b.blockNumber),
      minedAt: b.minedAt.toISOString(),
      totalOverwall: Number(b.totalOverwall),
      rewardUsdc: Number(b.rewardUsdc),
      participantCount: b.participantCount,
    }));
  }

  async listHistory(userId: string, limit = 50) {
    const rows = await this.prisma.miningReward.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(200, Math.max(1, limit)),
      include: { block: { select: { blockNumber: true, totalOverwall: true } } },
    });
    return rows.map((r) => ({
      id: r.id,
      blockNumber: Number(r.block.blockNumber),
      overwallSnapshot: r.overwallSnapshot,
      networkOverwall: Number(r.block.totalOverwall),
      share: Number(r.share),
      amountUsdc: Number(r.amountUsdc),
      createdAt: r.createdAt.toISOString(),
    }));
  }

  /** Migra saldo pendente legado para a carteira do jogo (fluxo antigo com botão Coletar). */
  private async flushLegacyPending(userId: string) {
    const peek = await this.prisma.miningBalance.findUnique({
      where: { userId },
      select: { pending: true },
    });
    if (!peek || new Prisma.Decimal(peek.pending ?? 0).lte(0)) return;

    await this.prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT "pending" FROM "MiningBalance" WHERE "userId" = ${userId} FOR UPDATE`;

        const balance = await tx.miningBalance.findUnique({ where: { userId } });
        const pending = new Prisma.Decimal(balance?.pending ?? 0);
        if (pending.lte(0)) return;

        const existingFlush = await tx.mGTTransaction.findFirst({
          where: {
            userId,
            type: MgtTxType.MINING_CLAIM,
            meta: { path: ['source'], equals: 'mining_legacy_pending' },
          },
          select: { id: true },
        });
        if (existingFlush) {
          await tx.miningBalance.update({
            where: { userId },
            data: { pending: 0 },
          });
          return;
        }

        await tx.mGTBalance.upsert({
          where: { userId },
          create: { userId, amount: 0, usdcAmount: 0, usdtAmount: 0 },
          update: {},
        });
        await applyUsdtCredit(tx, userId, Number(pending), MgtTxType.MINING_CLAIM, {
          source: 'mining_legacy_pending',
        });
        await tx.miningBalance.update({
          where: { userId },
          data: { pending: 0 },
        });
      },
      { timeout: 15_000, maxWait: 10_000 },
    );
  }
}

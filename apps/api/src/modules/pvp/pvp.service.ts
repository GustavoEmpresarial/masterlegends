import type { Prisma, PrismaClient } from '@prisma/client';
import { MgtTxType, PVP_MIN_STAKE_GMT, PVP_TIERS, pvpTierFor, pvpWinner } from '@mll/shared';
import { AppError, ErrorCode } from '../../common/lib/errors.js';
import { MiningService } from '../mining/mining.service.js';
import { applyMgtCredit, applyMgtDebit } from '../wallet/mgt-ledger.js';

export interface PvpListingDTO {
  id: string;
  hostUserId: string;
  hostClubName: string;
  tierId: string;
  stakeGmt: number;
  hostOverwall: number;
  status: string;
  challengerClubName: string | null;
  challengerOverwall: number | null;
  result: string | null;
  winnerUserId: string | null;
  createdAt: string;
  settledAt: string | null;
  mine: boolean;
}

export interface PvpBoardDTO {
  overwall: number;
  tierId: string;
  gmt: number;
  tiers: Array<{ id: string; label: string; min: number; max: number | null }>;
  mine: PvpListingDTO | null;
  open: PvpListingDTO[];
  recent: PvpListingDTO[];
}

function num(value: { toString(): string } | number | null | undefined): number {
  if (value == null) return 0;
  const n = typeof value === 'number' ? value : Number(value.toString());
  return Number.isFinite(n) ? n : 0;
}

export class PvpService {
  private readonly mining: MiningService;

  constructor(private readonly prisma: PrismaClient) {
    this.mining = new MiningService(prisma);
  }

  async board(userId: string): Promise<PvpBoardDTO> {
    const [overwall, gmt, club] = await Promise.all([
      this.mining.getUserOverwall(userId),
      this.gmtBalance(userId),
      this.prisma.club.findUnique({ where: { userId }, select: { id: true } }),
    ]);
    if (!club) throw new AppError(ErrorCode.CLUB_NOT_FOUND, 404);
    const tier = pvpTierFor(overwall);
    const [mine, open, recent] = await Promise.all([
      this.prisma.pvpListing.findFirst({
        where: { hostUserId: userId, status: 'open' },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.pvpListing.findMany({
        where: { status: 'open', tierId: tier.id, hostUserId: { not: userId } },
        orderBy: { createdAt: 'desc' },
        take: 40,
      }),
      this.prisma.pvpListing.findMany({
        where: {
          status: 'settled',
          tierId: tier.id,
          OR: [{ hostUserId: userId }, { challengerUserId: userId }],
        },
        orderBy: { settledAt: 'desc' },
        take: 8,
      }),
    ]);
    return {
      overwall,
      tierId: tier.id,
      gmt,
      tiers: PVP_TIERS.map((item) => ({ id: item.id, label: item.label, min: item.min, max: item.max })),
      mine: mine ? this.toDto(mine, userId) : null,
      open: open.map((row) => this.toDto(row, userId)),
      recent: recent.map((row) => this.toDto(row, userId)),
    };
  }

  async createListing(userId: string, stakeGmt: number): Promise<PvpListingDTO> {
    if (!Number.isFinite(stakeGmt) || stakeGmt < PVP_MIN_STAKE_GMT) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 400, { reason: 'stake_too_small', minimum: PVP_MIN_STAKE_GMT });
    }
    const club = await this.prisma.club.findUnique({ where: { userId }, select: { name: true } });
    if (!club) throw new AppError(ErrorCode.CLUB_NOT_FOUND, 404);
    const overwall = await this.mining.getUserOverwall(userId);
    const tier = pvpTierFor(overwall);

    const row = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.pvpListing.findFirst({
        where: { hostUserId: userId, status: 'open' },
        select: { id: true },
      });
      if (existing) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, 400, { reason: 'already_listed' });
      }
      await applyMgtDebit(tx, userId, stakeGmt, MgtTxType.PVP_STAKE, { tierId: tier.id });
      return tx.pvpListing.create({
        data: {
          hostUserId: userId,
          hostClubName: club.name,
          tierId: tier.id,
          stakeGmt,
          hostOverwall: overwall,
        },
      });
    });
    return this.toDto(row, userId);
  }

  async cancelListing(userId: string, listingId: string): Promise<PvpListingDTO> {
    const row = await this.prisma.$transaction(async (tx) => {
      const listing = await tx.pvpListing.findUnique({ where: { id: listingId } });
      if (!listing || listing.hostUserId !== userId) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, 400, { reason: 'listing_not_found' });
      }
      if (listing.status !== 'open') {
        throw new AppError(ErrorCode.VALIDATION_ERROR, 400, { reason: 'listing_closed' });
      }
      await applyMgtCredit(tx, userId, num(listing.stakeGmt), MgtTxType.PVP_REFUND, { listingId });
      return tx.pvpListing.update({
        where: { id: listingId },
        data: { status: 'cancelled', settledAt: new Date(), result: 'cancelled' },
      });
    });
    return this.toDto(row, userId);
  }

  async acceptListing(userId: string, listingId: string): Promise<PvpListingDTO> {
    const club = await this.prisma.club.findUnique({ where: { userId }, select: { name: true } });
    if (!club) throw new AppError(ErrorCode.CLUB_NOT_FOUND, 404);

    const listing = await this.prisma.pvpListing.findUnique({ where: { id: listingId } });
    if (!listing || listing.status !== 'open') {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 400, { reason: 'listing_closed' });
    }
    if (listing.hostUserId === userId) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 400, { reason: 'own_listing' });
    }

    const [hostOverwall, challengerOverwall] = await Promise.all([
      this.mining.getUserOverwall(listing.hostUserId),
      this.mining.getUserOverwall(userId),
    ]);
    const hostTier = pvpTierFor(hostOverwall);
    const awayTier = pvpTierFor(challengerOverwall);
    if (hostTier.id !== listing.tierId || awayTier.id !== listing.tierId) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 400, { reason: 'tier_mismatch', tierId: listing.tierId });
    }

    const result = pvpWinner(hostOverwall, challengerOverwall);
    const stake = num(listing.stakeGmt);
    const winnerUserId = result === 'host' ? listing.hostUserId : result === 'challenger' ? userId : null;

    const row = await this.prisma.$transaction(async (tx) => {
      const current = await tx.pvpListing.findUnique({ where: { id: listingId } });
      if (!current || current.status !== 'open') {
        throw new AppError(ErrorCode.VALIDATION_ERROR, 400, { reason: 'listing_closed' });
      }
      await applyMgtDebit(tx, userId, stake, MgtTxType.PVP_STAKE, { listingId, tierId: listing.tierId });
      if (result === 'draw') {
        await applyMgtCredit(tx, listing.hostUserId, stake, MgtTxType.PVP_REFUND, { listingId });
        await applyMgtCredit(tx, userId, stake, MgtTxType.PVP_REFUND, { listingId });
      } else if (winnerUserId) {
        await applyMgtCredit(tx, winnerUserId, stake * 2, MgtTxType.PVP_WIN, {
          listingId,
          hostOverwall,
          challengerOverwall,
        });
      }
      return tx.pvpListing.update({
        where: { id: listingId },
        data: {
          status: 'settled',
          challengerUserId: userId,
          challengerClubName: club.name,
          challengerOverwall,
          hostOverwall,
          winnerUserId,
          result,
          settledAt: new Date(),
        },
      });
    });
    return this.toDto(row, userId);
  }

  private async gmtBalance(userId: string): Promise<number> {
    const row = await this.prisma.mGTBalance.findUnique({ where: { userId }, select: { amount: true } });
    return num(row?.amount);
  }

  private toDto(row: {
    id: string;
    hostUserId: string;
    hostClubName: string;
    tierId: string;
    stakeGmt: Prisma.Decimal;
    hostOverwall: Prisma.Decimal;
    status: string;
    challengerClubName: string | null;
    challengerOverwall: Prisma.Decimal | null;
    result: string | null;
    winnerUserId: string | null;
    createdAt: Date;
    settledAt: Date | null;
  }, userId: string): PvpListingDTO {
    return {
      id: row.id,
      hostUserId: row.hostUserId,
      hostClubName: row.hostClubName,
      tierId: row.tierId,
      stakeGmt: num(row.stakeGmt),
      hostOverwall: num(row.hostOverwall),
      status: row.status,
      challengerClubName: row.challengerClubName,
      challengerOverwall: row.challengerOverwall == null ? null : num(row.challengerOverwall),
      result: row.result,
      winnerUserId: row.winnerUserId,
      createdAt: row.createdAt.toISOString(),
      settledAt: row.settledAt?.toISOString() ?? null,
      mine: row.hostUserId === userId,
    };
  }
}

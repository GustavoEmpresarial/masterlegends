import bcrypt from 'bcryptjs';
import { Prisma, type PrismaClient } from '@prisma/client';
import type {
  AdminUpdateUserProfileInput,
  AdminUserAccountDTO,
  AdminUserDetailDTO,
  AdminUserListItemDTO,
  AdminUserMarketplaceListingDTO,
} from '@mll/shared';
import { AppError, ErrorCode } from '../../common/lib/errors.js';
import {
  ADMIN_DISABLE_LOCK_UNTIL,
  formatAuditActivity,
  formatMgtActivity,
  formatWalletActivity,
  isAdminDisabled,
  positionLabel,
  rarityLabel,
} from './user-account.util.js';
import { buildAdminUserWhere, type AdminUserListFilters } from './admin-user-filters.util.js';

const BCRYPT_ROUNDS = 10;

export class AdminUsersService {
  constructor(private readonly prisma: PrismaClient) {}

  private mapListItem(u: {
    id: string;
    email: string | null;
    username: string | null;
    wallet: string | null;
    emailVerifiedAt: Date | null;
    bannedAt: Date | null;
    banReason: string | null;
    lockedUntil: Date | null;
    createdAt: Date;
    mgtBalance?: {
      amount: { toString(): string };
      usdcAmount?: { toString(): string };
      usdtAmount?: { toString(): string };
    } | null;
    club?: { name: string | null } | null;
    _count?: {
      depositClaims?: number;
      walletTransactions?: number;
      mgtTransactions?: number;
      supportTickets?: number;
      withdrawalRequests?: number;
    };
  }): AdminUserListItemDTO {
    const isDepositor =
      (u._count?.depositClaims ?? 0) > 0 ||
      (u._count?.walletTransactions ?? 0) > 0 ||
      (u._count?.mgtTransactions ?? 0) > 0;

    return {
      id: u.id,
      email: u.email,
      username: u.username,
      wallet: u.wallet,
      emailVerifiedAt: u.emailVerifiedAt?.toISOString() ?? null,
      bannedAt: u.bannedAt?.toISOString() ?? null,
      banReason: u.banReason,
      gmtBalance: Number(u.mgtBalance?.amount ?? 0),
      usdcBalance: Number(u.mgtBalance?.usdcAmount ?? 0),
      usdtBalance: Number(u.mgtBalance?.usdtAmount ?? 0),
      createdAt: u.createdAt.toISOString(),
      clubName: u.club?.name ?? null,
      disabled: isAdminDisabled(u.lockedUntil),
      isDepositor,
      openTickets: u._count?.supportTickets ?? 0,
      pendingWithdrawals: u._count?.withdrawalRequests ?? 0,
    };
  }

  async listUsers(opts: AdminUserListFilters & { limit: number; cursor?: string }) {
    const where = buildAdminUserWhere(opts);

    const rows = await this.prisma.user.findMany({
      take: opts.limit + 1,
      ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        mgtBalance: { select: { amount: true, usdcAmount: true, usdtAmount: true } },
        club: { select: { name: true } },
        _count: {
          select: {
            depositClaims: { where: { status: 'credited' } },
            walletTransactions: { where: { type: 'usdc_deposit' } },
            mgtTransactions: { where: { type: 'usdc_deposit' } },
            supportTickets: { where: { status: { in: ['open', 'in_progress'] } } },
            withdrawalRequests: { where: { status: 'pending' } },
          },
        },
      },
    });

    const hasMore = rows.length > opts.limit;
    const items = hasMore ? rows.slice(0, opts.limit) : rows;

    const users: AdminUserListItemDTO[] = items.map((u) => this.mapListItem(u));

    return { users, nextCursor: hasMore ? items[items.length - 1]?.id : undefined };
  }

  async getUser(id: string): Promise<AdminUserDetailDTO> {
    const account = await this.getUserAccount(id);
    const {
      referralCode: _r,
      referredByCode: _rb,
      club: _c,
      inventory: _i,
      activityLogs: _a,
      ...detail
    } = account;
    return detail;
  }

  async getUserAccount(id: string): Promise<AdminUserAccountDTO> {
    const u = await this.prisma.user.findUnique({
      where: { id },
      include: {
        mgtBalance: { select: { amount: true, usdcAmount: true, usdtAmount: true } },
        club: true,
        basePlayers: {
          orderBy: { overwall: 'desc' },
          include: { template: { select: { name: true, imageUrl: true } } },
        },
      },
    });
    if (!u) throw new AppError(ErrorCode.USER_NOT_FOUND, 404);

    const [
      openTickets,
      pendingWithdrawals,
      referrer,
      mgtTx,
      walletTx,
      auditLogs,
      nfts,
      lastLogin,
      walletAudit,
      activeListings,
    ] = await Promise.all([
        this.prisma.supportTicket.count({
          where: { userId: id, status: { in: ['open', 'in_progress'] } },
        }),
        this.prisma.withdrawalRequest.count({
          where: { userId: id, status: 'pending' },
        }),
        u.referredBy
          ? this.prisma.user.findUnique({
              where: { id: u.referredBy },
              select: { referralCode: true },
            })
          : Promise.resolve(null),
        this.prisma.mGTTransaction.findMany({
          where: { userId: id },
          orderBy: { createdAt: 'desc' },
          take: 80,
        }),
        this.prisma.walletTransaction.findMany({
          where: { userId: id },
          orderBy: { createdAt: 'desc' },
          take: 40,
        }),
        this.prisma.auditLog.findMany({
          where: {
            OR: [{ userId: id }, { meta: { path: ['targetId'], equals: id } }],
          },
          orderBy: { createdAt: 'desc' },
          take: 60,
        }),
        u.wallet
          ? this.prisma.playerCache.findMany({
              where: { ownerWallet: u.wallet.toLowerCase() },
              orderBy: { overwall: 'desc' },
            })
          : Promise.resolve([]),
        this.prisma.auditLog.findFirst({
          where: { userId: id, action: 'login_success' },
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true },
        }),
        this.prisma.auditLog.findMany({
          where: { userId: id, action: { in: ['wallet_linked', 'wallet_unlinked'] } },
          orderBy: { createdAt: 'desc' },
          take: 50,
        }),
        this.prisma.listing.findMany({
          where: { sellerId: id, active: true },
          include: {
            basePlayer: {
              include: { template: { select: { name: true, imageUrl: true } } },
            },
          },
          orderBy: { createdAt: 'desc' },
        }),
      ]);

    const marketplaceListings: AdminUserMarketplaceListingDTO[] = activeListings.map((l) => ({
      id: l.id,
      kind: l.tokenId !== null ? ('nft' as const) : ('base' as const),
      playerId: l.basePlayerId,
      tokenId: l.tokenId?.toString() ?? null,
      name: l.basePlayer?.template?.name ?? l.basePlayer?.name ?? l.name ?? null,
      rarity: rarityLabel(l.rarity),
      overwall: l.overwall,
      position: positionLabel(l.basePlayer?.position ?? l.position),
      priceGmt: Number(l.price),
      imageUrl: l.basePlayer?.template?.imageUrl ?? l.basePlayer?.imageUrl ?? l.imageUrl ?? null,
      listedAt: l.createdAt.toISOString(),
    }));

    const listedBaseIds = new Set(
      marketplaceListings.filter((l) => l.kind === 'base' && l.playerId).map((l) => l.playerId!),
    );
    const listedTokenIds = new Set(
      marketplaceListings.filter((l) => l.tokenId).map((l) => l.tokenId!),
    );

    const basePlayers = u.basePlayers.map((p) => ({
      id: p.id,
      kind: 'base' as const,
      name: p.name ?? p.template?.name ?? null,
      rarity: rarityLabel(p.rarity),
      overwall: p.overwall,
      position: positionLabel(p.position),
      listed: p.listed || listedBaseIds.has(p.id),
      imageUrl: p.imageUrl ?? p.template?.imageUrl ?? null,
      tokenId: null,
    }));

    const nftItems = nfts.map((p) => ({
      id: p.tokenId.toString(),
      kind: 'nft' as const,
      name: `NFT #${p.tokenId.toString()}`,
      rarity: rarityLabel(p.rarity),
      overwall: p.overwall,
      position: positionLabel(p.position),
      listed: listedTokenIds.has(p.tokenId.toString()),
      imageUrl: null,
      tokenId: p.tokenId.toString(),
    }));

    const activityLogs = [
      ...mgtTx.map(formatMgtActivity),
      ...walletTx.map(formatWalletActivity),
      ...auditLogs.map(formatAuditActivity),
    ]
      .filter((row) => row.amount == null || Math.abs(row.amount) >= 0.0001)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 100)
      .map(({ amountLabel: _al, ...row }) => row);

    return {
      id: u.id,
      email: u.email,
      username: u.username,
      wallet: u.wallet,
      emailVerifiedAt: u.emailVerifiedAt?.toISOString() ?? null,
      bannedAt: u.bannedAt?.toISOString() ?? null,
      banReason: u.banReason,
      bannedBy: u.bannedBy,
      gmtBalance: Number(u.mgtBalance?.amount ?? 0),
      usdcBalance: Number(u.mgtBalance?.usdcAmount ?? 0),
      usdtBalance: Number(u.mgtBalance?.usdtAmount ?? 0),
      createdAt: u.createdAt.toISOString(),
      failedLoginCount: u.failedLoginCount,
      lockedUntil: u.lockedUntil?.toISOString() ?? null,
      disabled: isAdminDisabled(u.lockedUntil),
      clubName: u.club?.name ?? null,
      openTickets,
      pendingWithdrawals,
      referralCode: u.referralCode,
      referredByCode: referrer?.referralCode ?? null,
      lastLoginAt: lastLogin?.createdAt.toISOString() ?? null,
      walletHistory: walletAudit.map((row) => ({
        action: row.action === 'wallet_linked' ? ('linked' as const) : ('unlinked' as const),
        wallet:
          row.meta && typeof row.meta === 'object' && 'wallet' in row.meta
            ? String((row.meta as { wallet: unknown }).wallet)
            : null,
        createdAt: row.createdAt.toISOString(),
      })),
      club: u.club
        ? {
            name: u.club.name,
            stadiumLvl: u.club.stadiumLvl,
            ctLvl: u.club.ctLvl,
            treasurerLvl: u.club.treasurerLvl,
            trophyRoomLvl: u.club.trophyRoomLvl,
            totalOverwall: u.club.totalOverwall,
            treasurerHired: !!u.club.treasurerHiredAt,
            coachHired: !!u.club.coachHiredAt,
            createdAt: u.club.createdAt.toISOString(),
          }
        : null,
      inventory: {
        basePlayers,
        nfts: nftItems,
        total: basePlayers.length + nftItems.length,
      },
      marketplaceListings,
      activityLogs,
    };
  }

  async banUser(userId: string, reason: string, adminLogin: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError(ErrorCode.USER_NOT_FOUND, 404);

    await this.prisma.user.update({
      where: { id: userId },
      data: { bannedAt: new Date(), banReason: reason, bannedBy: adminLogin },
    });
    return this.getUser(userId);
  }

  async unbanUser(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError(ErrorCode.USER_NOT_FOUND, 404);

    await this.prisma.user.update({
      where: { id: userId },
      data: { bannedAt: null, banReason: null, bannedBy: null },
    });
    return this.getUser(userId);
  }

  async deactivateUser(userId: string, reason: string, adminLogin: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError(ErrorCode.USER_NOT_FOUND, 404);
    if (user.bannedAt) throw new AppError(ErrorCode.USER_BANNED, 400);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        lockedUntil: ADMIN_DISABLE_LOCK_UNTIL,
        failedLoginCount: 0,
      },
    });
    void reason;
    void adminLogin;
    return this.getUser(userId);
  }

  async reactivateUser(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError(ErrorCode.USER_NOT_FOUND, 404);
    if (!isAdminDisabled(user.lockedUntil)) {
      return this.getUser(userId);
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { lockedUntil: null },
    });
    return this.getUser(userId);
  }

  async updateUserProfile(userId: string, data: AdminUpdateUserProfileInput) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { club: true, mgtBalance: true },
    });
    if (!user) throw new AppError(ErrorCode.USER_NOT_FOUND, 404);

    await this.prisma.$transaction(async (tx) => {
      if (data.username !== undefined) {
        const username = data.username.trim().toLowerCase();
        if (username && username !== user.username) {
          const taken = await tx.user.findFirst({
            where: { username, NOT: { id: userId } },
          });
          if (taken) throw new AppError(ErrorCode.AUTH_EMAIL_OR_USERNAME_TAKEN, 409);
          await tx.user.update({ where: { id: userId }, data: { username } });
        }
      }

      if (data.email !== undefined) {
        const emailRaw = data.email;
        const email =
          emailRaw === '' || emailRaw == null ? null : emailRaw.trim().toLowerCase();
        if (email !== user.email) {
          if (email) {
            const taken = await tx.user.findFirst({
              where: { email, NOT: { id: userId } },
            });
            if (taken) throw new AppError(ErrorCode.AUTH_EMAIL_OR_USERNAME_TAKEN, 409);
          }
          await tx.user.update({ where: { id: userId }, data: { email } });
        }
      }

      if (data.wallet !== undefined) {
        const walletRaw = data.wallet;
        const wallet =
          walletRaw === '' || walletRaw == null ? null : walletRaw.trim().toLowerCase();
        if (wallet !== user.wallet) {
          if (wallet) {
            const taken = await tx.user.findFirst({
              where: { wallet, NOT: { id: userId } },
            });
            if (taken) throw new AppError(ErrorCode.AUTH_WALLET_TAKEN, 409);
          }
          await tx.user.update({ where: { id: userId }, data: { wallet } });
        }
      }

      if (data.referralCode !== undefined) {
        const referralCode = data.referralCode.trim().toUpperCase();
        if (referralCode && referralCode !== user.referralCode) {
          const taken = await tx.user.findFirst({
            where: { referralCode, NOT: { id: userId } },
          });
          if (taken) throw new AppError(ErrorCode.AUTH_INVALID_REFERRAL_CODE, 409);
          await tx.user.update({ where: { id: userId }, data: { referralCode } });
        }
      }

      if (data.emailVerified !== undefined) {
        const targetVerified = data.emailVerified;
        const currentlyVerified = user.emailVerifiedAt != null;
        if (targetVerified !== currentlyVerified) {
          await tx.user.update({
            where: { id: userId },
            data: { emailVerifiedAt: targetVerified ? new Date() : null },
          });
        }
      }

      if (data.failedLoginCount !== undefined && data.failedLoginCount !== user.failedLoginCount) {
        await tx.user.update({
          where: { id: userId },
          data: { failedLoginCount: data.failedLoginCount },
        });
      }

      if (data.clearAccountLock) {
        await tx.user.update({
          where: { id: userId },
          data: { lockedUntil: null, failedLoginCount: 0 },
        });
      }

      if (
        data.gmtBalance !== undefined ||
        data.usdcBalance !== undefined ||
        data.usdtBalance !== undefined
      ) {
        await tx.mGTBalance.upsert({
          where: { userId },
          create: { userId, amount: new Prisma.Decimal(0), usdcAmount: new Prisma.Decimal(0) },
          update: {},
        });

        if (data.gmtBalance !== undefined) {
          const target = new Prisma.Decimal(data.gmtBalance);
          const updated = await tx.mGTBalance.update({
            where: { userId },
            data: { amount: target },
          });
          const current = user.mgtBalance?.amount ?? new Prisma.Decimal(0);
          const adjustment = target.minus(current);
          if (!adjustment.isZero()) {
            await tx.mGTTransaction.create({
              data: {
                userId,
                type: 'admin_adjust',
                amount: adjustment,
                balanceAfter: updated.amount,
                meta: {
                  source: 'admin_panel',
                  currency: 'gmt',
                  movement: adjustment.greaterThan(0) ? 'credit' : 'debit',
                  ...(adjustment.greaterThan(0) ? { origin: 'admin' } : { destination: 'admin' }),
                },
              },
            });
          }
        }

        if (data.usdcBalance !== undefined) {
          const targetUsdc = new Prisma.Decimal(data.usdcBalance);
          const updated = await tx.mGTBalance.update({
            where: { userId },
            data: { usdcAmount: targetUsdc },
          });
          const currentUsdc = user.mgtBalance?.usdcAmount ?? new Prisma.Decimal(0);
          const adjustmentUsdc = targetUsdc.minus(currentUsdc);
          if (!adjustmentUsdc.isZero()) {
            await tx.mGTTransaction.create({
              data: {
                userId,
                type: 'admin_adjust',
                amount: adjustmentUsdc,
                balanceAfter: updated.usdcAmount,
                meta: { source: 'admin_panel', currency: 'usdc' },
              },
            });
          }
        }

        if (data.usdtBalance !== undefined) {
          const targetUsdt = new Prisma.Decimal(data.usdtBalance);
          const updated = await tx.mGTBalance.update({
            where: { userId },
            data: { usdtAmount: targetUsdt },
          });
          const currentUsdt = user.mgtBalance?.usdtAmount ?? new Prisma.Decimal(0);
          const adjustmentUsdt = targetUsdt.minus(currentUsdt);
          if (!adjustmentUsdt.isZero()) {
            await tx.mGTTransaction.create({
              data: {
                userId,
                type: 'admin_adjust',
                amount: adjustmentUsdt,
                balanceAfter: updated.usdtAmount,
                meta: { source: 'admin_panel', currency: 'usdt' },
              },
            });
          }
        }
      }

      const clubPatch: Prisma.ClubUpdateInput = {};
      if (data.clubName !== undefined && user.club) {
        const name = data.clubName.trim();
        if (name && name !== user.club.name) {
          const taken = await tx.club.findFirst({
            where: { name, NOT: { userId } },
          });
          if (taken) throw new AppError(ErrorCode.CLUB_NAME_TAKEN, 409);
          clubPatch.name = name;
        }
      }
      if (data.clubStadiumLvl !== undefined && (!user.club || data.clubStadiumLvl !== user.club.stadiumLvl)) {
        clubPatch.stadiumLvl = data.clubStadiumLvl;
      }
      if (data.clubCtLvl !== undefined && (!user.club || data.clubCtLvl !== user.club.ctLvl)) {
        clubPatch.ctLvl = data.clubCtLvl;
      }
      if (data.clubTreasurerLvl !== undefined && (!user.club || data.clubTreasurerLvl !== user.club.treasurerLvl)) {
        clubPatch.treasurerLvl = data.clubTreasurerLvl;
      }
      if (data.clubTrophyRoomLvl !== undefined && (!user.club || data.clubTrophyRoomLvl !== user.club.trophyRoomLvl)) {
        clubPatch.trophyRoomLvl = data.clubTrophyRoomLvl;
      }
      if (data.clubTotalOverwall !== undefined && (!user.club || data.clubTotalOverwall !== user.club.totalOverwall)) {
        clubPatch.totalOverwall = data.clubTotalOverwall;
      }

      if (user.club && Object.keys(clubPatch).length > 0) {
        await tx.club.update({ where: { userId }, data: clubPatch });
      } else if (!user.club && data.clubName !== undefined && data.clubName.trim()) {
        const name = data.clubName.trim();
        const taken = await tx.club.findFirst({ where: { name } });
        if (taken) throw new AppError(ErrorCode.CLUB_NAME_TAKEN, 409);
        await tx.club.create({
          data: {
            userId,
            name,
            lastFarmAt: new Date(),
            stadiumLvl: data.clubStadiumLvl ?? 1,
            ctLvl: data.clubCtLvl ?? 1,
            treasurerLvl: data.clubTreasurerLvl ?? 1,
            trophyRoomLvl: data.clubTrophyRoomLvl ?? 1,
            totalOverwall: data.clubTotalOverwall ?? 0,
          },
        });
      }
    });

    return this.getUserAccount(userId);
  }

  async resetPassword(userId: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError(ErrorCode.USER_NOT_FOUND, 404);

    const hashed = await bcrypt.hash(password, BCRYPT_ROUNDS);
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashed, failedLoginCount: 0, lockedUntil: null },
    });
    return { ok: true as const };
  }
}

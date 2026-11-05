import type { PrismaClient } from '@prisma/client';
import {
  ErrorCode,
  displayPlayerNickname,
  fieldRole,
  parseLineupAssignments,
  positionPower,
  readPlayerAttributes,
  rolesFromSlots,
  type PlayerProfileDTO,
  type ProfileMatchDTO,
} from '@mll/shared';
import { AppError } from '../../common/lib/errors.js';
import { deleteUserAvatarImage, saveUserAvatarImage } from '../../common/lib/uploads.js';
import { POSITION_NAMES } from '../../config/game.js';
import { PassRepository, PassService } from '../pass/pass.service.js';

function asNumber(value: { toString(): string } | null | undefined): number {
  if (value == null) return 0;
  const n = Number(value.toString());
  return Number.isFinite(n) ? n : 0;
}

function initials(name: string | null): string {
  const clean = (name ?? '').trim();
  if (!clean) return 'ML';
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase();
  }
  return clean.slice(0, 2).toUpperCase();
}

function positionName(position: number): string {
  return POSITION_NAMES[position] ?? 'MID';
}

export class ProfileService {
  constructor(private readonly prisma: PrismaClient) {}

  async getProfile(userId: string): Promise<PlayerProfileDTO> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        club: true,
        mgtBalance: true,
      },
    });
    if (!user?.club) {
      throw new AppError(ErrorCode.CLUB_NOT_FOUND, 404);
    }

    const club = user.club;
    const pass = await new PassService(new PassRepository(this.prisma), this.prisma).getProgress(userId);

    const [baseCount, nftCount, gearCount, warehouseCount, trophyCount, badgeCount, lineupRow, gmtTx, walletTx, matches] =
      await Promise.all([
        this.prisma.basePlayer.count({ where: { userId, retiredAt: null } }),
        user.wallet
          ? this.prisma.playerCache.count({ where: { ownerWallet: user.wallet } })
          : Promise.resolve(0),
        this.prisma.userGear.count({ where: { userId } }),
        this.prisma.warehouseItem.count({ where: { userId } }),
        this.prisma.clubTrophy.count({ where: { clubId: club.id } }),
        this.prisma.userBadge.count({ where: { userId } }),
        this.prisma.clubLineup.findUnique({ where: { clubId: club.id } }),
        this.prisma.mGTTransaction.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          take: 8,
        }),
        this.prisma.walletTransaction.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          take: 5,
        }),
        this.prisma.pvPMatch.findMany({
          where: { OR: [{ clubAId: club.id }, { clubBId: club.id }] },
          orderBy: { playedAt: 'desc' },
          take: 5,
          include: {
            clubA: { select: { id: true, name: true } },
            clubB: { select: { id: true, name: true } },
          },
        }),
      ]);

    let assignments: ReturnType<typeof parseLineupAssignments> = {};
    if (lineupRow) {
      try {
        assignments = parseLineupAssignments(lineupRow.assignments);
      } catch {
        assignments = {};
      }
    }
    const assigned = Object.values(assignments);
    const baseIds = assigned.filter((a) => a.kind === 'base').map((a) => a.playerId);
    const nftIds = assigned
      .filter((a) => a.kind === 'nft' && /^\d+$/.test(a.playerId))
      .map((a) => BigInt(a.playerId));

    const [basePlayers, nftPlayers] = await Promise.all([
      baseIds.length
        ? this.prisma.basePlayer.findMany({
            where: { id: { in: baseIds }, userId },
            select: { id: true, name: true, position: true, overwall: true },
          })
        : Promise.resolve([]),
      nftIds.length
        ? this.prisma.playerCache.findMany({
            where: { tokenId: { in: nftIds } },
            select: { tokenId: true, position: true, overwall: true },
          })
        : Promise.resolve([]),
    ]);

    const lineup = [
      ...basePlayers.map((p) => ({
        id: p.id,
        name: displayPlayerNickname(p.name, p.id),
        position: positionName(p.position),
        overwall: p.overwall,
      })),
      ...nftPlayers.map((p) => ({
        id: p.tokenId.toString(),
        name: `#${p.tokenId.toString()}`,
        position: positionName(p.position),
        overwall: p.overwall,
      })),
    ].slice(0, 11);

    const transactions = [
      ...gmtTx.map((tx) => ({
        id: tx.id,
        type: tx.type,
        amount: asNumber(tx.amount),
        createdAt: tx.createdAt.toISOString(),
        source: 'gmt' as const,
      })),
      ...walletTx.map((tx) => ({
        id: tx.id,
        type: tx.type,
        amount: asNumber(tx.amount),
        createdAt: tx.createdAt.toISOString(),
        source: 'wallet' as const,
      })),
    ]
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .slice(0, 8);

    const recentMatches: ProfileMatchDTO[] = matches.map((match) => {
      const home = match.clubAId === club.id;
      const opponent = home ? match.clubB.name : match.clubA.name;
      const winner = String(match.winner ?? '').toLowerCase();
      let result: ProfileMatchDTO['result'] = 'loss';
      if (winner === 'draw' || winner === 'empate') result = 'draw';
      else if (match.winner === club.id || (home && winner === 'a') || (!home && winner === 'b')) result = 'win';
      return {
        id: match.id,
        playedAt: match.playedAt.toISOString(),
        opponent,
        result,
      };
    });

    const [ownedBase, ownedNfts, vest] = await Promise.all([
      this.prisma.basePlayer.findMany({
        where: { userId },
        select: {
          id: true,
          overwall: true,
          listed: true,
          retiredAt: true,
          stamina: true,
          position: true,
          rarity: true,
          attributes: true,
        },
      }),
      user.wallet
        ? this.prisma.playerCache.findMany({
            where: { ownerWallet: user.wallet.toLowerCase() },
            select: { tokenId: true, overwall: true, stamina: true, position: true, rarity: true, attributes: true },
          })
        : Promise.resolve([]),
      this.prisma.vestiarioTemplate.findFirst({
        where: { isDefault: true },
        select: { slots: true },
      }),
    ]);
    const slotRoles = rolesFromSlots(vest?.slots);
    const squadOverwall =
      ownedBase.filter((p) => !p.retiredAt && !p.listed).reduce((sum, p) => sum + p.overwall, 0) +
      ownedNfts.reduce((sum, p) => sum + p.overwall, 0);
    const collectionOverwall =
      ownedBase.reduce((sum, p) => sum + p.overwall, 0) +
      ownedNfts.reduce((sum, p) => sum + p.overwall, 0);
    const baseById = new Map(ownedBase.map((p) => [p.id, p]));
    const nftById = new Map(ownedNfts.map((p) => [p.tokenId.toString(), p]));
    let activeOverwall = 0;
    for (const [slotId, assignment] of Object.entries(assignments)) {
      const slotRole = slotRoles[slotId];
      if (assignment.kind === 'base') {
        const player = baseById.get(assignment.playerId);
        if (!player || player.stamina <= 0) continue;
        if (slotRole && fieldRole(player.position) !== fieldRole(slotRole)) continue;
        const attributes = readPlayerAttributes(player.attributes, player.id, player.rarity, player.position);
        activeOverwall += positionPower(attributes, player.position);
      } else {
        const player = nftById.get(assignment.playerId);
        if (!player || player.stamina <= 0) continue;
        if (slotRole && fieldRole(player.position) !== fieldRole(slotRole)) continue;
        const id = player.tokenId.toString();
        const attributes = readPlayerAttributes(player.attributes, id, player.rarity, player.position);
        activeOverwall += positionPower(attributes, player.position);
      }
    }

    return {
      account: {
        id: user.id,
        wallet: user.wallet,
        name: user.username,
        avatarInitials: initials(user.username),
        avatarUrl: user.avatarUrl ?? null,
        createdAt: user.createdAt.toISOString(),
      },
      club: {
        id: club.id,
        name: club.name,
        createdAt: club.createdAt.toISOString(),
        stadiumLvl: club.stadiumLvl,
        overwall: club.totalOverwall,
        squadOverwall,
        activeOverwall,
        collectionOverwall,
      },
      players: {
        baseCount,
        nftCount,
        lineupCount: assigned.length,
        inventoryCount: gearCount + warehouseCount,
        lineup,
      },
      finance: {
        gmt: asNumber(user.mgtBalance?.amount),
        usdc: asNumber(user.mgtBalance?.usdcAmount),
        usdt: asNumber(user.mgtBalance?.usdtAmount),
        transactions,
      },
      gameplay: {
        seasonName: pass.seasonName,
        seasonActive: pass.active,
        passXp: pass.xp,
        passLevel: pass.level,
        passPremium: pass.premium,
        trophyCount,
        badgeCount,
        matches: recentMatches,
      },
    };
  }

  async updateAvatar(userId: string, buffer: Buffer): Promise<PlayerProfileDTO> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { avatarUrl: true } });
    if (!user) throw new AppError(ErrorCode.USER_NOT_FOUND, 404);

    const saved = await saveUserAvatarImage(buffer);
    if (user.avatarUrl) await deleteUserAvatarImage(user.avatarUrl);
    await this.prisma.user.update({ where: { id: userId }, data: { avatarUrl: saved.url } });
    return this.getProfile(userId);
  }

  async clearAvatar(userId: string): Promise<PlayerProfileDTO> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { avatarUrl: true } });
    if (!user) throw new AppError(ErrorCode.USER_NOT_FOUND, 404);
    if (user.avatarUrl) {
      await deleteUserAvatarImage(user.avatarUrl);
      await this.prisma.user.update({ where: { id: userId }, data: { avatarUrl: null } });
    }
    return this.getProfile(userId);
  }

  async renameClub(userId: string, name: string): Promise<PlayerProfileDTO> {
    const club = await this.prisma.club.findUnique({ where: { userId }, select: { id: true } });
    if (!club) throw new AppError(ErrorCode.CLUB_NOT_FOUND, 404);
    const taken = await this.prisma.club.findFirst({
      where: { name, NOT: { id: club.id } },
      select: { id: true },
    });
    if (taken) throw new AppError(ErrorCode.VALIDATION_ERROR, 409, { reason: 'club_name_taken' });
    await this.prisma.club.update({ where: { id: club.id }, data: { name } });
    return this.getProfile(userId);
  }
}

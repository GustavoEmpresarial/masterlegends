import type { PrismaClient } from '@prisma/client';
import { AppError, ErrorCode } from '../../common/lib/errors.js';

export type AfflictionTargetKind = 'coach' | 'treasurer' | 'base_player' | 'nft_player';

export const AFFLICTION_CODES = {
  coach: ['dor_de_barriga', 'gripe', 'indisposicao'] as const,
  treasurer: ['dor_de_barriga', 'gripe', 'indisposicao'] as const,
  base_player: ['cansaco', 'lesao_leve', 'lesao_grave'] as const,
  nft_player: ['cansaco', 'lesao_leve', 'lesao_grave'] as const,
};

export interface ActiveAfflictions {
  coach: boolean;
  treasurer: boolean;
  players: Map<string, string>; // targetId -> code
}

export class AfflictionService {
  constructor(private readonly prisma: PrismaClient) {}

  async apply(input: {
    userId: string;
    targetKind: AfflictionTargetKind;
    targetId: string | null;
    code: string;
    durationMinutes: number;
    note?: string;
    createdBy?: string;
  }) {
    if (input.durationMinutes <= 0 || input.durationMinutes > 60 * 24 * 30) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 400, { reason: 'invalid duration' });
    }
    if (input.targetKind === 'base_player' || input.targetKind === 'nft_player') {
      if (!input.targetId) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, 400, { reason: 'targetId required for player' });
      }
    }
    const expiresAt = new Date(Date.now() + input.durationMinutes * 60_000);
    return this.prisma.affliction.create({
      data: {
        userId: input.userId,
        targetKind: input.targetKind,
        targetId: input.targetId,
        code: input.code,
        note: input.note,
        expiresAt,
        createdBy: input.createdBy,
      },
    });
  }

  async listActiveForUser(userId: string, now = new Date()) {
    return this.prisma.affliction.findMany({
      where: { userId, expiresAt: { gt: now } },
      orderBy: { expiresAt: 'asc' },
    });
  }

  async listAllForUser(userId: string) {
    return this.prisma.affliction.findMany({
      where: { userId },
      orderBy: { startedAt: 'desc' },
      take: 50,
    });
  }

  async remove(id: string) {
    return this.prisma.affliction.delete({ where: { id } });
  }

  /**
   * Ends active office afflictions matching filters ("cortar evento").
   * Returns deleted userIds (unique) and count.
   */
  async cutActive(input: {
    targetKind?: 'coach' | 'treasurer';
    code?: string;
  }): Promise<{ removed: number; userIds: string[] }> {
    const now = new Date();
    const rows = await this.prisma.affliction.findMany({
      where: {
        expiresAt: { gt: now },
        targetKind: input.targetKind ?? { in: ['coach', 'treasurer'] },
        ...(input.code ? { code: input.code } : {}),
      },
      select: { id: true, userId: true },
    });
    if (rows.length === 0) return { removed: 0, userIds: [] };

    await this.prisma.affliction.deleteMany({
      where: { id: { in: rows.map((r) => r.id) } },
    });

    return {
      removed: rows.length,
      userIds: [...new Set(rows.map((r) => r.userId))],
    };
  }

  async getActiveSummary(userId: string, now = new Date()): Promise<ActiveAfflictions> {
    const rows = await this.listActiveForUser(userId, now);
    const summary: ActiveAfflictions = {
      coach: false,
      treasurer: false,
      players: new Map(),
    };
    for (const row of rows) {
      if (row.targetKind === 'coach') summary.coach = true;
      else if (row.targetKind === 'treasurer') summary.treasurer = true;
      else if (row.targetId) summary.players.set(row.targetId, row.code);
    }
    return summary;
  }

  async isCoachAfflicted(userId: string, now = new Date()): Promise<boolean> {
    const row = await this.prisma.affliction.findFirst({
      where: { userId, targetKind: 'coach', expiresAt: { gt: now } },
      select: { id: true },
    });
    return !!row;
  }

  async isTreasurerAfflicted(userId: string, now = new Date()): Promise<boolean> {
    const row = await this.prisma.affliction.findFirst({
      where: { userId, targetKind: 'treasurer', expiresAt: { gt: now } },
      select: { id: true },
    });
    return !!row;
  }
}

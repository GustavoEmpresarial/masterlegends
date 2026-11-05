import type { PrismaClient } from '@prisma/client';
import type { OfficeStaffRoleConfigDTO, CoachStaffRoleConfigDTO } from '@mll/shared';
import { MgtTxType } from '@mll/shared';
import { AppError, ErrorCode } from '../../common/lib/errors.js';
import { PlatformConfigService } from '../platform/platform-config.service.js';
import { applyMgtDebit } from '../wallet/mgt-ledger.js';
import { mapOfficeStaffConfig } from './office-config.js';
import { AfflictionService } from '../afflictions/affliction.service.js';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export type StaffKind = 'treasurer' | 'coach';

export interface OfficeStaffStatus {
  hired: boolean;
  hiredAt: string | null;
  lastBilledAt: string | null;
  nextBillingAt: string | null;
  weeklyUsdc: number;
  enabled: boolean;
  name: string;
  roleLabel: string;
  avatar: string;
  accent: string;
  perks: { icon: string; text: string }[];
  afflicted: boolean;
  afflictionExpiresAt: string | null;
}

export interface OfficeStatus {
  treasurer: OfficeStaffStatus;
  coach: OfficeStaffStatus & { miningFeePct: number; staminaRecoveryPerHour: number };
  gmtBalance: number;
  usdcBalance: number;
}

export interface CoachFeeReportEntry {
  id: string;
  amount: number;
  createdAt: string;
  blockNumber: number | null;
  gross: number | null;
  feePct: number | null;
}

export interface CoachFeeReport {
  totalFees: number;
  txCount: number;
  lastAt: string | null;
  recent: CoachFeeReportEntry[];
}

export class OfficeService {
  private readonly platform: PlatformConfigService;

  constructor(private readonly prisma: PrismaClient) {
    this.platform = new PlatformConfigService(prisma);
  }

  async getStatus(userId: string): Promise<OfficeStatus> {
    await this.runBilling(userId);
    return this.snapshot(userId);
  }

  async getCoachFeeReport(userId: string, limit = 1): Promise<CoachFeeReport> {
    const take = Math.min(50, Math.max(1, limit));
    const [agg, recentRows] = await Promise.all([
      this.prisma.mGTTransaction.aggregate({
        where: { userId, type: MgtTxType.COACH_FEE },
        _sum: { amount: true },
        _count: { _all: true },
        _max: { createdAt: true },
      }),
      this.prisma.mGTTransaction.findMany({
        where: { userId, type: MgtTxType.COACH_FEE },
        orderBy: { createdAt: 'desc' },
        take,
        select: { id: true, amount: true, createdAt: true, meta: true },
      }),
    ]);

    const sumRaw = Number(agg._sum.amount ?? 0);
    // Ledger stores coach_fee as negative amounts; report shows absolute fees paid.
    const totalFees = Math.abs(sumRaw);

    return {
      totalFees,
      txCount: agg._count._all,
      lastAt: agg._max.createdAt?.toISOString() ?? null,
      recent: recentRows.map((row) => {
        const meta = (row.meta ?? {}) as Record<string, unknown>;
        const blockRaw = meta.blockNumber;
        const blockNumber =
          typeof blockRaw === 'number'
            ? blockRaw
            : typeof blockRaw === 'string'
              ? Number(blockRaw)
              : null;
        const gross = typeof meta.gross === 'number' ? meta.gross : null;
        const feePct = typeof meta.feePct === 'number' ? meta.feePct : null;
        return {
          id: row.id,
          amount: Math.abs(Number(row.amount)),
          createdAt: row.createdAt.toISOString(),
          blockNumber: Number.isFinite(blockNumber) ? blockNumber : null,
          gross,
          feePct,
        };
      }),
    };
  }

  async hire(userId: string, kind: StaffKind): Promise<OfficeStatus> {
    await this.platform.ensureDefault();
    const row = await this.prisma.platformConfig.findUniqueOrThrow({ where: { id: 'default' } });
    const cfg = mapOfficeStaffConfig(row);
    if (kind === 'treasurer') {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 400, { reason: 'staff_disabled' });
    }
    const role = cfg.coach;

    if (!role.enabled) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 400, { reason: 'staff_disabled' });
    }

    const cost = role.weeklyUsdc;

    await this.prisma.$transaction(async (tx) => {
      const club = await tx.club.findUnique({ where: { userId } });
      if (!club) throw new AppError(ErrorCode.CLUB_NOT_FOUND, 404);
      if (club.coachHiredAt) return;

      if (cost > 0) {
        await applyMgtDebit(tx, userId, cost, MgtTxType.OFFICE_HIRE, { staff: kind });
      }

      const now = new Date();
      await tx.club.update({
        where: { id: club.id },
        data: { coachHiredAt: now, coachLastBilledAt: now },
      });
    });

    return this.snapshot(userId);
  }

  /** Contratação pelo admin — sem cobrança. */
  async adminHire(userId: string, kind: StaffKind): Promise<OfficeStatus> {
    if (kind === 'treasurer') {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 400, { reason: 'staff_disabled' });
    }
    await this.platform.ensureDefault();
    const row = await this.prisma.platformConfig.findUniqueOrThrow({ where: { id: 'default' } });
    const cfg = mapOfficeStaffConfig(row);
    const role = cfg.coach;
    if (!role.enabled) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 400, { reason: 'staff_disabled' });
    }

    const club = await this.prisma.club.findUnique({ where: { userId } });
    if (!club) throw new AppError(ErrorCode.CLUB_NOT_FOUND, 404);

    const now = new Date();
    await this.prisma.club.update({
      where: { id: club.id },
      data: { coachHiredAt: now, coachLastBilledAt: now },
    });

    return this.snapshot(userId);
  }

  async fire(userId: string, kind: StaffKind): Promise<OfficeStatus> {
    const club = await this.prisma.club.findUnique({ where: { userId } });
    if (!club) throw new AppError(ErrorCode.CLUB_NOT_FOUND, 404);
    await this.prisma.club.update({
      where: { id: club.id },
      data:
        kind === 'treasurer'
          ? { treasurerHiredAt: null, treasurerLastBilledAt: null }
          : { coachHiredAt: null, coachLastBilledAt: null },
    });
    return this.snapshot(userId);
  }

  async adminFire(userId: string, kind: StaffKind): Promise<OfficeStatus> {
    return this.fire(userId, kind);
  }

  /** Cobra mensalidades pendentes; demite se faltar saldo. Chamado lazy a cada leitura. */
  private async runBilling(userId: string) {
    const club = await this.prisma.club.findUnique({ where: { userId } });
    if (!club) return;
    await this.platform.ensureDefault();
    const row = await this.prisma.platformConfig.findUniqueOrThrow({ where: { id: 'default' } });
    const cfg = mapOfficeStaffConfig(row);
    const now = new Date();

    const role = cfg.coach;
    const hiredAt = club.coachHiredAt;
    const lastBilled = club.coachLastBilledAt;
    const weekly = role.weeklyUsdc;
    if (hiredAt && lastBilled) {
      const elapsed = now.getTime() - lastBilled.getTime();
      const weeksDue = Math.floor(elapsed / WEEK_MS);
      if (weeksDue > 0) {
        if (weekly <= 0) {
          await this.prisma.club.update({
            where: { id: club.id },
            data: { coachLastBilledAt: new Date(lastBilled.getTime() + weeksDue * WEEK_MS) },
          });
        } else {
          const due = weekly * weeksDue;
          try {
            await this.prisma.$transaction(async (tx) => {
              await applyMgtDebit(tx, userId, due, MgtTxType.OFFICE_FEE, {
                staff: 'coach',
                weeks: weeksDue,
              });
              await tx.club.update({
                where: { id: club.id },
                data: { coachLastBilledAt: new Date(lastBilled.getTime() + weeksDue * WEEK_MS) },
              });
            });
          } catch {
            await this.prisma.club.update({
              where: { id: club.id },
              data: { coachHiredAt: null, coachLastBilledAt: null },
            });
          }
        }
      }
    }
  }

  private async snapshot(userId: string): Promise<OfficeStatus> {
    const afflictions = new AfflictionService(this.prisma);
    const [club, balance, activeSummary] = await Promise.all([
      this.prisma.club.findUnique({ where: { userId } }),
      this.prisma.mGTBalance.findUnique({ where: { userId } }),
      afflictions.getActiveSummary(userId),
    ]);
    if (!club) throw new AppError(ErrorCode.CLUB_NOT_FOUND, 404);

    const coachAffliction = activeSummary.coach
      ? await this.prisma.affliction.findFirst({
          where: { userId, targetKind: 'coach', expiresAt: { gt: new Date() } },
          orderBy: { expiresAt: 'asc' },
        })
      : null;
    const treasurerAffliction = activeSummary.treasurer
      ? await this.prisma.affliction.findFirst({
          where: { userId, targetKind: 'treasurer', expiresAt: { gt: new Date() } },
          orderBy: { expiresAt: 'asc' },
        })
      : null;

    await this.platform.ensureDefault();
    const row = await this.prisma.platformConfig.findUniqueOrThrow({ where: { id: 'default' } });
    const cfg = mapOfficeStaffConfig(row);

    const build = (
      hiredAt: Date | null,
      lastBilledAt: Date | null,
      role: OfficeStaffRoleConfigDTO,
      afflicted: boolean,
      afflictionExpiresAt: Date | null,
    ): OfficeStaffStatus => ({
      hired: !!hiredAt,
      hiredAt: hiredAt?.toISOString() ?? null,
      lastBilledAt: lastBilledAt?.toISOString() ?? null,
      nextBillingAt: lastBilledAt ? new Date(lastBilledAt.getTime() + WEEK_MS).toISOString() : null,
      weeklyUsdc: role.weeklyUsdc,
      enabled: role.enabled,
      name: role.name,
      roleLabel: role.roleLabel,
      avatar: role.avatar,
      accent: role.accent,
      perks: role.perks,
      afflicted,
      afflictionExpiresAt: afflictionExpiresAt?.toISOString() ?? null,
    });

    const coachRole = cfg.coach as CoachStaffRoleConfigDTO;

    return {
      treasurer: build(club.treasurerHiredAt, club.treasurerLastBilledAt, cfg.treasurer, activeSummary.treasurer, treasurerAffliction?.expiresAt ?? null),
      coach: {
        ...build(club.coachHiredAt, club.coachLastBilledAt, coachRole, activeSummary.coach, coachAffliction?.expiresAt ?? null),
        miningFeePct: coachRole.miningFeePct,
        staminaRecoveryPerHour: coachRole.staminaRecoveryPerHour,
      },
      gmtBalance: Number(balance?.amount ?? 0),
      usdcBalance: Number(balance?.usdcAmount ?? 0),
    };
  }
}

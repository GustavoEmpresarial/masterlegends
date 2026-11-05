import { normalizePassRewards } from './pass-reward.service.js';
import type { PrismaClient } from '@prisma/client';
import { Prisma } from '@prisma/client';
import {
  parsePassLevels,
  parsePassMissions,
  parsePassRewardBlocks,
  passSeasonCreateSchema,
  passSeasonPatchSchema,
  type PassSeasonDTO,
} from '@mll/shared';
import { AppError, ErrorCode } from '../../common/lib/errors.js';

function mapSeason(row: {
  id: number;
  name: string;
  startsAt: Date;
  endsAt: Date;
  active: boolean;
  premiumPriceUsdc: Prisma.Decimal;
  levels: unknown;
  missions: unknown;
  rewardBlocks?: unknown;
}): PassSeasonDTO {
  return {
    id: row.id,
    name: row.name,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    active: row.active,
    premiumPriceUsdc: Number(row.premiumPriceUsdc),
    levels: parsePassLevels(row.levels),
    missions: parsePassMissions(row.missions),
    rewardBlocks: parsePassRewardBlocks(row.rewardBlocks),
  };
}

const MAX_ACTIVE_SEASONS = 2;

async function assertRoomForAnotherActive(
  tx: Prisma.TransactionClient,
  exceptId?: number,
): Promise<void> {
  const activeCount = await tx.season.count({
    where: {
      active: true,
      ...(exceptId !== undefined ? { NOT: { id: exceptId } } : {}),
    },
  });
  if (activeCount >= MAX_ACTIVE_SEASONS) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, 400, {
      message: 'Só dá para deixar 2 passes ativos ao mesmo tempo.',
    });
  }
}

export class PassSeasonAdminService {
  constructor(private readonly prisma: PrismaClient) {}

  async list(): Promise<PassSeasonDTO[]> {
    const rows = await this.prisma.season.findMany({ orderBy: { id: 'desc' } });
    return rows.map(mapSeason);
  }

  async create(input: unknown): Promise<PassSeasonDTO> {
    const body = passSeasonCreateSchema.parse(input);
    body.levels = await normalizePassRewards(this.prisma, body.levels);
    body.rewardBlocks = await normalizePassRewards(this.prisma, body.rewardBlocks);

    const row = await this.prisma.$transaction(async tx => {
      if (body.active) {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(708521)::text`;
        await assertRoomForAnotherActive(tx);
      }
      return tx.season.create({
      data: {
        name: body.name,
        startsAt: new Date(body.startsAt),
        endsAt: new Date(body.endsAt),
        active: body.active,
        premiumPriceUsdc: new Prisma.Decimal(body.premiumPriceUsdc),
        levels: body.levels,
        missions: body.missions,
        rewardBlocks: body.rewardBlocks ?? [],
      },
      });
    });

    return mapSeason(row);
  }

  async update(id: number, input: unknown): Promise<PassSeasonDTO> {
    const body = passSeasonPatchSchema.parse(input);
    if (body.levels) body.levels = await normalizePassRewards(this.prisma, body.levels);
    if (body.rewardBlocks) body.rewardBlocks = await normalizePassRewards(this.prisma, body.rewardBlocks);
    const existing = await this.prisma.season.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError(ErrorCode.PASS_NO_ACTIVE_SEASON, 404);
    }

    const mergedLevels =
      body.levels !== undefined ? body.levels : parsePassLevels(existing.levels);
    if (body.active === true && mergedLevels.length === 0) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 400, { reason: 'pass_levels_required' });
    }

    if ((body.startsAt ? new Date(body.startsAt) : existing.startsAt) >= (body.endsAt ? new Date(body.endsAt) : existing.endsAt)) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 400, { message: 'O fim da temporada precisa ser posterior ao início.' });
    }
    if (body.active === true) {
      body.levels = await normalizePassRewards(this.prisma, mergedLevels);
      body.rewardBlocks = await normalizePassRewards(this.prisma, body.rewardBlocks ?? parsePassRewardBlocks(existing.rewardBlocks));
    }
    const row = await this.prisma.$transaction(async tx => {
      if (body.active === true) {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(708521)::text`;
        await assertRoomForAnotherActive(tx, id);
      }
      return tx.season.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.startsAt !== undefined ? { startsAt: new Date(body.startsAt) } : {}),
        ...(body.endsAt !== undefined ? { endsAt: new Date(body.endsAt) } : {}),
        ...(body.active !== undefined ? { active: body.active } : {}),
        ...(body.premiumPriceUsdc !== undefined
          ? { premiumPriceUsdc: new Prisma.Decimal(body.premiumPriceUsdc) }
          : {}),
        ...(body.levels !== undefined ? { levels: body.levels } : {}),
        ...(body.missions !== undefined ? { missions: body.missions } : {}),
        ...(body.rewardBlocks !== undefined ? { rewardBlocks: body.rewardBlocks } : {}),
      },
      });
    });

    return mapSeason(row);
  }

  async remove(id: number) {
    const existing = await this.prisma.season.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError(ErrorCode.PASS_NO_ACTIVE_SEASON, 404);
    }
    await this.prisma.season.delete({ where: { id } });
    return { ok: true as const };
  }
}

export interface ConfiguredPassSeason {
  id: number;
  name: string;
  startsAt: Date;
  endsAt: Date;
  premiumPriceUsdc: number;
  levels: ReturnType<typeof parsePassLevels>;
  missions: ReturnType<typeof parsePassMissions>;
  rewardBlocks: ReturnType<typeof parsePassRewardBlocks>;
}

export async function findConfiguredPassSeasons(
  prisma: Pick<PrismaClient, 'season'>,
): Promise<ConfiguredPassSeason[]> {
  const rows = await prisma.season.findMany({
    where: { active: true },
    orderBy: { id: 'asc' },
  });
  const now = new Date();
  const seasons: ConfiguredPassSeason[] = [];
  for (const row of rows) {
    const levels = parsePassLevels(row.levels);
    if (levels.length === 0) continue;
    if (row.startsAt > now || row.endsAt <= now) continue;
    seasons.push({
      id: row.id,
      name: row.name,
      startsAt: row.startsAt,
      endsAt: row.endsAt,
      premiumPriceUsdc: Number(row.premiumPriceUsdc),
      levels,
      missions: parsePassMissions(row.missions),
      rewardBlocks: parsePassRewardBlocks((row as { rewardBlocks?: unknown }).rewardBlocks),
    });
  }
  return seasons;
}

export async function findConfiguredPassSeason(
  prisma: Pick<PrismaClient, 'season'>,
): Promise<ConfiguredPassSeason | null> {
  const seasons = await findConfiguredPassSeasons(prisma);
  return seasons[0] ?? null;
}

export function passLevelFromConfiguredXp(
  xp: number,
  levels: ConfiguredPassSeason['levels'],
): number {
  let level = 0;
  for (const entry of levels) {
    if (xp >= entry.xpRequired) level = entry.level;
  }
  return level;
}

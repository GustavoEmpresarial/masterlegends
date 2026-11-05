import { FastifyInstance } from 'fastify';
import { createClubSchema, playerAgeFromRoi, upgradeBuildingParamsSchema } from '@mll/shared';
import { JobQueues } from '../../common/lib/queues.js';
import { GearService } from '../stadium-shop/gear.service.js';
import { StadiumRepository } from '../stadium/stadium.repository.js';
import { StaminaService } from '../stamina/stamina.service.js';
import { VestiarioTemplateRepository } from '../vestiario/vestiario-template.repository.js';
import { ClubRepository } from './club.repository.js';
import { ClubService } from './club.service.js';

export async function registerClubRoutes(app: FastifyInstance) {
  const clubRepo = new ClubRepository(app.prisma);
  const staminaService = new StaminaService(
    app.prisma,
    clubRepo,
    new StadiumRepository(app.prisma),
    new VestiarioTemplateRepository(app.prisma),
  );
  const service = new ClubService(
    clubRepo,
    staminaService,
    app.prisma,
    new JobQueues(app.redisQueue),
    app.redis,
  );
  const gear = new GearService(app.prisma, clubRepo);

  app.get(
    '/',
    { schema: { tags: ['club'], security: [{ bearerAuth: [] }] } },
    async (request) => service.getClub(request.user.id),
  );

  app.post(
    '/create',
    { schema: { tags: ['club'], security: [{ bearerAuth: [] }] } },
    async (request) => {
      const body = createClubSchema.parse(request.body);
      return service.createClub(request.user.id, body);
    },
  );

  app.get(
    '/inventory',
    { schema: { tags: ['club'], security: [{ bearerAuth: [] }] } },
    async (request) => service.getInventory(request.user.id),
  );

  app.get(
    '/gear',
    { schema: { tags: ['club'], security: [{ bearerAuth: [] }] } },
    async (request) => gear.getBag(request.user.id),
  );

  app.post(
    '/gear/equip',
    {
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
      schema: { tags: ['club'], security: [{ bearerAuth: [] }] },
    },
    async (request) => gear.equip(request.user.id, request.body),
  );

  app.post(
    '/gear/unequip',
    {
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
      schema: { tags: ['club'], security: [{ bearerAuth: [] }] },
    },
    async (request) => gear.unequip(request.user.id, request.body),
  );

  app.post(
    '/upgrade/:building',
    { schema: { tags: ['club'], security: [{ bearerAuth: [] }] } },
    async (request) => {
      const params = upgradeBuildingParamsSchema.parse(request.params);
      return service.upgradeBuilding(request.user.id, params.building);
    },
  );

  app.get(
    '/museum',
    { schema: { tags: ['club'], security: [{ bearerAuth: [] }] } },
    async (request) => {
      const userId = request.user.id;
      const club = await app.prisma.club.findUnique({
        where: { userId },
        select: { id: true, name: true, trophyRoomLvl: true, createdAt: true },
      });
      if (!club) return { trophies: [], retiredPlayers: [], clubInfo: null };

      const [trophies, retiredPlayers, miningBalance, stadiumTemplates, lineup, licenses] = await Promise.all([
        app.prisma.clubTrophy.findMany({
          where: { clubId: club.id },
          orderBy: { wonAt: 'desc' },
        }),
        app.prisma.basePlayer.findMany({
          where: { userId, retiredAt: { not: null } },
          orderBy: { retiredAt: 'desc' },
          select: {
            id: true,
            name: true,
            rarity: true,
            overwall: true,
            position: true,
            imageUrl: true,
            source: true,
            fieldedAt: true,
            expiresAt: true,
            retiredAt: true,
            createdAt: true,
            costBasisUsdc: true,
            lifetimeEarnedUsdc: true,
          },
        }),
        app.prisma.miningBalance.findUnique({ where: { userId }, select: { lifetimeEarned: true } }),
        app.prisma.stadiumTemplate.findMany({
          where: { active: true },
          orderBy: { sortOrder: 'asc' },
          select: {
            id: true,
            name: true,
            imageUrl: true,
            sortOrder: true,
            farmBonusPct: true,
            priceUsdc: true,
            isDefault: true,
          },
        }),
        app.prisma.clubLineup.findUnique({
          where: { clubId: club.id },
          select: { stadiumTemplateId: true },
        }),
        app.prisma.clubStadiumLicense.findMany({
          where: { clubId: club.id },
          select: { stadiumTemplateId: true, status: true },
        }),
      ]);

      const RARITY_NAMES = ['common', 'uncommon', 'rare', 'super-rare', 'epic', 'legendary'];
      const POSITION_NAMES = ['GK', 'DEF', 'MID', 'FW', 'LAT'];
      const licenseByTemplate = new Map(licenses.map((l) => [l.stadiumTemplateId, l.status]));

      return {
        trophies: trophies.map((t) => ({
          id: t.id,
          name: t.name,
          description: t.description,
          imageUrl: t.imageUrl,
          wonAt: t.wonAt.toISOString(),
          createdAt: t.createdAt.toISOString(),
        })),
        retiredPlayers: retiredPlayers.map((p) => {
          const costBasisUsdc = Number(p.costBasisUsdc ?? 0);
          const lifetimeEarnedUsdc = Number(p.lifetimeEarnedUsdc ?? 0);
          const career = playerAgeFromRoi(costBasisUsdc, lifetimeEarnedUsdc, {
            alreadyRetired: true,
          });
          return {
            id: p.id,
            name: p.name,
            rarity: RARITY_NAMES[p.rarity] ?? 'common',
            overwall: p.overwall,
            position: POSITION_NAMES[p.position] ?? 'FW',
            imageUrl: p.imageUrl,
            source: p.source,
            fieldedAt: p.fieldedAt?.toISOString() ?? null,
            expiresAt: p.expiresAt?.toISOString() ?? null,
            retiredAt: p.retiredAt!.toISOString(),
            createdAt: p.createdAt.toISOString(),
            costBasisUsdc,
            lifetimeEarnedUsdc,
            age: career.age,
            retireAge: career.retireAge,
            roiPct: career.roiPct,
            hasCareerCycle: career.hasCareerCycle,
          };
        }),
        clubInfo: {
          name: club.name,
          trophyRoomLvl: club.trophyRoomLvl,
          createdAt: club.createdAt.toISOString(),
          lifetimeEarnedUsdc: miningBalance?.lifetimeEarned?.toString() ?? '0',
        },
        stadiums: stadiumTemplates.map((s) => {
          const price = s.priceUsdc != null ? Number(s.priceUsdc) : null;
          const isFree = price == null || price <= 0;
          const licenseStatus = licenseByTemplate.get(s.id) ?? (isFree ? 'signed' : null);
          return {
            id: s.id,
            name: s.name,
            imageUrl: s.imageUrl,
            sortOrder: s.sortOrder,
            farmBonusPct: Number(s.farmBonusPct),
            priceUsdc: price,
            isFree,
            licenseStatus,
            isCurrent: s.id === (lineup?.stadiumTemplateId ?? null),
          };
        }),
      };
    },
  );
}

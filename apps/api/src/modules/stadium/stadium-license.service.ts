import type { PrismaClient, StadiumTemplate } from '@prisma/client';
import { Prisma } from '@prisma/client';
import {
  MgtTxType,
  STADIUM_CONTRACT_VERSION,
  STADIUM_LICENSE_RARE_STARTERS_REQUIRED,
  stadiumMinRarityIndex,
  stadiumRarityLabel,
  type StadiumLicenseCatalogDTO,
  type StadiumLicenseCatalogItemDTO,
} from '@mll/shared';
import { AppError, ErrorCode } from '../../common/lib/errors.js';
import { applyMgtDebit } from '../wallet/mgt-ledger.js';
import { MiningService } from '../mining/mining.service.js';

function isFreePrice(priceUsdc: Prisma.Decimal | number | null | undefined): boolean {
  if (priceUsdc == null) return true;
  return Number(priceUsdc) <= 0;
}

function slotCount(slots: unknown): number {
  return Array.isArray(slots) ? slots.length : 0;
}

function rareRequiredFor(template: Pick<StadiumTemplate, 'requireRareStarters' | 'priceUsdc'>): number {
  if (isFreePrice(template.priceUsdc)) return 0;
  const n = template.requireRareStarters;
  if (typeof n === 'number' && Number.isFinite(n)) return Math.max(0, n);
  return STADIUM_LICENSE_RARE_STARTERS_REQUIRED;
}

export class StadiumLicenseService {
  private readonly mining: MiningService;

  constructor(private readonly prisma: PrismaClient) {
    this.mining = new MiningService(prisma);
  }

  async getCatalog(userId: string): Promise<StadiumLicenseCatalogDTO> {
    const club = await this.prisma.club.findUnique({ where: { userId } });
    if (!club) throw new AppError(ErrorCode.CLUB_NOT_FOUND, 404);

    await this.ensureFreeLicenses(club.id);

    const templates = await this.prisma.stadiumTemplate.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: { requireOwnedTemplate: { select: { id: true, name: true } } },
    });
    const rarityIndexes = [...new Set(templates.map((t) => stadiumMinRarityIndex(t.sortOrder)))];
    const [licenses, lineup, balance, currentOverwall, squadCounts] = await Promise.all([
      this.prisma.clubStadiumLicense.findMany({ where: { clubId: club.id } }),
      this.prisma.clubLineup.findUnique({
        where: { clubId: club.id },
        select: { stadiumTemplateId: true },
      }),
      this.prisma.mGTBalance.findUnique({ where: { userId } }),
      this.mining.getUserOverwall(userId),
      Promise.all(rarityIndexes.map(async (index) => [index, await this.countSquadPlayers(userId, index)] as const)),
    ]);
    const squadByRarity = new Map(squadCounts);

    const licenseByTemplate = new Map(licenses.map((l) => [l.stadiumTemplateId, l]));
    const signedOwnedIds = new Set(
      licenses.filter((l) => l.status === 'signed').map((l) => l.stadiumTemplateId),
    );
    const currentId = lineup?.stadiumTemplateId ?? null;

    const paidRareReqs = templates
      .filter((t) => !isFreePrice(t.priceUsdc))
      .map((t) => rareRequiredFor(t));
    const rareStartersRequired =
      paidRareReqs.length > 0 ? Math.max(...paidRareReqs) : STADIUM_LICENSE_RARE_STARTERS_REQUIRED;
    const firstSquad = squadByRarity.get(stadiumMinRarityIndex(0)) ?? 0;
    const meetsRareTeamRequirement = firstSquad >= rareStartersRequired;

    const items: StadiumLicenseCatalogItemDTO[] = templates.map((t) => {
      const free = isFreePrice(t.priceUsdc);
      const lic = licenseByTemplate.get(t.id);
      const requireRare = rareRequiredFor(t);
      const minRarity = stadiumMinRarityIndex(t.sortOrder);
      const squadCount = squadByRarity.get(minRarity) ?? 0;
      const requireMinOw = t.requireMinOverwall ?? 0;
      const requireOwnedId = t.requireOwnedTemplateId ?? null;
      const requireOwnedName = t.requireOwnedTemplate?.name ?? null;
      const blockers: string[] = [];

      if (!free && lic == null) {
        if (requireRare > 0 && squadCount < requireRare) {
          blockers.push(
            `${stadiumRarityLabel(minRarity)} ou superior: ${squadCount}/${requireRare}`,
          );
        }
        if (requireMinOw > 0 && currentOverwall < requireMinOw) {
          blockers.push(`Overwall: ${currentOverwall}/${requireMinOw}`);
        }
        if (requireOwnedId && !signedOwnedIds.has(requireOwnedId)) {
          blockers.push(
            requireOwnedName
              ? `Precisa da licença: ${requireOwnedName}`
              : 'Precisa de outro campo licenciado',
          );
        }
      }

      return {
        templateId: t.id,
        name: t.name,
        imageUrl: t.imageUrl,
        priceUsdc: t.priceUsdc != null ? Number(t.priceUsdc) : null,
        isFree: free,
        isDefault: t.isDefault,
        farmBonusPct: Number(t.farmBonusPct),
        slotCount: slotCount(t.slots),
        licenseStatus: lic ? (lic.status as 'purchased' | 'signed') : null,
        isCurrent: t.id === currentId && lic?.status === 'signed',
        purchasedAt: lic?.purchasedAt?.toISOString() ?? null,
        signedAt: lic?.signedAt?.toISOString() ?? null,
        contractVersion: lic?.contractVersion ?? null,
        requireRareStarters: requireRare,
        requireMinRarity: minRarity,
        squadCount,
        requireMinOverwall: requireMinOw,
        requireOwnedTemplateId: requireOwnedId,
        requireOwnedTemplateName: requireOwnedName,
        requirementNote: t.requirementNote ?? null,
        meetsRequirements: blockers.length === 0,
        requirementBlockers: blockers,
      };
    });

    return {
      clubName: club.name,
      usdcBalance: Number(balance?.usdcAmount ?? 0),
      gmtBalance: Number(balance?.amount ?? 0),
      contractVersion: STADIUM_CONTRACT_VERSION,
      rareStartersRequired,
      rareStartersCount: firstSquad,
      meetsRareTeamRequirement,
      currentOverwall,
      items,
    };
  }

  /** Players at this rarity or higher in the club squad (base + NFT), not retired. */
  async countSquadPlayers(userId: string, minRarity: number): Promise<number> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { wallet: true },
    });

    const [baseCount, nftCount] = await Promise.all([
      this.prisma.basePlayer.count({
        where: {
          userId,
          retiredAt: null,
          rarity: { gte: minRarity },
        },
      }),
      user?.wallet
        ? this.prisma.playerCache.count({
            where: {
              ownerWallet: user.wallet,
              rarity: { gte: minRarity },
            },
          })
        : Promise.resolve(0),
    ]);

    return baseCount + nftCount;
  }

  private async assertPurchaseRequirements(
    userId: string,
    clubId: string,
    template: StadiumTemplate,
  ): Promise<void> {
    if (isFreePrice(template.priceUsdc)) return;

    const requireRare = rareRequiredFor(template);
    const minRarity = stadiumMinRarityIndex(template.sortOrder);
    if (requireRare > 0) {
      const count = await this.countSquadPlayers(userId, minRarity);
      if (count < requireRare) {
        throw new AppError(ErrorCode.STADIUM_LICENSE_RARE_TEAM_REQUIRED, 400, {
          required: requireRare,
          current: count,
          minRarity: stadiumRarityLabel(minRarity),
        });
      }
    }

    const requireMinOw = template.requireMinOverwall ?? 0;
    if (requireMinOw > 0) {
      const ow = await this.mining.getUserOverwall(userId);
      if (ow < requireMinOw) {
        throw new AppError(ErrorCode.STADIUM_LICENSE_MIN_OVERWALL_REQUIRED, 400, {
          required: requireMinOw,
          current: ow,
        });
      }
    }

    const prereqId = template.requireOwnedTemplateId;
    if (prereqId) {
      const prereq = await this.prisma.clubStadiumLicense.findUnique({
        where: {
          clubId_stadiumTemplateId: { clubId, stadiumTemplateId: prereqId },
        },
        include: { stadiumTemplate: { select: { name: true } } },
      });
      if (!prereq || prereq.status !== 'signed') {
        throw new AppError(ErrorCode.STADIUM_LICENSE_PREVIOUS_REQUIRED, 400, {
          requiredTemplateId: prereqId,
          requiredTemplateName: prereq?.stadiumTemplate.name ?? null,
        });
      }
    }
  }

  /** Auto-grant signed licenses for free/default active templates. */
  async ensureFreeLicenses(clubId: string): Promise<void> {
    const freeTemplates = await this.prisma.stadiumTemplate.findMany({
      where: {
        active: true,
        OR: [{ priceUsdc: null }, { priceUsdc: { lte: 0 } }],
      },
      select: { id: true },
    });
    if (freeTemplates.length === 0) return;

    const now = new Date();
    for (const t of freeTemplates) {
      await this.prisma.clubStadiumLicense.upsert({
        where: {
          clubId_stadiumTemplateId: { clubId, stadiumTemplateId: t.id },
        },
        create: {
          clubId,
          stadiumTemplateId: t.id,
          status: 'signed',
          pricePaidUsdc: 0,
          purchasedAt: now,
          signedAt: now,
          contractVersion: STADIUM_CONTRACT_VERSION,
        },
        update: {
          status: 'signed',
          signedAt: now,
          contractVersion: STADIUM_CONTRACT_VERSION,
        },
      });
    }
  }

  async buy(userId: string, templateId: string): Promise<StadiumLicenseCatalogDTO> {
    const club = await this.prisma.club.findUnique({ where: { userId } });
    if (!club) throw new AppError(ErrorCode.CLUB_NOT_FOUND, 404);

    const template = await this.prisma.stadiumTemplate.findFirst({
      where: { id: templateId, active: true },
    });
    if (!template) throw new AppError(ErrorCode.STADIUM_TEMPLATE_NOT_FOUND, 404);

    if (isFreePrice(template.priceUsdc)) {
      throw new AppError(ErrorCode.STADIUM_LICENSE_FREE, 400, { reason: 'template_is_free' });
    }

    await this.assertPurchaseRequirements(userId, club.id, template);

    const existing = await this.prisma.clubStadiumLicense.findUnique({
      where: {
        clubId_stadiumTemplateId: { clubId: club.id, stadiumTemplateId: templateId },
      },
    });
    if (existing) {
      throw new AppError(ErrorCode.STADIUM_LICENSE_ALREADY_OWNED, 400, { status: existing.status });
    }

    const price = Number(template.priceUsdc);
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      await applyMgtDebit(tx, userId, price, MgtTxType.STADIUM_LICENSE, {
        stadiumTemplateId: templateId,
        name: template.name,
      });
      await tx.clubStadiumLicense.create({
        data: {
          clubId: club.id,
          stadiumTemplateId: templateId,
          status: 'purchased',
          pricePaidUsdc: price,
          purchasedAt: now,
          contractVersion: STADIUM_CONTRACT_VERSION,
        },
      });
    });

    return this.getCatalog(userId);
  }

  async sign(userId: string, templateId: string): Promise<StadiumLicenseCatalogDTO> {
    const club = await this.prisma.club.findUnique({ where: { userId } });
    if (!club) throw new AppError(ErrorCode.CLUB_NOT_FOUND, 404);

    const license = await this.prisma.clubStadiumLicense.findUnique({
      where: {
        clubId_stadiumTemplateId: { clubId: club.id, stadiumTemplateId: templateId },
      },
    });
    if (!license) throw new AppError(ErrorCode.STADIUM_LICENSE_NOT_FOUND, 404);
    if (license.status === 'signed') {
      return this.getCatalog(userId);
    }
    if (license.status !== 'purchased') {
      throw new AppError(ErrorCode.STADIUM_LICENSE_NOT_PURCHASED, 400, { status: license.status });
    }

    const now = new Date();
    await this.prisma.clubStadiumLicense.update({
      where: { id: license.id },
      data: {
        status: 'signed',
        signedAt: now,
        contractVersion: STADIUM_CONTRACT_VERSION,
      },
    });

    return this.getCatalog(userId);
  }

  async activate(userId: string, templateId: string): Promise<StadiumLicenseCatalogDTO> {
    const club = await this.prisma.club.findUnique({ where: { userId } });
    if (!club) throw new AppError(ErrorCode.CLUB_NOT_FOUND, 404);

    await this.ensureFreeLicenses(club.id);

    const license = await this.prisma.clubStadiumLicense.findUnique({
      where: {
        clubId_stadiumTemplateId: { clubId: club.id, stadiumTemplateId: templateId },
      },
    });
    if (!license) throw new AppError(ErrorCode.STADIUM_LICENSE_NOT_FOUND, 404);
    if (license.status !== 'signed') {
      throw new AppError(ErrorCode.STADIUM_LICENSE_NOT_SIGNED, 400, { status: license.status });
    }

    const template = await this.prisma.stadiumTemplate.findFirst({
      where: { id: templateId, active: true },
    });
    if (!template) throw new AppError(ErrorCode.STADIUM_TEMPLATE_NOT_FOUND, 404);

    // Paid upgrades still enforce template requirements when switching field.
    if (!isFreePrice(template.priceUsdc)) {
      await this.assertPurchaseRequirements(userId, club.id, template);
    }

    const lineup = await this.prisma.clubLineup.findUnique({ where: { clubId: club.id } });
    if (lineup) {
      await this.prisma.clubLineup.update({
        where: { clubId: club.id },
        data: { stadiumTemplateId: templateId },
      });
    } else {
      await this.prisma.clubLineup.create({
        data: {
          clubId: club.id,
          stadiumTemplateId: templateId,
          assignments: {},
        },
      });
    }

    return this.getCatalog(userId);
  }

  async hasSignedLicense(clubId: string, templateId: string): Promise<boolean> {
    const row = await this.prisma.clubStadiumLicense.findUnique({
      where: {
        clubId_stadiumTemplateId: { clubId, stadiumTemplateId: templateId },
      },
      select: { status: true },
    });
    return row?.status === 'signed';
  }
}

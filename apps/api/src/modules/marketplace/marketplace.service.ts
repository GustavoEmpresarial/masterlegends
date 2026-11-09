import { randomUUID } from 'node:crypto';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import type { ListingDTO, ListItemInput, ListingsQuery } from '@mll/shared';
import {
  MgtTxType,
  OFFICIAL_MARKET_SELLER_ID,
  OFFICIAL_MARKET_SELLER_NAME,
  playerAgeFromRoi,
  positionPower,
  readPlayerAttributes,
  rollPlayerAttributes,
  splitFeeBps,
} from '@mll/shared';
import { AppError, ErrorCode } from '../../common/lib/errors.js';
import { applyMgtCredit, applyMgtDebit } from '../wallet/mgt-ledger.js';
import { GAME_CONFIG, POSITION_NAMES, RARITY_NAMES, RARITY_TO_INT } from '../../config/game.js';
import { PlatformConfigService } from '../platform/platform-config.service.js';
import type { PassService } from '../pass/pass.service.js';

export class MarketplaceRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findActiveListings(query: ListingsQuery, rarityFilter: number | undefined) {
    const positionIdx = query.position ? POSITION_NAMES.indexOf(query.position) : -1;
    const overwall: { gte?: number; lte?: number } = {};
    if (query.minOverwall != null) overwall.gte = query.minOverwall;
    if (query.maxOverwall != null) overwall.lte = query.maxOverwall;
    const price: { gte?: number; lte?: number } = {};
    if (query.minPrice != null) price.gte = query.minPrice;
    if (query.maxPrice != null) price.lte = query.maxPrice;

    return this.prisma.listing.findMany({
      where: {
        active: true,
        OR: [
          { basePlayerId: null },
          { basePlayer: { templateId: null } },
          { basePlayer: { template: { active: true } } },
        ],
        ...(query.asset === 'item' ? { id: { in: [] } } : {}),
        ...(query.asset === 'player' ? { basePlayerId: { not: null } } : {}),
        ...(query.asset === 'nft' ? { tokenId: { not: null } } : {}),
        ...(rarityFilter !== undefined ? { rarity: rarityFilter } : {}),
        ...(positionIdx >= 0 ? { position: positionIdx } : {}),
        ...(Object.keys(overwall).length > 0 ? { overwall } : {}),
        ...(Object.keys(price).length > 0 ? { price } : {}),
      },
      include: {
        seller: { select: { username: true, wallet: true } },
        basePlayer: {
          select: {
            id: true,
            position: true,
            name: true,
            imageUrl: true,
            attributes: true,
            costBasisUsdc: true,
            lifetimeEarnedUsdc: true,
            template: { select: { name: true, imageUrl: true } },
          },
        },
      },
      orderBy: query.sortBy === 'price' ? { price: 'asc' } : { overwall: 'desc' },
      take: query.limit,
    });
  }

  findMyActiveListings(sellerId: string, limit = 200) {
    return this.prisma.listing.findMany({
      where: { sellerId, active: true },
      include: {
        seller: { select: { username: true, wallet: true } },
        basePlayer: {
          select: {
            id: true,
            position: true,
            name: true,
            imageUrl: true,
            attributes: true,
            costBasisUsdc: true,
            lifetimeEarnedUsdc: true,
            template: { select: { name: true, imageUrl: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  findBasePlayer(userId: string, basePlayerId: string) {
    return this.prisma.basePlayer.findFirst({
      where: { id: basePlayerId, userId },
      include: { template: { select: { name: true, imageUrl: true } } },
    });
  }

  findListing(id: string) {
    return this.prisma.listing.findUnique({
      where: { id },
      include: { basePlayer: true },
    });
  }

  async createListing(
    sellerId: string,
    player: {
      id: string;
      rarity: number;
      overwall: number;
      position: number;
      name?: string | null;
      imageUrl?: string | null;
    },
    price: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const card = await tx.basePlayer.findUnique({
        where: { id: player.id },
        select: { template: { select: { active: true } } },
      });
      if (card?.template && !card.template.active) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, 400, {
          message: 'Esse jogador está inativo e não pode ser anunciado.',
        });
      }
      const existing = await tx.listing.findUnique({
        where: { basePlayerId: player.id },
      });

      let listing;
      if (existing) {
        if (existing.active) {
          throw new AppError(ErrorCode.MARKETPLACE_ALREADY_LISTED, 400);
        }
        listing = await tx.listing.update({
          where: { id: existing.id },
          data: {
            sellerId,
            price: new Prisma.Decimal(price),
            rarity: player.rarity,
            overwall: player.overwall,
            position: player.position,
            name: player.name ?? null,
            imageUrl: player.imageUrl ?? null,
            active: true,
          },
        });
      } else {
        listing = await tx.listing.create({
          data: {
            basePlayerId: player.id,
            sellerId,
            price: new Prisma.Decimal(price),
            rarity: player.rarity,
            overwall: player.overwall,
            position: player.position,
            name: player.name ?? null,
            imageUrl: player.imageUrl ?? null,
            active: true,
          },
        });
      }

      await tx.basePlayer.update({
        where: { id: player.id },
        data: { listed: true },
      });
      return listing;
    });
  }

  async buyListing(listingId: string, buyerId: string, feeBps: number) {
    return this.prisma.$transaction(async (tx) => {
      const listing = await tx.listing.findUnique({
        where: { id: listingId },
        include: { basePlayer: { include: { template: { select: { active: true } } } } },
      });
      if (!listing || !listing.active) {
        throw new AppError(ErrorCode.MARKETPLACE_LISTING_NOT_FOUND, 404);
      }
      if (listing.sellerId === buyerId) {
        throw new AppError(ErrorCode.MARKETPLACE_CANNOT_BUY_OWN, 400);
      }

      if (listing.tokenId != null && !listing.basePlayerId) {
        const [buyer, seller] = await Promise.all([
          tx.user.findUnique({ where: { id: buyerId }, select: { wallet: true } }),
          tx.user.findUnique({ where: { id: listing.sellerId }, select: { wallet: true } }),
        ]);
        const buyerWallet = buyer?.wallet?.toLowerCase();
        const sellerWallet = seller?.wallet?.toLowerCase();
        if (!buyerWallet || !sellerWallet) {
          throw new AppError(ErrorCode.MARKETPLACE_PLAYER_NOT_FOUND, 404);
        }
        const cache = await tx.playerCache.findUnique({ where: { tokenId: listing.tokenId } });
        if (!cache || cache.ownerWallet.toLowerCase() !== sellerWallet) {
          throw new AppError(ErrorCode.MARKETPLACE_LISTING_NOT_FOUND, 404);
        }

        const split = splitFeeBps('gmt', listing.price.toString(), feeBps);
        const price = Number(split.gross);
        const fee = Number(split.fee);
        const sellerProceeds = Number(split.net);
        await applyMgtDebit(tx, buyerId, split.gross, MgtTxType.MARKETPLACE_BUY, {
          listingId,
          sellerId: listing.sellerId,
          destination: 'marketplace',
          fee,
          tokenId: listing.tokenId.toString(),
        });
        await applyMgtCredit(tx, listing.sellerId, split.net, MgtTxType.MARKETPLACE_SELL, {
          listingId,
          buyerId,
          origin: 'marketplace',
          fee,
          grossPrice: price,
          tokenId: listing.tokenId.toString(),
        });
        await tx.playerCache.update({
          where: { tokenId: listing.tokenId },
          data: { ownerWallet: buyerWallet },
        });
        await tx.listing.update({ where: { id: listingId }, data: { active: false } });
        return { price, fee, sellerId: listing.sellerId };
      }

      if (!listing.basePlayerId || !listing.basePlayer) {
        throw new AppError(ErrorCode.MARKETPLACE_LISTING_NOT_FOUND, 404);
      }
      if (listing.basePlayer.template && !listing.basePlayer.template.active) {
        throw new AppError(ErrorCode.MARKETPLACE_LISTING_NOT_FOUND, 404);
      }

      const split = splitFeeBps('gmt', listing.price.toString(), feeBps);
      const price = Number(split.gross);
      const fee = Number(split.fee);
      const sellerProceeds = Number(split.net);

      await applyMgtDebit(tx, buyerId, split.gross, MgtTxType.MARKETPLACE_BUY, {
        listingId,
        sellerId: listing.sellerId,
        destination: 'marketplace',
        fee,
      });
      await applyMgtCredit(tx, listing.sellerId, split.net, MgtTxType.MARKETPLACE_SELL, {
        listingId,
        buyerId,
        origin: 'marketplace',
        fee,
        grossPrice: price,
      });

      await tx.basePlayer.update({
        where: { id: listing.basePlayerId },
        data: {
          userId: buyerId,
          listed: false,
          costBasisUsdc: price,
          lifetimeEarnedUsdc: 0,
        },
      });

      const sellerAgg = await tx.basePlayer.aggregate({
        where: { userId: listing.sellerId },
        _sum: { overwall: true },
      });
      await tx.club.update({
        where: { userId: listing.sellerId },
        data: { totalOverwall: sellerAgg._sum.overwall ?? 0 },
      });

      const buyerAgg = await tx.basePlayer.aggregate({
        where: { userId: buyerId },
        _sum: { overwall: true },
      });
      await tx.club.update({
        where: { userId: buyerId },
        data: { totalOverwall: buyerAgg._sum.overwall ?? 0 },
      });

      await tx.listing.update({
        where: { id: listingId },
        data: { active: false },
      });

      return { price, fee, sellerId: listing.sellerId };
    });
  }

  async updatePrice(listingId: string, sellerId: string, newPrice: number) {
    const listing = await this.prisma.listing.findUnique({ where: { id: listingId } });
    if (!listing || !listing.active) {
      throw new AppError(ErrorCode.MARKETPLACE_LISTING_NOT_FOUND, 404);
    }
    if (listing.sellerId !== sellerId) {
      throw new AppError(ErrorCode.MARKETPLACE_NOT_OWNER, 403);
    }
    await this.prisma.listing.update({ where: { id: listingId }, data: { price: newPrice } });
    return { ok: true };
  }

  async cancelListing(listingId: string, sellerId: string) {
    return this.prisma.$transaction(async (tx) => {
      const listing = await tx.listing.findUnique({ where: { id: listingId } });
      if (!listing || !listing.active) {
        throw new AppError(ErrorCode.MARKETPLACE_LISTING_NOT_FOUND, 404);
      }
      if (listing.sellerId !== sellerId) {
        throw new AppError(ErrorCode.MARKETPLACE_NOT_OWNER, 403);
      }
      if (listing.basePlayerId) {
        await tx.basePlayer.update({
          where: { id: listing.basePlayerId },
          data: { listed: false },
        });
      }
      await tx.listing.update({
        where: { id: listingId },
        data: { active: false },
      });
    });
  }
}

function marketplaceErrorCode(err: unknown): string {
  if (err instanceof AppError && err.code) return err.code;
  if (err instanceof PrismaClientKnownRequestError && err.code === 'P2002') {
    return ErrorCode.MARKETPLACE_ALREADY_LISTED;
  }
  if (err && typeof err === 'object' && 'code' in err) {
    const code = (err as { code?: unknown }).code;
    if (typeof code === 'string' && code.length > 0) return code;
  }
  return ErrorCode.UNKNOWN;
}

function formatListing(listing: {
  id: string;
  tokenId: bigint | null;
  basePlayerId: string | null;
  price: { toString(): string };
  rarity: number;
  overwall: number;
  position: number;
  name?: string | null;
  imageUrl?: string | null;
  sellerId: string;
  seller?: { username: string | null; wallet: string | null } | null;
  nftAttributes?: unknown;
  basePlayer?: {
    position: number;
    name?: string | null;
    imageUrl?: string | null;
    attributes?: unknown;
    costBasisUsdc?: { toString(): string } | number;
    lifetimeEarnedUsdc?: { toString(): string } | number;
    template?: { name: string | null; imageUrl: string | null } | null;
  } | null;
}) {
  const sellerLabel =
    listing.seller?.username ||
    (listing.seller?.wallet
      ? `${listing.seller.wallet.slice(0, 6)}...${listing.seller.wallet.slice(-4)}`
      : listing.sellerId.slice(0, 8));

  const positionIdx = listing.basePlayer?.position ?? listing.position;
  const position = POSITION_NAMES[positionIdx] ?? 'FW';

  const costBasisUsdc = Number(listing.basePlayer?.costBasisUsdc ?? 0);
  const lifetimeEarnedUsdc = Number(listing.basePlayer?.lifetimeEarnedUsdc ?? 0);
  const career = playerAgeFromRoi(costBasisUsdc, lifetimeEarnedUsdc);
  const seed = listing.basePlayerId ?? listing.tokenId?.toString() ?? listing.id;
  const attributes = readPlayerAttributes(
    listing.basePlayer?.attributes ?? listing.nftAttributes,
    seed,
    listing.rarity,
    positionIdx,
  );

  return {
    id: listing.id,
    tokenId: listing.tokenId?.toString() ?? null,
    basePlayerId: listing.basePlayerId,
    asset: listing.tokenId != null && !listing.basePlayerId ? 'nft' as const : 'player' as const,
    status: 'selling' as const,
    rarity: RARITY_NAMES[listing.rarity] ?? 'common',
    overwall: listing.overwall,
    level: positionPower(attributes, positionIdx),
    position,
    price: Number(listing.price),
    seller: sellerLabel,
    name: listing.basePlayer?.name ?? listing.basePlayer?.template?.name ?? listing.name ?? (listing.tokenId != null ? `NFT #${listing.tokenId}` : null),
    imageUrl: listing.basePlayer?.imageUrl ?? listing.basePlayer?.template?.imageUrl ?? listing.imageUrl ?? null,
    costBasisUsdc: career.hasCareerCycle ? costBasisUsdc : undefined,
    lifetimeEarnedUsdc: career.hasCareerCycle ? lifetimeEarnedUsdc : undefined,
    age: career.hasCareerCycle ? career.age : undefined,
    roiPct: career.hasCareerCycle ? career.roiPct : undefined,
  };
}

export class MarketplaceService {
  private readonly platform: PlatformConfigService;
  constructor(
    private readonly repo: MarketplaceRepository,
    private readonly prisma: PrismaClient,
    private readonly passService?: PassService,
  ) {
    this.platform = new PlatformConfigService(prisma);
  }

  /**
   * Busca listagens ativas no marketplace com filtro opcional de raridade.
   *
   * @param query - Filtros (rarity, sortBy, limit)
   * @returns Lista de listagens formatadas
   */
  async getInfo() {
    const cfg = await this.platform.get();
    return { feeBps: cfg.marketplaceFeeBps ?? GAME_CONFIG.MARKETPLACE_FEE_BPS };
  }

  async search(query: ListingsQuery, viewerId?: string) {
    const rarityFilter = query.rarity !== undefined ? RARITY_TO_INT[query.rarity] : undefined;
    const listings = await this.repo.findActiveListings(query, rarityFilter);
    const visible = viewerId ? listings.filter((l) => l.sellerId !== viewerId) : listings;
    let rows: ListingDTO[] = await this.formatMany(visible);
    if (query.asset !== 'nft' && query.asset !== 'item') {
      rows = [...(await this.officialListings(query, rarityFilter)), ...rows];
      rows.sort((a, b) => (query.sortBy === 'price' ? a.price - b.price : b.overwall - a.overwall));
      rows = rows.slice(0, query.limit);
    }
    if (query.minLevel != null) rows = rows.filter((row) => row.level >= query.minLevel!);
    if (query.maxLevel != null) rows = rows.filter((row) => row.level <= query.maxLevel!);
    return { listings: rows };
  }

  private async officialListings(
    query: ListingsQuery,
    rarityFilter: number | undefined,
  ): Promise<ListingDTO[]> {
    const positionIdx = query.position ? POSITION_NAMES.indexOf(query.position) : -1;
    const supplies = await this.prisma.marketSupply.findMany({
      where: {
        remaining: { gt: 0 },
        template: {
          active: true,
          ...(rarityFilter !== undefined ? { rarity: rarityFilter } : {}),
          ...(positionIdx >= 0 ? { position: positionIdx } : {}),
        },
      },
      include: { template: true },
    });
    return supplies
      .filter((row) => {
        const price = Number(row.priceGmt);
        if (query.minPrice != null && price < query.minPrice) return false;
        if (query.maxPrice != null && price > query.maxPrice) return false;
        if (query.minOverwall != null && row.template.overwall < query.minOverwall) return false;
        if (query.maxOverwall != null && row.template.overwall > query.maxOverwall) return false;
        return true;
      })
      .map((row) => {
        const attributes = rollPlayerAttributes(row.id, row.template.rarity, row.template.position);
        return {
          id: row.id,
          tokenId: null,
          basePlayerId: null,
          asset: 'player' as const,
          status: 'selling' as const,
          rarity: RARITY_NAMES[row.template.rarity] ?? 'common',
          overwall: row.template.overwall,
          level: positionPower(attributes, row.template.position),
          position: POSITION_NAMES[row.template.position] ?? 'FW',
          price: Number(row.priceGmt),
          seller: OFFICIAL_MARKET_SELLER_NAME,
          name: row.template.name,
          imageUrl: row.template.imageUrl,
          stock: row.remaining,
        };
      });
  }

  async getMyListings(userId: string) {
    const listings = await this.repo.findMyActiveListings(userId);
    return { listings: await this.formatMany(listings) };
  }

  private async formatMany(listings: Array<{ tokenId: bigint | null } & Record<string, unknown>>) {
    const tokenIds = listings.flatMap((listing) => (listing.tokenId != null ? [listing.tokenId] : []));
    const caches = tokenIds.length
      ? await this.prisma.playerCache.findMany({
          where: { tokenId: { in: tokenIds } },
          select: { tokenId: true, attributes: true },
        })
      : [];
    const attributesByToken = new Map(caches.map((row) => [row.tokenId.toString(), row.attributes]));
    return listings.map((listing) =>
      formatListing({
        ...listing,
        nftAttributes: listing.tokenId != null ? attributesByToken.get(listing.tokenId.toString()) : undefined,
      } as Parameters<typeof formatListing>[0]),
    );
  }

  /**
   * Cria uma listagem para vender um jogador base no marketplace.
   *
   * @param userId - ID do vendedor
   * @param input - ID do jogador base e preço em MGT
   * @returns Listagem criada formatada
   * @throws {AppError} `MARKETPLACE_PLAYER_NOT_FOUND` se o jogador não pertencer ao usuário
   * @throws {AppError} `MARKETPLACE_ALREADY_LISTED` se o jogador já estiver listado
   */
  async listItem(userId: string, input: ListItemInput) {
    if (input.tokenId) return this.listNft(userId, input.tokenId, input.price);
    if (!input.basePlayerId) {
      throw new AppError(ErrorCode.MARKETPLACE_PLAYER_NOT_FOUND, 404);
    }
    const player = await this.repo.findBasePlayer(userId, input.basePlayerId);
    if (!player) {
      throw new AppError(ErrorCode.MARKETPLACE_PLAYER_NOT_FOUND, 404);
    }
    if (player.listed) {
      throw new AppError(ErrorCode.MARKETPLACE_ALREADY_LISTED, 400);
    }
    if (player.rarity === 0) {
      throw new AppError(ErrorCode.MARKETPLACE_COMMON_NOT_TRADEABLE, 400);
    }

    const listing = await this.repo.createListing(
      userId,
      {
        id: player.id,
        rarity: player.rarity,
        overwall: player.overwall,
        position: player.position,
        name: player.template?.name ?? player.name,
        imageUrl: player.imageUrl ?? player.template?.imageUrl,
      },
      input.price,
    );
    return formatListing({
      ...listing,
      seller: null,
      basePlayer: {
        position: player.position,
        name: player.name,
        imageUrl: player.imageUrl,
        attributes: player.attributes,
        template: player.template ?? null,
      },
    });
  }

  async listNft(userId: string, tokenId: string, price: number) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { wallet: true } });
    const wallet = user?.wallet?.toLowerCase();
    if (!wallet) throw new AppError(ErrorCode.MARKETPLACE_PLAYER_NOT_FOUND, 404);

    const cache = await this.prisma.playerCache.findFirst({
      where: { tokenId: BigInt(tokenId), ownerWallet: { equals: wallet, mode: 'insensitive' } },
    });
    if (!cache) throw new AppError(ErrorCode.MARKETPLACE_PLAYER_NOT_FOUND, 404);
    if (cache.rarity === 0) throw new AppError(ErrorCode.MARKETPLACE_COMMON_NOT_TRADEABLE, 400);

    const existing = await this.prisma.listing.findUnique({ where: { tokenId: cache.tokenId } });
    if (existing?.active) throw new AppError(ErrorCode.MARKETPLACE_ALREADY_LISTED, 400);

    const listing = existing
      ? await this.prisma.listing.update({
          where: { id: existing.id },
          data: {
            sellerId: userId,
            price: new Prisma.Decimal(price),
            rarity: cache.rarity,
            overwall: cache.overwall,
            position: cache.position,
            name: `NFT #${cache.tokenId.toString()}`,
            active: true,
            basePlayerId: null,
          },
        })
      : await this.prisma.listing.create({
          data: {
            tokenId: cache.tokenId,
            sellerId: userId,
            price: new Prisma.Decimal(price),
            rarity: cache.rarity,
            overwall: cache.overwall,
            position: cache.position,
            name: `NFT #${cache.tokenId.toString()}`,
            active: true,
          },
        });

    return formatListing({ ...listing, seller: null, nftAttributes: cache.attributes });
  }

  async listItemsBulk(userId: string, inputs: ListItemInput[]) {
    const results = [];
    for (const input of inputs) {
      try {
        results.push({ ok: true, listing: await this.listItem(userId, input) });
      } catch (err) {
        results.push({
          ok: false,
          basePlayerId: input.basePlayerId,
          error: marketplaceErrorCode(err),
        });
      }
    }
    return { results };
  }

  /**
   * Compra uma listagem: debita MGT do comprador, credita o vendedor menos a taxa
   * (`MARKETPLACE_FEE_BPS`), transfere a posse do jogador e adiciona XP no pass.
   *
   * @param buyerId - ID do comprador
   * @param listingId - ID da listagem
   * @returns Preço pago e taxa cobrada
   * @throws {AppError} `MARKETPLACE_LISTING_NOT_FOUND` se listagem não existir ou inativa
   * @throws {AppError} `MARKETPLACE_CANNOT_BUY_OWN` se comprador for o próprio vendedor
   * @throws {AppError} `INSUFFICIENT_USDC` se saldo MGT do comprador for insuficiente
   */
  async buyItem(buyerId: string, listingId: string) {
    const cfg = await this.platform.get();
    const feeBps = cfg.marketplaceFeeBps ?? GAME_CONFIG.MARKETPLACE_FEE_BPS;
    const official = await this.buyOfficialStock(buyerId, listingId, feeBps);
    if (official) {
      await this.passService?.addXp(buyerId, GAME_CONFIG.PASS_XP.marketBuy);
      return official;
    }
    const result = await this.repo.buyListing(listingId, buyerId, feeBps);
    await this.passService?.addXp(buyerId, GAME_CONFIG.PASS_XP.marketBuy);
    await this.passService?.addXp(result.sellerId, GAME_CONFIG.PASS_XP.marketSell);
    return { success: true, price: result.price, fee: result.fee };
  }

  /**
   * Compra uma cópia do estoque da liga. Devolve null quando o id não é estoque oficial.
   */
  private async buyOfficialStock(buyerId: string, listingId: string, feeBps: number) {
    const supply = await this.prisma.marketSupply.findUnique({
      where: { id: listingId },
      include: { template: true },
    });
    if (!supply) return null;
    if (buyerId === OFFICIAL_MARKET_SELLER_ID) {
      throw new AppError(ErrorCode.MARKETPLACE_CANNOT_BUY_OWN, 400);
    }
    if (!supply.template.active || supply.remaining < 1) {
      throw new AppError(ErrorCode.MARKETPLACE_LISTING_NOT_FOUND, 404);
    }

    await this.prisma.user.upsert({
      where: { id: OFFICIAL_MARKET_SELLER_ID },
      create: {
        id: OFFICIAL_MARKET_SELLER_ID,
        email: 'liga-oficial@masterlegends.internal',
        username: 'Liga',
        referralCode: 'LIGA0001',
        emailVerifiedAt: new Date(),
      },
      update: {},
    });

    const split = splitFeeBps('gmt', supply.priceGmt.toString(), feeBps);
    const price = Number(split.gross);
    const fee = Number(split.fee);

    await this.prisma.$transaction(async (tx) => {
      const taken = await tx.marketSupply.updateMany({
        where: { id: listingId, remaining: { gte: 1 } },
        data: { remaining: { decrement: 1 } },
      });
      if (taken.count !== 1) {
        throw new AppError(ErrorCode.MARKETPLACE_LISTING_NOT_FOUND, 404);
      }

      const playerId = randomUUID();
      const attributes = rollPlayerAttributes(playerId, supply.template.rarity, supply.template.position);
      await applyMgtDebit(tx, buyerId, split.gross, MgtTxType.MARKETPLACE_BUY, {
        listingId,
        sellerId: OFFICIAL_MARKET_SELLER_ID,
        destination: 'marketplace',
        fee,
        officialStock: true,
      });
      await applyMgtCredit(tx, OFFICIAL_MARKET_SELLER_ID, split.net, MgtTxType.MARKETPLACE_SELL, {
        listingId,
        buyerId,
        origin: 'marketplace',
        fee,
        grossPrice: price,
        officialStock: true,
      });
      await tx.basePlayer.create({
        data: {
          id: playerId,
          userId: buyerId,
          rarity: supply.template.rarity,
          overwall: supply.template.overwall,
          position: supply.template.position,
          attributes,
          name: supply.template.name,
          imageUrl: supply.template.imageUrl,
          templateId: supply.templateId,
          costBasisUsdc: price,
          lifetimeEarnedUsdc: 0,
          source: 'market',
        },
      });
      const agg = await tx.basePlayer.aggregate({
        where: { userId: buyerId },
        _sum: { overwall: true },
      });
      await tx.club.update({
        where: { userId: buyerId },
        data: { totalOverwall: agg._sum.overwall ?? 0 },
      });
    });

    return { success: true as const, price, fee };
  }

  /**
   * Cancela uma listagem ativa, devolvendo o jogador ao inventário do vendedor.
   *
   * @param userId - ID do vendedor (dono da listagem)
   * @param listingId - ID da listagem
   * @returns `{ success: true }`
   * @throws {AppError} `MARKETPLACE_LISTING_NOT_FOUND` se não existir ou inativa
   * @throws {AppError} `MARKETPLACE_NOT_OWNER` se o usuário não for o vendedor
   */
  async cancelItem(userId: string, listingId: string) {
    await this.repo.cancelListing(listingId, userId);
    return { success: true };
  }

  async updateItemPrice(userId: string, listingId: string, price: number) {
    return this.repo.updatePrice(listingId, userId, price);
  }
}

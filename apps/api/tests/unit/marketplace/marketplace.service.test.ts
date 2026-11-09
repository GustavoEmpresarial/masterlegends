import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AppError } from '../../../src/common/lib/errors.js';
import { MarketplaceRepository, MarketplaceService } from '../../../src/modules/marketplace/marketplace.service.js';

describe('MarketplaceService', () => {
  function makeRepo(overrides = {}) {
    return {
      findActiveListings: vi.fn().mockResolvedValue([]),
      findBasePlayer: vi.fn().mockResolvedValue(null),
      findListing: vi.fn().mockResolvedValue(null),
      createListing: vi.fn(),
      buyListing: vi.fn(),
      cancelListing: vi.fn(),
      ...overrides,
    } as unknown as MarketplaceRepository;
  }

  function makePrisma() {
    return {
      platformConfig: {
        upsert: vi.fn().mockResolvedValue({}),
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          marketplaceFeeBps: 1000,
          treasurerPerks: [],
          coachPerks: [],
          passRankConfig: null,
          updatedAt: new Date(),
        }),
      },
      playerCache: { findMany: vi.fn().mockResolvedValue([]) },
      marketSupply: {
        findMany: vi.fn().mockResolvedValue([]),
        findUnique: vi.fn().mockResolvedValue(null),
      },
    } as any;
  }

  it('search returns formatted listings', async () => {
    const repo = makeRepo({
      findActiveListings: vi.fn().mockResolvedValue([
        {
          id: 'lst-1',
          tokenId: null,
          basePlayerId: 'player-uuid',
          price: { toString: () => '100' },
          rarity: 1,
          overwall: 1500,
          position: 2,
          sellerId: 'user-1',
          seller: { username: 'seller', wallet: null },
          basePlayer: { position: 2 },
        },
      ]),
    });

    const service = new MarketplaceService(repo, makePrisma());
    const result = await service.search({ sortBy: 'price', limit: 10 });

    expect(result.listings).toHaveLength(1);
    expect(result.listings[0].basePlayerId).toBe('player-uuid');
    expect(result.listings[0].price).toBe(100);
    expect(result.listings[0].position).toBe('MID');
  });

  it('search shows masked wallet when seller has no username', async () => {
    const repo = makeRepo({
      findActiveListings: vi.fn().mockResolvedValue([
        {
          id: 'lst-2',
          tokenId: null,
          basePlayerId: 'player-2',
          price: { toString: () => '50' },
          rarity: 0,
          overwall: 400,
          position: 0,
          sellerId: 'user-x',
          seller: { username: null, wallet: '0xAbCdEf1234' },
          basePlayer: { position: 0 },
        },
      ]),
    });
    const service = new MarketplaceService(repo, makePrisma());
    const result = await service.search({ sortBy: 'overwall', limit: 5 });
    // Masked: first 6 chars + ... + last 4 chars
    expect(result.listings[0].seller).toContain('0xAbCd');
  });

  it('search uses tokenId to determine position for NFT listings', async () => {
    const repo = makeRepo({
      findActiveListings: vi.fn().mockResolvedValue([
        {
          id: 'lst-nft',
          tokenId: BigInt(1),  // index 1 = some position
          basePlayerId: null,
          price: { toString: () => '200' },
          rarity: 2,
          overwall: 12000,
          position: 0,
          sellerId: 'user-y',
          seller: { username: 'nftSeller', wallet: null },
          basePlayer: null,
        },
      ]),
    });
    const service = new MarketplaceService(repo, makePrisma());
    const result = await service.search({ sortBy: 'overwall', limit: 5 });
    expect(result.listings[0].tokenId).toBe('1');
    expect(result.listings[0].position).toBeTruthy();
  });

  it('listItem throws MARKETPLACE_PLAYER_NOT_FOUND when player does not belong to user', async () => {
    const repo = makeRepo({ findBasePlayer: vi.fn().mockResolvedValue(null) });
    const service = new MarketplaceService(repo, makePrisma());
    await expect(
      service.listItem('user-1', { basePlayerId: 'ghost', price: 100 }),
    ).rejects.toMatchObject({ code: 'MARKETPLACE_PLAYER_NOT_FOUND' });
  });

  it('listItem throws MARKETPLACE_ALREADY_LISTED when player already listed', async () => {
    const repo = makeRepo({
      findBasePlayer: vi.fn().mockResolvedValue({ id: 'p1', rarity: 0, overwall: 400, position: 0, listed: true }),
    });
    const service = new MarketplaceService(repo, makePrisma());
    await expect(
      service.listItem('user-1', { basePlayerId: 'p1', price: 100 }),
    ).rejects.toMatchObject({ code: 'MARKETPLACE_ALREADY_LISTED' });
  });

  it('listItem creates and returns formatted listing', async () => {
    const player = { id: 'p1', rarity: 1, overwall: 400, position: 0, listed: false };
    const listing = {
      id: 'lst-new',
      tokenId: null,
      basePlayerId: 'p1',
      price: { toString: () => '50' },
      rarity: 1,
      overwall: 400,
      position: 0,
      sellerId: 'user-1',
      seller: null,
      basePlayer: { position: 0 },
    };
    const repo = makeRepo({
      findBasePlayer: vi.fn().mockResolvedValue(player),
      createListing: vi.fn().mockResolvedValue(listing),
    });
    const service = new MarketplaceService(repo, makePrisma());
    const result = await service.listItem('user-1', { basePlayerId: 'p1', price: 50 });
    expect(result.id).toBe('lst-new');
    expect(result.price).toBe(50);
  });

  it('buyItem calls buyListing and adds XP to both parties', async () => {
    const passService = { addXp: vi.fn().mockResolvedValue(undefined) };
    const repo = makeRepo({
      buyListing: vi.fn().mockResolvedValue({ price: 100, fee: 2.5, sellerId: 'seller-1' }),
    });
    const service = new MarketplaceService(repo, makePrisma(), passService as any);
    const result = await service.buyItem('buyer-1', 'lst-1');
    expect(result.success).toBe(true);
    expect(result.price).toBe(100);
    expect(passService.addXp).toHaveBeenCalledTimes(2);
  });

  it('cancelItem returns success', async () => {
    const repo = makeRepo({ cancelListing: vi.fn().mockResolvedValue(undefined) });
    const service = new MarketplaceService(repo, makePrisma());
    const result = await service.cancelItem('user-1', 'lst-1');
    expect(result.success).toBe(true);
    expect(repo.cancelListing).toHaveBeenCalledWith('lst-1', 'user-1');
  });
});

describe('MarketplaceRepository', () => {
  function makeTx(overrides = {}) {
    return {
      listing: {
        create: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      basePlayer: {
        update: vi.fn(),
        findUnique: vi.fn().mockResolvedValue({ template: { active: true } }),
        aggregate: vi.fn().mockResolvedValue({ _sum: { overwall: 0 } }),
      },
      club: { update: vi.fn() },
      ...overrides,
    };
  }

  function makePrisma(overrides = {}) {
    const tx = makeTx();
    return {
      listing: {
        findMany: vi.fn().mockResolvedValue([]),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      basePlayer: {
        findFirst: vi.fn(),
        update: vi.fn(),
        aggregate: vi.fn().mockResolvedValue({ _sum: { overwall: 0 } }),
      },
      $transaction: vi.fn(async (fn: any) => fn(tx)),
      _tx: tx,
      ...overrides,
    } as any;
  }

  it('findActiveListings hides cards from an inactive template', async () => {
    const prisma = makePrisma();
    const repo = new MarketplaceRepository(prisma);
    await repo.findActiveListings({ sortBy: 'price', limit: 10 } as never, undefined);
    expect(prisma.listing.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          active: true,
          OR: expect.arrayContaining([{ basePlayer: { template: { active: true } } }]),
        }),
      }),
    );
  });

  it('cancelListing throws when listing not found', async () => {
    const prisma = makePrisma();
    prisma._tx.listing.findUnique.mockResolvedValue(null);
    const repo = new MarketplaceRepository(prisma);
    await expect(repo.cancelListing('ghost', 'user-1')).rejects.toMatchObject({
      code: 'MARKETPLACE_LISTING_NOT_FOUND',
    });
  });

  it('cancelListing throws when seller is not the owner', async () => {
    const prisma = makePrisma();
    prisma._tx.listing.findUnique.mockResolvedValue({ id: 'lst-1', active: true, sellerId: 'other', basePlayerId: null });
    const repo = new MarketplaceRepository(prisma);
    await expect(repo.cancelListing('lst-1', 'user-1')).rejects.toMatchObject({
      code: 'MARKETPLACE_NOT_OWNER',
    });
  });

  it('cancelListing marks listing inactive and unlists basePlayer', async () => {
    const prisma = makePrisma();
    prisma._tx.listing.findUnique.mockResolvedValue({
      id: 'lst-1',
      active: true,
      sellerId: 'user-1',
      basePlayerId: 'p1',
    });
    const repo = new MarketplaceRepository(prisma);
    await repo.cancelListing('lst-1', 'user-1');
    expect(prisma._tx.basePlayer.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { listed: false } }),
    );
    expect(prisma._tx.listing.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { active: false } }),
    );
  });

  it('createListing reactivates inactive listing instead of inserting duplicate', async () => {
    const prisma = makePrisma();
    prisma._tx.listing.findUnique.mockResolvedValue({
      id: 'lst-old',
      active: false,
      basePlayerId: 'p1',
    });
    prisma._tx.listing.update.mockResolvedValue({
      id: 'lst-old',
      tokenId: null,
      basePlayerId: 'p1',
      price: { toString: () => '99' },
      rarity: 1,
      overwall: 400,
      position: 0,
      sellerId: 'user-1',
    });
    const repo = new MarketplaceRepository(prisma);
    await repo.createListing(
      'user-1',
      { id: 'p1', rarity: 1, overwall: 400, position: 0, name: 'Striker', imageUrl: null },
      99,
    );
    expect(prisma._tx.listing.create).not.toHaveBeenCalled();
    expect(prisma._tx.listing.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'lst-old' },
        data: expect.objectContaining({ active: true, sellerId: 'user-1' }),
      }),
    );
    expect(prisma._tx.basePlayer.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'p1' }, data: { listed: true } }),
    );
  });

  it('createListing refuses a card whose template is inactive', async () => {
    const prisma = makePrisma();
    prisma._tx.basePlayer.findUnique.mockResolvedValue({ template: { active: false } });
    const repo = new MarketplaceRepository(prisma);
    await expect(
      repo.createListing(
        'user-1',
        { id: 'p1', rarity: 1, overwall: 400, position: 0, name: 'Striker', imageUrl: null },
        99,
      ),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(prisma._tx.listing.update).not.toHaveBeenCalled();
    expect(prisma._tx.listing.create).not.toHaveBeenCalled();
  });

  it('buyListing throws when listing not active', async () => {
    const prisma = makePrisma();
    prisma._tx.listing.findUnique.mockResolvedValue({ id: 'lst-1', active: false, basePlayerId: null });
    const repo = new MarketplaceRepository(prisma);
    await expect(repo.buyListing('lst-1', 'buyer', 250)).rejects.toBeInstanceOf(AppError);
  });

  it('buyListing throws MARKETPLACE_CANNOT_BUY_OWN when buyer is seller', async () => {
    const prisma = makePrisma();
    prisma._tx.listing.findUnique.mockResolvedValue({
      id: 'lst-1',
      active: true,
      sellerId: 'buyer',
      basePlayerId: 'p1',
      basePlayer: { id: 'p1', userId: 'buyer', listed: true, overwall: 100, position: 0, rarity: 0 },
      price: { valueOf: () => 100 },
    });
    const repo = new MarketplaceRepository(prisma);
    await expect(repo.buyListing('lst-1', 'buyer', 250)).rejects.toMatchObject({
      code: 'MARKETPLACE_CANNOT_BUY_OWN',
    });
  });
});

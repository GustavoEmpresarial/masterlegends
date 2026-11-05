import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ScoutService } from '../../../src/modules/scout/scout.service.js';
import type { ScoutRepository } from '../../../src/modules/scout/scout.repository.js';
import type { ClubService } from '../../../src/modules/club/club.service.js';
import type { ItemTemplateService } from '../../../src/modules/items/item-template.service.js';
import { SCOUT_COST_USDC, SCOUT_RARITY_WEIGHTS } from '@mll/shared';
import { AppError, ErrorCode } from '../../../src/common/lib/errors.js';

const baseTemplate = {
  id: 'tmpl-1',
  name: 'Cristiano X',
  imageUrl: '/uploads/items/x.png',
  rarity: 0,
  position: 3,
  overwall: 999,
  weight: 1,
  active: true,
  createdBy: 'admin',
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('ScoutService', () => {
  const clubService = {
    getClub: vi.fn(),
    getMgtBalance: vi.fn(),
  } as unknown as ClubService;

  const repo = {
    mintPlayers: vi.fn(),
  } as unknown as ScoutRepository;

  const itemTemplates = {
    pickForRarity: vi.fn(),
  } as unknown as ItemTemplateService;

  const sampleAttributes = {
    ataque: 3,
    defesa: 3,
    passe: 3,
    velocidade: 3,
    finalizacao: 3,
    forca: 3,
    resistencia: 3,
    tecnica: 3,
    inteligencia: 3,
    goleiro: 0,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(clubService.getClub).mockResolvedValue({ id: 'club-1' } as never);
    vi.mocked(clubService.getMgtBalance).mockResolvedValue(1000);
    vi.mocked(itemTemplates.pickForRarity).mockResolvedValue(baseTemplate as never);
    vi.mocked(repo.mintPlayers).mockImplementation(async (_userId, _totalCost, _unitCost, quantity, roll) => {
      const rows = [];
      for (let i = 0; i < quantity; i++) {
        const rolled = await roll();
        rows.push({
          id: `p${i + 1}`,
          overwall: rolled.overwall,
          position: rolled.position,
          rarity: rolled.rarity,
          name: rolled.name ?? null,
          imageUrl: rolled.imageUrl ?? null,
          attributes: sampleAttributes,
        });
      }
      return rows;
    });
  });

  function service() {
    return new ScoutService(repo, clubService, itemTemplates);
  }

  it('mint uses the official overwall band and template cosmetics', async () => {
    const result = await service().mint('user-1', { quantity: 1 });

    expect(result.players).toHaveLength(1);
    expect(result.players[0]).toMatchObject({
      name: 'Cristiano X',
      imageUrl: '/uploads/items/x.png',
    });
    expect(result.cost).toBe(SCOUT_COST_USDC);
    expect(itemTemplates.pickForRarity).toHaveBeenCalled();
    const bands: Record<string, [number, number]> = {
      common: [1, 10],
      uncommon: [11, 20],
      rare: [21, 40],
      'super-rare': [80, 160],
      epic: [320, 640],
      legendary: [1280, 2560],
    };
    const player = result.players[0]!;
    const [min, max] = bands[player.rarity]!;
    expect(player.overwall).toBeGreaterThanOrEqual(min);
    expect(player.overwall).toBeLessThanOrEqual(max);
    expect(['FW', 'LAT']).toContain(player.position);
    expect(player).toMatchObject({
      name: 'Cristiano X',
      imageUrl: '/uploads/items/x.png',
      attributes: sampleAttributes,
    });
    const roll = (repo.mintPlayers as ReturnType<typeof vi.fn>).mock.calls[0][4] as () => Promise<{
      name: string;
      imageUrl: string;
      templateId: string;
    }>;
    const rolled = await roll();
    expect(rolled).toMatchObject({
      name: 'Cristiano X',
      imageUrl: '/uploads/items/x.png',
      templateId: 'tmpl-1',
    });
  });

  it('mint throws when balance is insufficient', async () => {
    vi.mocked(clubService.getMgtBalance).mockResolvedValue(0);
    await expect(service().mint('user-1', { quantity: 1 })).rejects.toBeInstanceOf(AppError);
    expect(repo.mintPlayers).not.toHaveBeenCalled();
  });

  it('throws SCOUT_POOL_EMPTY when pickForRarity returns null', async () => {
    vi.mocked(itemTemplates.pickForRarity).mockResolvedValue(null);
    await expect(service().mint('user-1', { quantity: 1 })).rejects.toMatchObject({
      code: ErrorCode.SCOUT_POOL_EMPTY,
    });
  });

  it('mint multiple players debits total cost', async () => {
    vi.mocked(clubService.getMgtBalance).mockResolvedValue(10_000);

    const result = await service().mint('user-1', { quantity: 3 });

    expect(result.players).toHaveLength(3);
    expect(itemTemplates.pickForRarity).toHaveBeenCalledTimes(3);
    const [, totalCost, unitCost, quantity] = (repo.mintPlayers as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(totalCost).toBe(SCOUT_COST_USDC * 3);
    expect(unitCost).toBe(SCOUT_COST_USDC);
    expect(quantity).toBe(3);
    expect(result.cost).toBe(SCOUT_COST_USDC * 3);
  });

  it('adds XP to pass when passService provided', async () => {
    const passService = { addXp: vi.fn().mockResolvedValue(undefined) };
    const svc = new ScoutService(repo, clubService, itemTemplates, passService as never);
    await svc.mint('user-1', { quantity: 1 });
    expect(passService.addXp).toHaveBeenCalledWith('user-1', expect.any(Number));
  });

  it('throws when club not found (clubService throws)', async () => {
    vi.mocked(clubService.getClub).mockRejectedValue(new AppError(ErrorCode.CLUB_NOT_FOUND, 404));
    await expect(service().mint('user-1', { quantity: 1 })).rejects.toMatchObject({
      code: 'CLUB_NOT_FOUND',
    });
    expect(repo.mintPlayers).not.toHaveBeenCalled();
  });

  it('getRules returns fixed server-side drop rates', async () => {
    const rules = await service().getRules();
    expect(rules.costUsdc).toBe(SCOUT_COST_USDC);
    expect(rules.effectiveCostUsdc).toBe(SCOUT_COST_USDC);
    expect(rules.discountPct).toBe(0);
    const legendary = rules.rarities.find((r) => r.id === 'legendary');
    const weightTotal = Object.values(SCOUT_RARITY_WEIGHTS).reduce((sum, weight) => sum + weight, 0);
    expect(legendary?.chancePct).toBeCloseTo((SCOUT_RARITY_WEIGHTS.legendary / weightTotal) * 100, 5);
    expect(legendary?.overwallMin).toBe(1280);
    expect(legendary?.overwallMax).toBe(2560);
  });
});

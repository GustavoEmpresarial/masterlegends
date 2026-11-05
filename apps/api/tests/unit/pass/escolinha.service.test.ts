import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EscolinhaService } from '../../../src/modules/pass/escolinha.service.js';

vi.mock('../../../src/modules/pass/pass-season.service.js', () => ({
  findConfiguredPassSeason: vi.fn(),
  passLevelFromConfiguredXp: vi.fn(),
}));

const { findConfiguredPassSeason, passLevelFromConfiguredXp } = await import(
  '../../../src/modules/pass/pass-season.service.js'
);

const DEFAULT_RANKS = [
  { rank: 'bronze', minLevel: 1, maxLevel: 10, bonusPct: 0 },
  { rank: 'prata', minLevel: 11, maxLevel: 25, bonusPct: 0.05 },
  { rank: 'ouro', minLevel: 26, maxLevel: 50, bonusPct: 0.1 },
  { rank: 'diamante', minLevel: 51, maxLevel: 80, bonusPct: 0.15 },
  { rank: 'lendario', minLevel: 81, maxLevel: 100, bonusPct: 0.2 },
];

function mkPrisma() {
  return {
    user: { findUnique: vi.fn(), findFirst: vi.fn() },
    passProgress: { findUnique: vi.fn() },
    platformConfig: { findUnique: vi.fn().mockResolvedValue({ passRankConfig: DEFAULT_RANKS }) },
  } as any;
}

describe('EscolinhaService.propagateXpToOwner', () => {
  beforeEach(() => vi.clearAllMocks());

  it('no-op when F2P has no referrer', async () => {
    const prisma = mkPrisma();
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', referredBy: null });
    const grant = vi.fn();
    await new EscolinhaService(prisma, grant).propagateXpToOwner('u1', 100);
    expect(grant).not.toHaveBeenCalled();
  });

  it('no-op when F2P is actually premium', async () => {
    const prisma = mkPrisma();
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', referredBy: 'ABCD1234' });
    prisma.user.findFirst.mockResolvedValue({ id: 'owner' });
    vi.mocked(findConfiguredPassSeason).mockResolvedValue({
      id: 1,
      levels: [{ level: 1, xpRequired: 0, rewardType: 'usdc', rewardLabel: '' }],
    } as never);
    prisma.passProgress.findUnique.mockResolvedValue({ xp: 0, premium: true });
    const grant = vi.fn();
    await new EscolinhaService(prisma, grant).propagateXpToOwner('u1', 100);
    expect(grant).not.toHaveBeenCalled();
  });

  it('propagates with bronze bonus (0%) when F2P level 1', async () => {
    const prisma = mkPrisma();
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', referredBy: 'ABCD1234' });
    prisma.user.findFirst.mockResolvedValue({ id: 'owner' });
    vi.mocked(findConfiguredPassSeason).mockResolvedValue({
      id: 1,
      levels: [{ level: 1, xpRequired: 0, rewardType: 'usdc', rewardLabel: '' }],
    } as never);
    vi.mocked(passLevelFromConfiguredXp).mockReturnValue(1);
    prisma.passProgress.findUnique.mockResolvedValue({ xp: 0, premium: false });
    const grant = vi.fn();
    await new EscolinhaService(prisma, grant).propagateXpToOwner('u1', 100);
    expect(grant).toHaveBeenCalledWith('owner', 100);
  });

  it('propagates with lendario bonus (20%) when F2P level 90', async () => {
    const prisma = mkPrisma();
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', referredBy: 'ABCD1234' });
    prisma.user.findFirst.mockResolvedValue({ id: 'owner' });
    vi.mocked(findConfiguredPassSeason).mockResolvedValue({
      id: 1,
      levels: [],
    } as never);
    vi.mocked(passLevelFromConfiguredXp).mockReturnValue(90);
    prisma.passProgress.findUnique.mockResolvedValue({ xp: 50000, premium: false });
    const grant = vi.fn();
    await new EscolinhaService(prisma, grant).propagateXpToOwner('u1', 100);
    expect(grant).toHaveBeenCalledWith('owner', 120);
  });

  it('swallows errors silently', async () => {
    const prisma = mkPrisma();
    prisma.user.findUnique.mockRejectedValue(new Error('db'));
    const grant = vi.fn();
    await expect(
      new EscolinhaService(prisma, grant).propagateXpToOwner('u1', 100),
    ).resolves.toBeUndefined();
  });
});

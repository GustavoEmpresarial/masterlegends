import { describe, it, expect, vi } from 'vitest';
import { AfflictionService } from '../../../src/modules/afflictions/affliction.service.js';
import { ErrorCode } from '../../../src/common/lib/errors.js';

function mockPrisma(overrides: Record<string, unknown> = {}) {
  return {
    affliction: {
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => ({ id: 'a1', ...data })),
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
      delete: vi.fn().mockResolvedValue({ id: 'a1', code: 'dor_de_barriga' }),
      ...(overrides.affliction as object | undefined),
    },
  } as any;
}

describe('AfflictionService', () => {
  it('applies coach affliction with computed expiresAt', async () => {
    const prisma = mockPrisma();
    const svc = new AfflictionService(prisma);
    const before = Date.now();
    const row = await svc.apply({
      userId: 'u1',
      targetKind: 'coach',
      targetId: null,
      code: 'dor_de_barriga',
      durationMinutes: 120,
      createdBy: 'admin',
    });
    expect(prisma.affliction.create).toHaveBeenCalledOnce();
    const arg = prisma.affliction.create.mock.calls[0][0];
    expect(arg.data.userId).toBe('u1');
    expect(arg.data.targetKind).toBe('coach');
    expect(arg.data.code).toBe('dor_de_barriga');
    expect(arg.data.createdBy).toBe('admin');
    const expiresAt = arg.data.expiresAt as Date;
    expect(expiresAt.getTime() - before).toBeGreaterThanOrEqual(120 * 60_000 - 50);
    expect(expiresAt.getTime() - before).toBeLessThanOrEqual(120 * 60_000 + 50);
    expect(row.id).toBe('a1');
  });

  it('rejects invalid duration', async () => {
    const svc = new AfflictionService(mockPrisma());
    await expect(
      svc.apply({ userId: 'u1', targetKind: 'coach', targetId: null, code: 'x', durationMinutes: 0 }),
    ).rejects.toMatchObject({ code: ErrorCode.VALIDATION_ERROR });
    await expect(
      svc.apply({ userId: 'u1', targetKind: 'coach', targetId: null, code: 'x', durationMinutes: 60 * 24 * 31 }),
    ).rejects.toMatchObject({ code: ErrorCode.VALIDATION_ERROR });
  });

  it('requires targetId for player afflictions', async () => {
    const svc = new AfflictionService(mockPrisma());
    await expect(
      svc.apply({ userId: 'u1', targetKind: 'base_player', targetId: null, code: 'cansaco', durationMinutes: 60 }),
    ).rejects.toMatchObject({ code: ErrorCode.VALIDATION_ERROR });
  });

  it('isCoachAfflicted returns true when active row exists', async () => {
    const prisma = mockPrisma({
      affliction: {
        findFirst: vi.fn().mockResolvedValue({ id: 'a1' }),
      },
    });
    const svc = new AfflictionService(prisma);
    await expect(svc.isCoachAfflicted('u1')).resolves.toBe(true);
    const where = prisma.affliction.findFirst.mock.calls[0][0].where;
    expect(where.targetKind).toBe('coach');
    expect(where.expiresAt.gt).toBeInstanceOf(Date);
  });

  it('isCoachAfflicted returns false when no row', async () => {
    const svc = new AfflictionService(mockPrisma());
    await expect(svc.isCoachAfflicted('u1')).resolves.toBe(false);
  });

  it('getActiveSummary aggregates coach/treasurer/player rows', async () => {
    const prisma = mockPrisma({
      affliction: {
        findMany: vi.fn().mockResolvedValue([
          { targetKind: 'coach', targetId: null, code: 'gripe' },
          { targetKind: 'treasurer', targetId: null, code: 'gripe' },
          { targetKind: 'base_player', targetId: 'p1', code: 'cansaco' },
          { targetKind: 'nft_player', targetId: '99', code: 'lesao_leve' },
        ]),
      },
    });
    const svc = new AfflictionService(prisma);
    const s = await svc.getActiveSummary('u1');
    expect(s.coach).toBe(true);
    expect(s.treasurer).toBe(true);
    expect(s.players.get('p1')).toBe('cansaco');
    expect(s.players.get('99')).toBe('lesao_leve');
  });

  it('remove proxies to prisma.delete', async () => {
    const prisma = mockPrisma();
    await new AfflictionService(prisma).remove('a1');
    expect(prisma.affliction.delete).toHaveBeenCalledWith({ where: { id: 'a1' } });
  });
});

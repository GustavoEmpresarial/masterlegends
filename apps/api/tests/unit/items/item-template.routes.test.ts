import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { itemTemplatePatchSchema } from '@mll/shared';

describe('itemTemplatePatchSchema', () => {
  it('accepts legendary seed payload from admin form', () => {
    const parsed = itemTemplatePatchSchema.parse({
      name: '[seed-v1] Lendário #03',
      rarity: 4,
      position: 2,
      overwall: 151759,
      weight: 1,
      active: true,
    });
    expect(parsed.overwall).toBe(151759);
  });
});

describe('item template PATCH content-type guard', () => {
  function isValidMultipart(contentType: string, isMultipartFn: () => boolean): boolean {
    if (!contentType.includes('multipart/form-data')) return false;
    if (!contentType.includes('boundary=')) return false;
    return isMultipartFn();
  }

  it('rejects multipart without boundary (broken axios header)', () => {
    expect(
      isValidMultipart('multipart/form-data', () => true),
    ).toBe(false);
  });

  it('accepts multipart with boundary', () => {
    expect(
      isValidMultipart('multipart/form-data; boundary=----abc', () => true),
    ).toBe(true);
  });
});

describe('ItemTemplateService.update club sync', () => {
  beforeEach(() => vi.clearAllMocks());

  it('uses updateMany for club totalOverwall', async () => {
    const itemTemplate = {
      findUnique: vi.fn().mockResolvedValue({
        id: 't1',
        imageUrl: '/uploads/items/a.png',
      }),
      update: vi.fn().mockResolvedValue({
        id: 't1',
        name: 'X',
        imageUrl: '/uploads/items/a.png',
        rarity: 4,
        position: 2,
        overwall: 151759,
        weight: 1,
        active: true,
        createdBy: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    };
    const basePlayer = {
      updateMany: vi.fn(),
      findMany: vi.fn().mockResolvedValue([{ userId: 'u1' }]),
      aggregate: vi.fn().mockResolvedValue({ _sum: { overwall: 151759 } }),
    };
    const club = { updateMany: vi.fn() };
    const tx = { itemTemplate, basePlayer, club };
    const prisma = {
      itemTemplate: { findUnique: itemTemplate.findUnique },
      $transaction: vi.fn(async (fn: (c: typeof tx) => Promise<unknown>) => fn(tx)),
    };

    vi.mock('../../../src/common/lib/uploads.js', () => ({
      deleteItemImage: vi.fn(),
    }));

    const { ItemTemplateService } = await import('../../../src/modules/items/item-template.service.js');
    const svc = new ItemTemplateService(prisma as any);
    await svc.update('t1', { overwall: 151759 });
    expect(club.updateMany).toHaveBeenCalledWith({
      where: { userId: 'u1' },
      data: { totalOverwall: 151759 },
    });
  });
});

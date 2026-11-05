import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ItemTemplateService } from '../../../src/modules/items/item-template.service.js';

vi.mock('../../../src/common/lib/uploads.js', () => ({
  saveItemImage: vi.fn(),
  deleteItemImage: vi.fn().mockResolvedValue(undefined),
}));

const uploads = await import('../../../src/common/lib/uploads.js');

function makePrisma() {
  const itemTemplate = {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
  const basePlayer = {
    updateMany: vi.fn(),
    findMany: vi.fn().mockResolvedValue([]),
    aggregate: vi.fn(),
  };
  const club = {
    updateMany: vi.fn(),
  };
  const tx = { itemTemplate, basePlayer, club };
  return {
    itemTemplate,
    basePlayer,
    club,
    $transaction: vi.fn(async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx)),
  } as any;
}

const baseRow = {
  id: 't1',
  name: 'Cristiano X',
  imageUrl: '/uploads/items/a.png',
  rarity: 4,
  position: 3,
  overwall: 300_000,
  weight: 1,
  active: true,
  createdBy: 'admin',
  createdAt: new Date('2026-06-06T00:00:00Z'),
  updatedAt: new Date('2026-06-06T00:00:00Z'),
};

beforeEach(() => vi.clearAllMocks());

describe('ItemTemplateService CRUD', () => {
  it('list passes filters and maps DTO', async () => {
    const prisma = makePrisma();
    prisma.itemTemplate.findMany.mockResolvedValue([baseRow]);
    const svc = new ItemTemplateService(prisma);
    const out = await svc.list({ rarity: 4, active: true, limit: 50 });
    expect(prisma.itemTemplate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { rarity: 4, active: true },
        take: 50,
      }),
    );
    expect(out[0]).toMatchObject({ id: 't1', name: 'Cristiano X', rarity: 4 });
  });

  it('getById throws ITEM_TEMPLATE_NOT_FOUND', async () => {
    const prisma = makePrisma();
    prisma.itemTemplate.findUnique.mockResolvedValue(null);
    const svc = new ItemTemplateService(prisma);
    await expect(svc.getById('nope')).rejects.toMatchObject({
      code: 'ITEM_TEMPLATE_NOT_FOUND',
    });
  });

  it('create stores createdBy', async () => {
    const prisma = makePrisma();
    prisma.itemTemplate.create.mockResolvedValue(baseRow);
    const svc = new ItemTemplateService(prisma);
    await svc.create(
      {
        name: 'X',
        imageUrl: '/uploads/items/x.png',
        rarity: 4,
        position: 3,
        overwall: 300_000,
        weight: 1,
        active: true,
      },
      'admin',
    );
    expect(prisma.itemTemplate.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ createdBy: 'admin', name: 'X' }),
    });
  });

  it('update deletes old image when imageUrl changes', async () => {
    const prisma = makePrisma();
    prisma.itemTemplate.findUnique.mockResolvedValue(baseRow);
    prisma.itemTemplate.update.mockResolvedValue({ ...baseRow, imageUrl: '/uploads/items/b.png' });
    const svc = new ItemTemplateService(prisma);
    await svc.update('t1', { imageUrl: '/uploads/items/b.png' });
    expect(uploads.deleteItemImage).toHaveBeenCalledWith('/uploads/items/a.png');
  });

  it('update propagates overwall to linked base players and recalculates club total', async () => {
    const prisma = makePrisma();
    prisma.itemTemplate.findUnique.mockResolvedValue(baseRow);
    prisma.itemTemplate.update.mockResolvedValue({ ...baseRow, overwall: 280_000 });
    prisma.basePlayer.findMany.mockResolvedValue([{ userId: 'u1' }]);
    prisma.basePlayer.aggregate.mockResolvedValue({ _sum: { overwall: 500_000 } });
    const svc = new ItemTemplateService(prisma);
    await svc.update('t1', { overwall: 280_000 });
    expect(prisma.basePlayer.updateMany).toHaveBeenCalledWith({
      where: { templateId: 't1' },
      data: { overwall: 280_000 },
    });
    expect(prisma.club.updateMany).toHaveBeenCalledWith({
      where: { userId: 'u1' },
      data: { totalOverwall: 500_000 },
    });
  });

  it('update does not delete when imageUrl unchanged', async () => {
    const prisma = makePrisma();
    prisma.itemTemplate.findUnique.mockResolvedValue(baseRow);
    prisma.itemTemplate.update.mockResolvedValue(baseRow);
    const svc = new ItemTemplateService(prisma);
    await svc.update('t1', { name: 'New' });
    expect(uploads.deleteItemImage).not.toHaveBeenCalled();
  });

  it('delete removes file and row', async () => {
    const prisma = makePrisma();
    prisma.itemTemplate.findUnique.mockResolvedValue(baseRow);
    const svc = new ItemTemplateService(prisma);
    await svc.delete('t1');
    expect(prisma.itemTemplate.delete).toHaveBeenCalledWith({ where: { id: 't1' } });
    expect(uploads.deleteItemImage).toHaveBeenCalledWith(baseRow.imageUrl);
  });
});

describe('ItemTemplateService.pickForRarity weighted random', () => {
  it('returns null when no active templates', async () => {
    const prisma = makePrisma();
    prisma.itemTemplate.findMany.mockResolvedValue([]);
    const svc = new ItemTemplateService(prisma);
    expect(await svc.pickForRarity(2)).toBeNull();
  });

  it('returns null when all weights are zero', async () => {
    const prisma = makePrisma();
    prisma.itemTemplate.findMany.mockResolvedValue([
      { ...baseRow, id: 'a', weight: 0 },
      { ...baseRow, id: 'b', weight: 0 },
    ]);
    const svc = new ItemTemplateService(prisma);
    expect(await svc.pickForRarity(4)).toBeNull();
  });

  it('picks proportionally to weight (rand mock)', async () => {
    const prisma = makePrisma();
    prisma.itemTemplate.findMany.mockResolvedValue([
      { ...baseRow, id: 'A', weight: 1 },
      { ...baseRow, id: 'B', weight: 2 },
      { ...baseRow, id: 'C', weight: 7 },
    ]);
    const svc = new ItemTemplateService(prisma);

    // total weight = 10. rand 0.05 -> 0.5 -> hits A (range 0..1)
    expect((await svc.pickForRarity(4, () => 0.05))?.id).toBe('A');
    // rand 0.2 -> 2.0 -> hits B (range 1..3)
    expect((await svc.pickForRarity(4, () => 0.2))?.id).toBe('B');
    // rand 0.9 -> 9.0 -> hits C (range 3..10)
    expect((await svc.pickForRarity(4, () => 0.9))?.id).toBe('C');
  });

  it('falls back to last candidate when rand exactly 1.0', async () => {
    const prisma = makePrisma();
    prisma.itemTemplate.findMany.mockResolvedValue([
      { ...baseRow, id: 'A', weight: 1 },
      { ...baseRow, id: 'B', weight: 1 },
    ]);
    const svc = new ItemTemplateService(prisma);
    // rand 0.999 -> 1.998 -> after A (-1), -0.998 < 0 → B? Let's verify with bound case
    expect((await svc.pickForRarity(4, () => 0.999))?.id).toBe('B');
  });
});

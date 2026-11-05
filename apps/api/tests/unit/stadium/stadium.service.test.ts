import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StadiumService } from '../../../src/modules/stadium/stadium.service.js';
import { StadiumRepository } from '../../../src/modules/stadium/stadium.repository.js';

vi.mock('../../../src/common/lib/uploads.js', () => ({
  deleteStadiumImage: vi.fn().mockResolvedValue(undefined),
}));

const baseRow = {
  id: 'st1',
  name: 'Neon Stadium',
  imageUrl: '/uploads/stadiums/default.png',
  slots: [{ id: 's1', label: 'GOL', xPct: 50, yPct: 82, role: 'GK' }],
  priceUsdc: null,
  active: true,
  isDefault: true,
  sortOrder: 0,
  createdAt: new Date('2026-06-08T00:00:00Z'),
  updatedAt: new Date('2026-06-08T00:00:00Z'),
};

function makeRepo() {
  return {
    list: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    clearDefaultExcept: vi.fn(),
    clearAllDefaults: vi.fn(),
  } as unknown as StadiumRepository;
}

beforeEach(() => vi.clearAllMocks());

describe('StadiumService', () => {
  it('list maps DTOs', async () => {
    const repo = makeRepo();
    vi.mocked(repo.list).mockResolvedValue([baseRow as any]);
    const svc = new StadiumService(repo);
    const out = await svc.list();
    expect(out[0]).toMatchObject({ id: 'st1', name: 'Neon Stadium', slots: expect.any(Array) });
  });

  it('getById throws STADIUM_TEMPLATE_NOT_FOUND', async () => {
    const repo = makeRepo();
    vi.mocked(repo.findById).mockResolvedValue(null);
    const svc = new StadiumService(repo);
    await expect(svc.getById('nope')).rejects.toMatchObject({
      code: 'STADIUM_TEMPLATE_NOT_FOUND',
    });
  });

  it('create clears defaults when isDefault', async () => {
    const repo = makeRepo();
    vi.mocked(repo.create).mockResolvedValue(baseRow as any);
    const svc = new StadiumService(repo);
    await svc.create({
      name: 'X',
      imageUrl: '/uploads/stadiums/x.png',
      slots: [],
      isDefault: true,
    });
    expect(repo.clearAllDefaults).toHaveBeenCalled();
  });

  it('update clears other defaults when setting isDefault', async () => {
    const repo = makeRepo();
    vi.mocked(repo.findById).mockResolvedValue({ ...baseRow, isDefault: false } as any);
    vi.mocked(repo.update).mockResolvedValue({ ...baseRow, isDefault: true } as any);
    const svc = new StadiumService(repo);
    await svc.update('st1', { isDefault: true });
    expect(repo.clearDefaultExcept).toHaveBeenCalledWith('st1');
  });

  it('delete blocks default template', async () => {
    const repo = makeRepo();
    vi.mocked(repo.findById).mockResolvedValue(baseRow as any);
    const svc = new StadiumService(repo);
    await expect(svc.delete('st1')).rejects.toMatchObject({
      code: 'STADIUM_DEFAULT_DELETE_FORBIDDEN',
    });
  });

  it('delete removes non-default template', async () => {
    const repo = makeRepo();
    vi.mocked(repo.findById).mockResolvedValue({ ...baseRow, isDefault: false } as any);
    const svc = new StadiumService(repo);
    await svc.delete('st2');
    expect(repo.delete).toHaveBeenCalledWith('st2');
  });
});

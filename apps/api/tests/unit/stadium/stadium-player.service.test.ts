import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StadiumPlayerService } from '../../../src/modules/stadium/stadium-player.service.js';

const templateRow = {
  id: 'tpl-1',
  name: 'Neon',
  imageUrl: '/uploads/stadiums/default.png',
  slots: [
    { id: 's1', label: 'GOL', xPct: 50, yPct: 80, role: 'GK' },
    { id: 's2', label: 'ATA', xPct: 50, yPct: 30, role: 'FW' },
  ],
  priceUsdc: null,
  active: true,
  isDefault: true,
  sortOrder: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function makeStadiumRepo() {
  return {
    findDefaultTemplate: vi.fn(),
    findById: vi.fn(),
    findLineupByClubId: vi.fn(),
    upsertLineup: vi.fn(),
  } as any;
}

function makeClubRepo() {
  return {
    findByUserId: vi.fn(),
    getInventory: vi.fn(),
  } as any;
}

function makeVestiarioTemplateRepo() {
  return {
    getDefault: vi.fn().mockResolvedValue({
      id: 'default',
      imageUrl: '/uploads/vestiario/field.png',
      slots: templateRow.slots,
      updatedAt: new Date().toISOString(),
    }),
  } as any;
}

/** Mock prisma so loadActiveStakeKeys resolves stake status for lineup tests. */
function makePrisma(
  stakes: Array<{ kind: string; playerId: string }> = [],
  trials: Array<{ kind: string; playerId: string; windowStartedAt: Date }> = [],
) {
  return {
    playerStake: {
      findMany: vi.fn().mockResolvedValue(stakes),
    },
    playerFieldTrial: {
      findMany: vi.fn().mockResolvedValue(trials),
      upsert: vi.fn().mockResolvedValue({}),
    },
    clubStadiumLicense: {
      findUnique: vi.fn().mockResolvedValue({ id: 'lic-1', status: 'signed' }),
    },
    basePlayer: {
      findMany: vi.fn().mockResolvedValue([]),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    platformConfig: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
  } as any;
}

beforeEach(() => vi.clearAllMocks());

describe('StadiumPlayerService', () => {
  it('getView returns template and empty slots when no lineup', async () => {
    const stadiumRepo = makeStadiumRepo();
    const clubRepo = makeClubRepo();
    stadiumRepo.findLineupByClubId.mockResolvedValue(null);
    stadiumRepo.findDefaultTemplate.mockResolvedValue(templateRow);
    clubRepo.findByUserId.mockResolvedValue({
      id: 'club-1',
      stadiumLvl: 2,
      user: { wallet: '0xabc' },
    });
    clubRepo.getInventory.mockResolvedValue({
      basePlayers: [
        { id: 'bp1', rarity: 0, overwall: 500, position: 0, name: 'A', imageUrl: null },
      ],
      nfts: [],
    });

    const svc = new StadiumPlayerService(stadiumRepo, clubRepo, makeVestiarioTemplateRepo());
    const view = await svc.getView('user-1');
    expect(view.template.name).toBe('Neon');
    expect(view.stadiumLvl).toBe(2);
    expect(view.slots).toHaveLength(2);
    expect(view.slots[0].player).toBeNull();
  });

  it('saveLineup rejects unknown player', async () => {
    const stadiumRepo = makeStadiumRepo();
    const clubRepo = makeClubRepo();
    stadiumRepo.findLineupByClubId.mockResolvedValue(null);
    stadiumRepo.findDefaultTemplate.mockResolvedValue(templateRow);
    clubRepo.findByUserId.mockResolvedValue({
      id: 'club-1',
      stadiumLvl: 1,
      user: { wallet: null },
    });
    clubRepo.getInventory.mockResolvedValue({ basePlayers: [], nfts: [] });

    const svc = new StadiumPlayerService(stadiumRepo, clubRepo, makeVestiarioTemplateRepo());
    await expect(
      svc.saveLineup('user-1', { s1: { playerId: 'nope', kind: 'base' } }),
    ).rejects.toMatchObject({ code: 'LINEUP_INVALID' });
  });

  it('saveLineup starts a 5-minute window for an unstaked player', async () => {
    const stadiumRepo = makeStadiumRepo();
    const clubRepo = makeClubRepo();
    stadiumRepo.findLineupByClubId.mockResolvedValue(null);
    stadiumRepo.findDefaultTemplate.mockResolvedValue(templateRow);
    clubRepo.findByUserId.mockResolvedValue({
      id: 'club-1',
      stadiumLvl: 1,
      user: { wallet: null },
    });
    clubRepo.getInventory.mockResolvedValue({
      basePlayers: [
        { id: 'bp1', rarity: 0, overwall: 500, position: 0, name: 'A', imageUrl: null },
      ],
      nfts: [],
    });

    const prisma = makePrisma([]);
    stadiumRepo.upsertLineup.mockResolvedValue({});
    const svc = new StadiumPlayerService(
      stadiumRepo,
      clubRepo,
      makeVestiarioTemplateRepo(),
      prisma,
    );
    const result = await svc.saveLineup('user-1', { s1: { playerId: 'bp1', kind: 'base' } });
    expect(prisma.playerFieldTrial.upsert).toHaveBeenCalled();
    expect(result.slots[0].player?.freeField?.state).toBe('playing');
    expect(stadiumRepo.upsertLineup).toHaveBeenCalled();
  });

  it('saveLineup rejects an unstaked player after the 5 minutes', async () => {
    const stadiumRepo = makeStadiumRepo();
    const clubRepo = makeClubRepo();
    stadiumRepo.findLineupByClubId.mockResolvedValue(null);
    stadiumRepo.findDefaultTemplate.mockResolvedValue(templateRow);
    clubRepo.findByUserId.mockResolvedValue({
      id: 'club-1',
      stadiumLvl: 1,
      user: { wallet: null },
    });
    clubRepo.getInventory.mockResolvedValue({
      basePlayers: [
        { id: 'bp1', rarity: 0, overwall: 500, position: 0, name: 'A', imageUrl: null },
      ],
      nfts: [],
    });

    const svc = new StadiumPlayerService(
      stadiumRepo,
      clubRepo,
      makeVestiarioTemplateRepo(),
      makePrisma([], [{ kind: 'base', playerId: 'bp1', windowStartedAt: new Date(Date.now() - 10 * 60 * 1000) }]),
    );
    await expect(
      svc.saveLineup('user-1', { s1: { playerId: 'bp1', kind: 'base' } }),
    ).rejects.toMatchObject({ code: 'PLAYER_FREE_FIELD_LOCKED' });
  });

  it('saveLineup persists valid assignment when staked', async () => {
    const stadiumRepo = makeStadiumRepo();
    const clubRepo = makeClubRepo();
    stadiumRepo.findLineupByClubId.mockResolvedValue(null);
    stadiumRepo.findDefaultTemplate.mockResolvedValue(templateRow);
    stadiumRepo.upsertLineup.mockResolvedValue({});
    clubRepo.findByUserId.mockResolvedValue({
      id: 'club-1',
      stadiumLvl: 1,
      user: { wallet: null },
    });
    clubRepo.getInventory.mockResolvedValue({
      basePlayers: [
        { id: 'bp1', rarity: 0, overwall: 500, position: 0, name: 'A', imageUrl: null },
      ],
      nfts: [],
    });

    const svc = new StadiumPlayerService(
      stadiumRepo,
      clubRepo,
      makeVestiarioTemplateRepo(),
      makePrisma([{ kind: 'base', playerId: 'bp1' }]),
    );
    const result = await svc.saveLineup('user-1', {
      s1: { playerId: 'bp1', kind: 'base' },
    });
    expect(stadiumRepo.upsertLineup).toHaveBeenCalledWith('club-1', 'tpl-1', {
      s1: { playerId: 'bp1', kind: 'base' },
    });
    expect(result.slots[0].player?.id).toBe('bp1');
    expect(result.slots[0].player?.staked).toBe(true);
    expect(result.slots[0].player?.stakeGmt).toBe(0.125);
  });

  it('getView prunes stale lineup assignments so players return to bench', async () => {
    const stadiumRepo = makeStadiumRepo();
    const clubRepo = makeClubRepo();
    stadiumRepo.findLineupByClubId.mockResolvedValue({
      clubId: 'club-1',
      stadiumTemplateId: 'tpl-1',
      assignments: {
        s1: { playerId: 'deleted-player', kind: 'base' },
        s2: { playerId: 'bp1', kind: 'base' },
      },
      stadiumTemplate: templateRow,
    });
    stadiumRepo.upsertLineup.mockResolvedValue({});
    clubRepo.findByUserId.mockResolvedValue({
      id: 'club-1',
      stadiumLvl: 1,
      user: { wallet: null },
    });
    clubRepo.getInventory.mockResolvedValue({
      basePlayers: [
        // position 3 = FW — matches slot s2 (ATA)
        { id: 'bp1', rarity: 0, overwall: 500, position: 3, name: 'A', imageUrl: null, stamina: 100 },
      ],
      nfts: [],
    });

    const svc = new StadiumPlayerService(stadiumRepo, clubRepo, makeVestiarioTemplateRepo());
    const view = await svc.getView('user-1');

    expect(stadiumRepo.upsertLineup).toHaveBeenCalledWith('club-1', 'tpl-1', {
      s2: { playerId: 'bp1', kind: 'base' },
    });
    expect(view.assignments).toEqual({ s2: { playerId: 'bp1', kind: 'base' } });
    expect(view.slots[0].player).toBeNull();
    expect(view.slots[1].player?.id).toBe('bp1');
  });

  it('getView prunes unstaked players from lineup', async () => {
    const stadiumRepo = makeStadiumRepo();
    const clubRepo = makeClubRepo();
    stadiumRepo.findLineupByClubId.mockResolvedValue({
      clubId: 'club-1',
      stadiumTemplateId: 'tpl-1',
      assignments: {
        s2: { playerId: 'bp1', kind: 'base' },
      },
      stadiumTemplate: templateRow,
    });
    stadiumRepo.upsertLineup.mockResolvedValue({});
    clubRepo.findByUserId.mockResolvedValue({
      id: 'club-1',
      stadiumLvl: 1,
      user: { wallet: null },
    });
    clubRepo.getInventory.mockResolvedValue({
      basePlayers: [
        { id: 'bp1', rarity: 1, overwall: 500, position: 3, name: 'A', imageUrl: null, stamina: 100 },
      ],
      nfts: [],
    });

    const svc = new StadiumPlayerService(
      stadiumRepo,
      clubRepo,
      makeVestiarioTemplateRepo(),
      makePrisma([]),
    );
    const view = await svc.getView('user-1');

    expect(stadiumRepo.upsertLineup).toHaveBeenCalledWith('club-1', 'tpl-1', {});
    expect(view.assignments).toEqual({});
    expect(view.slots[1].player).toBeNull();
  });

  it('getView remaps vestiario slot ids onto stadium template slots', async () => {
    const stadiumRepo = makeStadiumRepo();
    const clubRepo = makeClubRepo();
    const stadiumSlots = [
      { id: 'uuid-gk', label: 'GOL', xPct: 50, yPct: 80, role: 'GK' },
      { id: 'uuid-fw', label: 'ATA', xPct: 50, yPct: 30, role: 'FW' },
    ];
    const stadiumTemplate = { ...templateRow, id: 'tpl-master', name: 'Campo Master', slots: stadiumSlots };
    const vestiarioSlots = [
      { id: 's1', label: 'GOL', xPct: 50, yPct: 80, role: 'GK' },
      { id: 's2', label: 'ATA', xPct: 50, yPct: 30, role: 'FW' },
    ];

    stadiumRepo.findLineupByClubId.mockResolvedValue({
      clubId: 'club-1',
      stadiumTemplateId: 'tpl-master',
      assignments: {
        s1: { playerId: 'bp1', kind: 'base' },
        s2: { playerId: 'bp2', kind: 'base' },
      },
      stadiumTemplate,
    });
    clubRepo.findByUserId.mockResolvedValue({
      id: 'club-1',
      stadiumLvl: 1,
      user: { wallet: null },
    });
    clubRepo.getInventory.mockResolvedValue({
      basePlayers: [
        { id: 'bp1', rarity: 1, overwall: 700, position: 0, name: 'GK', imageUrl: null, stamina: 100 },
        { id: 'bp2', rarity: 1, overwall: 720, position: 3, name: 'FW', imageUrl: null, stamina: 100 },
      ],
      nfts: [],
    });

    const svc = new StadiumPlayerService(
      stadiumRepo,
      clubRepo,
      {
        getDefault: vi.fn().mockResolvedValue({
          id: 'default',
          imageUrl: '/uploads/vestiario/field.png',
          slots: vestiarioSlots,
          updatedAt: new Date().toISOString(),
        }),
      } as any,
    );
    const view = await svc.getView('user-1');

    expect(view.template.name).toBe('Campo Master');
    expect(view.assignments).toEqual({
      'uuid-gk': { playerId: 'bp1', kind: 'base' },
      'uuid-fw': { playerId: 'bp2', kind: 'base' },
    });
    expect(view.slots[0].player?.id).toBe('bp1');
    expect(view.slots[1].player?.id).toBe('bp2');
    // Storage stays on vestiário ids — no wipe upsert when only display remap differs.
    expect(stadiumRepo.upsertLineup).not.toHaveBeenCalled();
  });

  it('getVestiarioView uses vestiario template image and slots', async () => {
    const stadiumRepo = makeStadiumRepo();
    const clubRepo = makeClubRepo();
    const vestiarioTemplateRepo = makeVestiarioTemplateRepo();
    stadiumRepo.findLineupByClubId.mockResolvedValue(null);
    clubRepo.findByUserId.mockResolvedValue({
      id: 'club-1',
      stadiumLvl: 2,
      user: { wallet: null },
    });
    clubRepo.getInventory.mockResolvedValue({ basePlayers: [], nfts: [] });

    const svc = new StadiumPlayerService(stadiumRepo, clubRepo, vestiarioTemplateRepo);
    const view = await svc.getVestiarioView('user-1');

    expect(view.template.imageUrl).toBe('/uploads/vestiario/field.png');
    expect(view.template.name).toBe('Vestiário');
    expect(vestiarioTemplateRepo.getDefault).toHaveBeenCalled();
  });
});

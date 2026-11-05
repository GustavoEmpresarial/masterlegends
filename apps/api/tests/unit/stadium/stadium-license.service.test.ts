import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Prisma } from '@prisma/client';
import { ErrorCode } from '@mll/shared';
import { StadiumLicenseService } from '../../../src/modules/stadium/stadium-license.service.js';
import { AppError } from '../../../src/common/lib/errors.js';

vi.mock('../../../src/modules/wallet/mgt-ledger.js', () => ({
  applyMgtDebit: vi.fn().mockResolvedValue({ balanceAfter: 0, transactionId: 'tx-1' }),
}));

import { applyMgtDebit } from '../../../src/modules/wallet/mgt-ledger.js';

const club = { id: 'club-1', name: 'Baixada FC', userId: 'user-1' };
const paidTemplate = {
  id: 'tpl-paid',
  name: 'Campo Master',
  imageUrl: '/img.png',
  slots: [{ id: 's1' }],
  priceUsdc: new Prisma.Decimal(0.55),
  active: true,
  isDefault: false,
  farmBonusPct: new Prisma.Decimal(0.05),
  sortOrder: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
};
const freeTemplate = {
  ...paidTemplate,
  id: 'tpl-free',
  name: 'Gandula',
  priceUsdc: null,
  isDefault: true,
  sortOrder: 0,
};

function makePrisma(overrides: Record<string, unknown> = {}) {
  const state = {
    licenses: new Map<string, any>(),
    lineup: null as any,
  };

  const prisma: any = {
    club: {
      findUnique: vi.fn().mockResolvedValue(club),
    },
    stadiumTemplate: {
      findMany: vi.fn().mockImplementation(async ({ where }: any = {}) => {
        const all = [freeTemplate, paidTemplate];
        if (!where) return all;
        // free/default filter used by ensureFreeLicenses
        if (where.OR) {
          return all.filter(
            (t) =>
              t.isDefault ||
              t.priceUsdc == null ||
              Number(t.priceUsdc) <= 0,
          );
        }
        return all.filter((t) => t.active);
      }),
      findFirst: vi.fn().mockImplementation(async ({ where }: any) => {
        if (where?.id === paidTemplate.id) return paidTemplate;
        if (where?.id === freeTemplate.id) return freeTemplate;
        return null;
      }),
    },
    clubStadiumLicense: {
      findMany: vi.fn().mockImplementation(async () => [...state.licenses.values()]),
      findUnique: vi.fn().mockImplementation(async ({ where }: any) => {
        const tid = where?.clubId_stadiumTemplateId?.stadiumTemplateId;
        return tid ? state.licenses.get(tid) ?? null : null;
      }),
      create: vi.fn().mockImplementation(async ({ data }: any) => {
        const row = { id: `lic-${data.stadiumTemplateId}`, ...data };
        state.licenses.set(data.stadiumTemplateId, row);
        return row;
      }),
      update: vi.fn().mockImplementation(async ({ where, data }: any) => {
        const existing = [...state.licenses.values()].find((l) => l.id === where.id);
        const next = { ...existing, ...data };
        state.licenses.set(next.stadiumTemplateId, next);
        return next;
      }),
      upsert: vi.fn().mockImplementation(async ({ where, create, update }: any) => {
        const tid = where.clubId_stadiumTemplateId.stadiumTemplateId;
        const prev = state.licenses.get(tid);
        const row = prev
          ? { ...prev, ...update }
          : { id: `lic-${tid}`, ...create };
        state.licenses.set(tid, row);
        return row;
      }),
    },
    clubLineup: {
      findUnique: vi.fn().mockImplementation(async () => state.lineup),
      update: vi.fn().mockImplementation(async ({ data }: any) => {
        state.lineup = { ...state.lineup, ...data };
        return state.lineup;
      }),
      create: vi.fn().mockImplementation(async ({ data }: any) => {
        state.lineup = data;
        return data;
      }),
    },
    mGTBalance: {
      findUnique: vi.fn().mockResolvedValue({ usdcAmount: new Prisma.Decimal(10) }),
    },
    user: {
      findUnique: vi.fn().mockResolvedValue({ wallet: null }),
    },
    basePlayer: {
      count: vi.fn().mockResolvedValue(11),
      findMany: vi.fn().mockResolvedValue([]),
    },
    playerGearEquip: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    playerCache: {
      count: vi.fn().mockResolvedValue(0),
    },
    checkInGrant: {
      aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 0 } }),
    },
    eventOverwallGrant: {
      aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 0 } }),
    },
    vestiarioTemplate: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
    $transaction: vi.fn(async (fn: any) => fn(prisma)),
    __state: state,
    ...overrides,
  };
  return prisma;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('StadiumLicenseService', () => {
  it('auto-grants signed license for free templates on catalog', async () => {
    const prisma = makePrisma();
    const service = new StadiumLicenseService(prisma);
    const catalog = await service.getCatalog('user-1');
    expect(prisma.clubStadiumLicense.upsert).toHaveBeenCalled();
    expect(catalog.items.some((i) => i.isFree)).toBe(true);
  });

  it('buys paid license with GMT debit', async () => {
    const prisma = makePrisma();
    prisma.stadiumTemplate.findMany = vi.fn().mockResolvedValue([paidTemplate]);
    prisma.clubStadiumLicense.findMany = vi.fn().mockResolvedValue([]);
    const service = new StadiumLicenseService(prisma);

    await service.buy('user-1', paidTemplate.id);

    expect(applyMgtDebit).toHaveBeenCalled();
    expect(prisma.clubStadiumLicense.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'purchased', stadiumTemplateId: paidTemplate.id }),
      }),
    );
  });

  it('rejects buy when already owned', async () => {
    const prisma = makePrisma();
    prisma.__state.licenses.set(paidTemplate.id, {
      id: 'lic-1',
      clubId: club.id,
      stadiumTemplateId: paidTemplate.id,
      status: 'purchased',
    });
    const service = new StadiumLicenseService(prisma);
    await expect(service.buy('user-1', paidTemplate.id)).rejects.toMatchObject({
      code: ErrorCode.STADIUM_LICENSE_ALREADY_OWNED,
    });
  });

  it('rejects sign when not purchased', async () => {
    const prisma = makePrisma();
    const service = new StadiumLicenseService(prisma);
    await expect(service.sign('user-1', paidTemplate.id)).rejects.toBeInstanceOf(AppError);
  });

  it('signs purchased license then activates', async () => {
    const prisma = makePrisma();
    prisma.__state.licenses.set(paidTemplate.id, {
      id: 'lic-1',
      clubId: club.id,
      stadiumTemplateId: paidTemplate.id,
      status: 'purchased',
    });
    prisma.__state.lineup = {
      clubId: club.id,
      stadiumTemplateId: freeTemplate.id,
      assignments: {},
    };
    const service = new StadiumLicenseService(prisma);

    await service.sign('user-1', paidTemplate.id);
    expect(prisma.__state.licenses.get(paidTemplate.id).status).toBe('signed');

    await service.activate('user-1', paidTemplate.id);
    expect(prisma.clubLineup.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { stadiumTemplateId: paidTemplate.id },
      }),
    );
  });

  it('rejects activate when not signed', async () => {
    const prisma = makePrisma();
    prisma.__state.licenses.set(paidTemplate.id, {
      id: 'lic-1',
      clubId: club.id,
      stadiumTemplateId: paidTemplate.id,
      status: 'purchased',
    });
    const service = new StadiumLicenseService(prisma);
    await expect(service.activate('user-1', paidTemplate.id)).rejects.toMatchObject({
      code: ErrorCode.STADIUM_LICENSE_NOT_SIGNED,
    });
  });

  it('rejects buy without 11 rare+ squad players', async () => {
    const prisma = makePrisma();
    prisma.basePlayer.count = vi.fn().mockResolvedValue(3);
    prisma.stadiumTemplate.findMany = vi.fn().mockResolvedValue([paidTemplate]);
    prisma.clubStadiumLicense.findMany = vi.fn().mockResolvedValue([]);
    const service = new StadiumLicenseService(prisma);
    await expect(service.buy('user-1', paidTemplate.id)).rejects.toMatchObject({
      code: ErrorCode.STADIUM_LICENSE_RARE_TEAM_REQUIRED,
    });
  });

  it('activate switches template without rewriting assignments', async () => {
    const prisma = makePrisma();
    const assignments = { s1: { playerId: 'bp1', kind: 'base' } };
    prisma.__state.licenses.set(paidTemplate.id, {
      id: 'lic-1',
      clubId: club.id,
      stadiumTemplateId: paidTemplate.id,
      status: 'signed',
    });
    prisma.__state.lineup = {
      clubId: club.id,
      stadiumTemplateId: freeTemplate.id,
      assignments,
    };
    const service = new StadiumLicenseService(prisma);
    await service.activate('user-1', paidTemplate.id);
    expect(prisma.__state.lineup.stadiumTemplateId).toBe(paidTemplate.id);
    expect(prisma.__state.lineup.assignments).toEqual(assignments);
  });
});

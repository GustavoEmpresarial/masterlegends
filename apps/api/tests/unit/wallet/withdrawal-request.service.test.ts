import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../src/modules/platform/platform-config.service.js', () => {
  const get = vi.fn();
  const PlatformConfigService = vi.fn().mockImplementation(() => ({ get, ensureDefault: vi.fn() }));
  return { PlatformConfigService, __get: get };
});

vi.mock('../../../src/modules/wallet/satspay-client.js', async () => {
  const actual = await vi.importActual<typeof import('../../../src/modules/wallet/satspay-client.js')>(
    '../../../src/modules/wallet/satspay-client.js',
  );
  return {
    ...actual,
    findSatspaySend: vi.fn().mockResolvedValue(null),
    sendSatspayUsdt: vi.fn().mockResolvedValue('ref-satspay-1'),
  };
});

vi.mock('../../../src/modules/wallet/mgt-ledger.js', () => ({
  applyUsdtDebit: vi.fn().mockResolvedValue(90),
  lockUsdt: vi.fn().mockResolvedValue({ balanceAfter: 90, lockedAfter: 10 }),
  releaseUsdt: vi.fn().mockResolvedValue({ balanceAfter: 100, lockedAfter: 0 }),
  settleLockedUsdt: vi.fn().mockResolvedValue({ balanceAfter: 90, lockedAfter: 0 }),
}));

const platformMod = await import('../../../src/modules/platform/platform-config.service.js');
const platformGet = (platformMod as any).__get as ReturnType<typeof vi.fn>;

const ledgerMod = await import('../../../src/modules/wallet/mgt-ledger.js');
const settleLockedUsdt = ledgerMod.settleLockedUsdt as ReturnType<typeof vi.fn>;
const releaseUsdt = ledgerMod.releaseUsdt as ReturnType<typeof vi.fn>;
const lockUsdt = ledgerMod.lockUsdt as ReturnType<typeof vi.fn>;

const satspayMod = await import('../../../src/modules/wallet/satspay-client.js');
const findSatspaySend = satspayMod.findSatspaySend as ReturnType<typeof vi.fn>;
const sendSatspayUsdt = satspayMod.sendSatspayUsdt as ReturnType<typeof vi.fn>;

import { WithdrawalRequestService } from '../../../src/modules/wallet/withdrawal-request.service.js';

const defaultCfg = {
  minDepositUsdc: 1,
  minWithdrawUsdc: 1,
  withdrawFeePct: 0.05,
  withdrawalsPaused: false,
};

function makePrisma() {
  const prisma = {
    platformConfig: {
      upsert: vi.fn().mockResolvedValue({}),
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
    },
    user: { findUnique: vi.fn() },
    mGTBalance: { findUnique: vi.fn().mockResolvedValue({ usdcAmount: 0, usdtAmount: 100 }) },
    withdrawalRequest: {
      aggregate: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      findMany: vi.fn(),
    },
    $transaction: vi.fn(),
  };
  prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
    const tx = {
      withdrawalRequest: {
        create: (...args: unknown[]) => prisma.withdrawalRequest.create(...args),
        update: (...args: unknown[]) => prisma.withdrawalRequest.update(...args),
        updateMany: (...args: unknown[]) => prisma.withdrawalRequest.updateMany(...args),
      },
    };
    return fn(tx);
  });
  return prisma as any;
}

function validUser(overrides = {}) {
  return {
    id: 'user-1',
    wallet: '0xAbC',
    emailVerifiedAt: new Date(),
    bannedAt: null,
    ...overrides,
  };
}

function withdrawalRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'wr-1',
    userId: 'user-1',
    wallet: '0xabc',
    requestedUsdc: { toString: () => '10' },
    feeUsdc: { toString: () => '0.5' },
    amountUsdc: { toString: () => '9.5' },
    status: 'pending',
    adminNote: null,
    reviewedBy: null,
    reviewedAt: null,
    txHash: null,
    createdAt: new Date(),
    user: { email: 'a@b.com', username: 'alice' },
    ...overrides,
  };
}

describe('WithdrawalRequestService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    platformGet.mockResolvedValue(defaultCfg);
  });

  describe('createRequest', () => {
    it('throws WITHDRAWALS_PAUSED when paused', async () => {
      platformGet.mockResolvedValue({ ...defaultCfg, withdrawalsPaused: true });
      const prisma = makePrisma();
      const svc = new WithdrawalRequestService(prisma);
      await expect(svc.createRequest('u1', 10)).rejects.toMatchObject({ code: 'WITHDRAWALS_PAUSED' });
    });

    it('creates withdrawal with gross, fee and net amounts', async () => {
      const prisma = makePrisma();
      prisma.user.findUnique.mockResolvedValue(validUser());
      prisma.withdrawalRequest.aggregate.mockResolvedValue({ _sum: { requestedUsdc: 0 } });
      prisma.withdrawalRequest.create.mockResolvedValue(withdrawalRow());

      const svc = new WithdrawalRequestService(prisma);
      await svc.createRequest('u1', 10, { satspayEmail: 'Jogador@Sats.test' });
      expect(prisma.withdrawalRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            requestedUsdc: 10,
            feeUsdc: 0.5,
            amountUsdc: 9.5,
            paymentMethod: 'satspay',
            satspayEmail: 'jogador@sats.test',
          }),
        }),
      );
      expect(lockUsdt).toHaveBeenCalledWith(
        expect.anything(),
        'u1',
        10,
        'usdt_withdraw',
        expect.objectContaining({ destination: 'withdraw' }),
      );
    });
  });

  describe('approve', () => {
    it('debits ledger and marks completed without vault call', async () => {
      const prisma = makePrisma();
      const pending = withdrawalRow();
      prisma.withdrawalRequest.findUnique
        .mockResolvedValueOnce(pending)
        .mockResolvedValueOnce(undefined);
      prisma.withdrawalRequest.findUniqueOrThrow.mockResolvedValue(
        withdrawalRow({ status: 'completed', txHash: '0x' + 'a'.repeat(64) }),
      );
      const svc = new WithdrawalRequestService(prisma);
      const txHash = '0x' + 'b'.repeat(64);
      const result = await svc.approve('wr-1', 'admin', txHash);

      expect(settleLockedUsdt).toHaveBeenCalledWith(
        expect.anything(),
        'user-1',
        10,
        'usdt_withdraw',
        expect.objectContaining({ withdrawalId: 'wr-1', netUsdt: 9.5 }),
      );
      expect(result.status).toBe('completed');
    });
  });

  describe('sendViaSatspay', () => {
    function pendingSatspay() {
      return withdrawalRow({
        currency: 'usdt',
        satspayEmail: 'jogador@sats.test',
        amountUsdc: { toString: () => '9.5' },
      });
    }

    it('sends the net amount and settles the locked gross', async () => {
      const prisma = makePrisma();
      prisma.withdrawalRequest.findUnique.mockResolvedValueOnce(pendingSatspay());
      prisma.withdrawalRequest.findUniqueOrThrow.mockResolvedValue(
        withdrawalRow({ status: 'completed', txHash: 'ref-satspay-1', satspayEmail: 'jogador@sats.test', currency: 'usdt' }),
      );
      findSatspaySend.mockResolvedValue(null);
      sendSatspayUsdt.mockResolvedValue('ref-satspay-1');

      const svc = new WithdrawalRequestService(prisma);
      const result = await svc.sendViaSatspay('wr-1', 'admin');

      expect(sendSatspayUsdt).toHaveBeenCalledWith({
        toEmail: 'jogador@sats.test',
        amountUnits: '950000000',
        idempotencyKey: 'wr-1',
      });
      expect(settleLockedUsdt).toHaveBeenCalledWith(
        expect.anything(),
        'user-1',
        10,
        'usdt_withdraw',
        expect.objectContaining({ netUsdt: 9.5, rail: 'satspay' }),
      );
      expect(result.status).toBe('completed');
    });

    it('keeps the request pending when SatsPay refuses', async () => {
      const prisma = makePrisma();
      prisma.withdrawalRequest.findUnique
        .mockResolvedValueOnce(pendingSatspay())
        .mockResolvedValueOnce(pendingSatspay());
      findSatspaySend.mockResolvedValue(null);
      sendSatspayUsdt.mockRejectedValue(new satspayMod.SatspayError('TARGET_INELIGIBLE', 'sem conta', 400));

      const svc = new WithdrawalRequestService(prisma);
      await expect(svc.sendViaSatspay('wr-1', 'admin')).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
        details: { satspayCode: 'TARGET_INELIGIBLE' },
      });
      expect(settleLockedUsdt).not.toHaveBeenCalled();
      expect(prisma.withdrawalRequest.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'pending', metadata: expect.objectContaining({ satspayError: 'TARGET_INELIGIBLE' }) }),
        }),
      );
    });
  });

  describe('reject', () => {
    it('updates status to rejected with reason', async () => {
      const prisma = makePrisma();
      prisma.withdrawalRequest.findUnique.mockResolvedValue(withdrawalRow());
      prisma.withdrawalRequest.update.mockResolvedValue(
        withdrawalRow({ status: 'rejected', adminNote: 'suspicious' }),
      );

      const svc = new WithdrawalRequestService(prisma);
      const result = await svc.reject('wr-1', 'admin', 'suspicious');
      expect(releaseUsdt).toHaveBeenCalledWith(
        expect.anything(),
        'user-1',
        10,
        'usdt_withdraw',
        expect.objectContaining({ withdrawalId: 'wr-1', origin: 'withdraw' }),
      );
      expect(result.status).toBe('rejected');
    });
  });
});

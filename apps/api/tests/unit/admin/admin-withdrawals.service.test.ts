import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WithdrawalRequestService } from '../../../src/modules/wallet/withdrawal-request.service.js';
import { ErrorCode } from '@mll/shared';

vi.mock('../../../src/modules/wallet/mgt-ledger.js', () => ({
  lockUsdt: vi.fn().mockResolvedValue({ balanceAfter: 90, lockedAfter: 10 }),
  releaseUsdt: vi.fn().mockResolvedValue({ balanceAfter: 100, lockedAfter: 0 }),
  settleLockedUsdt: vi.fn().mockResolvedValue({ balanceAfter: 90, lockedAfter: 0 }),
}));

vi.mock('../../../src/modules/wallet/vault-operator.service.js', () => ({
  VaultOperatorService: vi.fn().mockImplementation(() => ({
    readVaultBalance: vi.fn().mockResolvedValue(100),
    approveAndFulfill: vi.fn().mockResolvedValue('0xabc'),
  })),
}));

vi.mock('../../../src/modules/platform/platform-config.service.js', () => ({
  PlatformConfigService: vi.fn().mockImplementation(() => ({
    get: vi.fn().mockResolvedValue({
      minWithdrawUsdc: 1,
      withdrawalsPaused: false,
    }),
  })),
}));

function mockPrisma() {
  const prisma: any = {
    user: { findUnique: vi.fn() },
    mGTBalance: { findUnique: vi.fn().mockResolvedValue({ usdtAmount: 0 }) },
    withdrawalRequest: {
      aggregate: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
    },
  };
  prisma.$transaction = vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma));
  return prisma;
}

describe('WithdrawalRequestService', () => {
  let prisma: ReturnType<typeof mockPrisma>;
  let service: WithdrawalRequestService;

  beforeEach(() => {
    prisma = mockPrisma();
    service = new WithdrawalRequestService(prisma as never);
  });

  it('reject moves pending to rejected', async () => {
    prisma.withdrawalRequest.findUnique.mockResolvedValue({
      id: 'w1',
      userId: 'u1',
      wallet: '0xabc',
      requestedUsdc: 10,
      amountUsdc: 10,
      status: 'pending',
      user: { email: 'a@test.com', username: 'a' },
    });
    prisma.withdrawalRequest.update.mockResolvedValue({
      id: 'w1',
      userId: 'u1',
      wallet: '0xabc',
      amountUsdc: 10,
      status: 'rejected',
      adminNote: 'invalid',
      reviewedBy: 'admin',
      reviewedAt: new Date(),
      txHash: null,
      createdAt: new Date(),
      user: { email: 'a@test.com', username: 'a' },
    });

    const result = await service.reject('w1', 'admin', 'invalid');
    expect(result.status).toBe('rejected');
    expect(result.adminNote).toBe('invalid');
  });

  it('approve rejects invalid state', async () => {
    prisma.withdrawalRequest.findUnique.mockResolvedValue({
      id: 'w1',
      status: 'completed',
      wallet: '0x',
      amountUsdc: 1,
      user: {},
    });
    await expect(service.approve('w1', 'admin')).rejects.toMatchObject({
      code: ErrorCode.WITHDRAWAL_INVALID_STATE,
    });
  });

  it('createRequest fails when ledger USDC is below requested+pending', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      wallet: '0xABC',
      emailVerifiedAt: new Date(),
      bannedAt: null,
    });
    prisma.mGTBalance.findUnique.mockResolvedValue({ usdtAmount: 5 });
    prisma.withdrawalRequest.aggregate.mockResolvedValue({ _sum: { requestedUsdc: 0 } });
    await expect(service.createRequest('u1', 10)).rejects.toMatchObject({
      code: ErrorCode.INSUFFICIENT_VAULT_BALANCE,
    });
  });

  it('createRequest uses available USDT and does not add pending on top', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      wallet: '0xABC',
      emailVerifiedAt: new Date(),
      bannedAt: null,
    });
    prisma.mGTBalance.findUnique.mockResolvedValue({ usdtAmount: 9 });
    await expect(service.createRequest('u1', 10)).rejects.toMatchObject({
      code: ErrorCode.INSUFFICIENT_VAULT_BALANCE,
    });
    expect(prisma.withdrawalRequest.aggregate).not.toHaveBeenCalled();
  });

  it('createRequest succeeds and uses ledger USDC (not on-chain vault)', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      wallet: '0xABC',
      emailVerifiedAt: new Date(),
      bannedAt: null,
    });
    prisma.mGTBalance.findUnique.mockResolvedValue({ usdtAmount: 100 });
    prisma.withdrawalRequest.aggregate.mockResolvedValue({ _sum: { requestedUsdc: 0 } });
    prisma.withdrawalRequest.create.mockResolvedValue({
      id: 'w1',
      userId: 'u1',
      wallet: '0xabc',
      amountUsdc: 10,
      status: 'pending',
      adminNote: null,
      reviewedBy: null,
      reviewedAt: null,
      txHash: null,
      createdAt: new Date(),
      user: { email: null, username: 'a' },
    });
    const res = await service.createRequest('u1', 10, { satspayEmail: 'jogador@sats.test' });
    expect(res.status).toBe('pending');
    expect(prisma.mGTBalance.findUnique).toHaveBeenCalledWith({ where: { userId: 'u1' } });
  });

  it('createRequest blocks unverified email', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      wallet: '0xABC',
      emailVerifiedAt: null,
      bannedAt: null,
    });
    await expect(service.createRequest('u1', 5)).rejects.toMatchObject({
      code: ErrorCode.AUTH_EMAIL_NOT_VERIFIED,
    });
  });

  it('createRequest blocks banned user', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      wallet: '0xABC',
      emailVerifiedAt: new Date(),
      bannedAt: new Date(),
    });
    await expect(service.createRequest('u1', 5)).rejects.toMatchObject({
      code: ErrorCode.USER_BANNED,
    });
  });

  it('createRequest blocks wallet not linked', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      wallet: null,
      emailVerifiedAt: new Date(),
      bannedAt: null,
    });
    await expect(service.createRequest('u1', 5)).rejects.toMatchObject({
      code: ErrorCode.AUTH_WALLET_NOT_LINKED,
    });
  });

  it('createRequest fails when withdrawals paused', async () => {
    const { PlatformConfigService } = await import(
      '../../../src/modules/platform/platform-config.service.js'
    );
    vi.mocked(PlatformConfigService).mockImplementation(
      () =>
        ({
          get: vi.fn().mockResolvedValue({ minWithdrawUsdc: 1, withdrawalsPaused: true }),
        }) as never,
    );
    service = new WithdrawalRequestService(prisma as never);
    await expect(service.createRequest('u1', 5)).rejects.toMatchObject({
      code: ErrorCode.WITHDRAWALS_PAUSED,
    });
  });
});

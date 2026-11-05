import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ethers } from 'ethers';
import { WalletLinkService } from '../../../src/modules/auth/wallet-link.service.js';
import { ErrorCode } from '@mll/shared';
import { AppError } from '../../../src/common/lib/errors.js';

const userId = 'user-1';
const username = 'testuser';

function makeRedis() {
  const store = new Map<string, string>();
  return {
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    set: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
      return 'OK';
    }),
    del: vi.fn(async (key: string) => {
      store.delete(key);
      return 1;
    }),
    _store: store,
  };
}

function makeRepo(overrides: Record<string, unknown> = {}) {
  return {
    findById: vi.fn(async () => ({ id: userId, username, wallet: null, ...overrides })),
    findByWallet: vi.fn(async () => null),
    updateWallet: vi.fn(async () => ({})),
  };
}

describe('WalletLinkService', () => {
  let redis: ReturnType<typeof makeRedis>;
  let repo: ReturnType<typeof makeRepo>;
  let service: WalletLinkService;

  beforeEach(() => {
    redis = makeRedis();
    repo = makeRepo();
    service = new WalletLinkService(redis as never, repo as never);
  });

  it('creates a challenge stored in redis', async () => {
    const result = await service.createChallenge(userId, username);
    expect(result.message).toContain('Link wallet to Master Legends League');
    expect(result.message).toContain(username);
    expect(redis.set).toHaveBeenCalled();
  });

  it('links wallet when signature is valid', async () => {
    const wallet = ethers.Wallet.createRandom();
    const challenge = await service.createChallenge(userId, username);
    const signature = await wallet.signMessage(challenge.message);

    const result = await service.linkWallet(userId, wallet.address, signature);

    expect(result.wallet).toBe(wallet.address.toLowerCase());
    expect(repo.updateWallet).toHaveBeenCalledWith(userId, wallet.address.toLowerCase());
  });

  it('rejects invalid signature', async () => {
    const wallet = ethers.Wallet.createRandom();
    await service.createChallenge(userId, username);

    await expect(
      service.linkWallet(userId, wallet.address, '0x' + 'ab'.repeat(65)),
    ).rejects.toMatchObject({ code: ErrorCode.AUTH_WALLET_INVALID_SIGNATURE });
  });

  it('rejects wallet already taken by another user', async () => {
    const wallet = ethers.Wallet.createRandom();
    const challenge = await service.createChallenge(userId, username);
    const signature = await wallet.signMessage(challenge.message);
    repo.findByWallet.mockResolvedValue({ id: 'other-user' });

    await expect(service.linkWallet(userId, wallet.address, signature)).rejects.toMatchObject({
      code: ErrorCode.AUTH_WALLET_TAKEN,
    });
  });

  it('unlinks wallet', async () => {
    repo.findById.mockResolvedValue({ id: userId, wallet: '0xabc' });
    await service.unlinkWallet(userId);
    expect(repo.updateWallet).toHaveBeenCalledWith(userId, null);
  });

  it('throws when unlinking without wallet', async () => {
    await expect(service.unlinkWallet(userId)).rejects.toBeInstanceOf(AppError);
  });
});

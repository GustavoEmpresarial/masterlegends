import { randomBytes } from 'crypto';
import { ethers } from 'ethers';
import type Redis from 'ioredis';
import { AppError, ErrorCode } from '../../common/lib/errors.js';
import { AuthRepository } from './auth.repository.js';

const KEY_CHALLENGE = (userId: string) => `wallet:challenge:${userId}`;
const CHALLENGE_TTL_SECONDS = 300;

interface StoredChallenge {
  message: string;
  expiresAt: string;
}

export class WalletLinkService {
  constructor(
    private readonly redis: Redis,
    private readonly repo: AuthRepository,
  ) {}

  async createChallenge(userId: string, username: string): Promise<{ message: string; expiresAt: string }> {
    const nonce = randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + CHALLENGE_TTL_SECONDS * 1000);
    const message = [
      'Link wallet to Master Legends League',
      '',
      `Account: ${username}`,
      `Nonce: ${nonce}`,
      `Expires: ${expiresAt.toISOString()}`,
    ].join('\n');

    const payload: StoredChallenge = { message, expiresAt: expiresAt.toISOString() };
    await this.redis.set(KEY_CHALLENGE(userId), JSON.stringify(payload), 'EX', CHALLENGE_TTL_SECONDS);

    return payload;
  }

  async linkWallet(userId: string, address: string, signature: string): Promise<{ wallet: string }> {
    const raw = await this.redis.get(KEY_CHALLENGE(userId));
    if (!raw) {
      throw new AppError(ErrorCode.AUTH_WALLET_CHALLENGE_EXPIRED, 400);
    }

    const stored = JSON.parse(raw) as StoredChallenge;
    if (new Date(stored.expiresAt) < new Date()) {
      throw new AppError(ErrorCode.AUTH_WALLET_CHALLENGE_EXPIRED, 400);
    }

    const normalized = address.toLowerCase();
    if (!ethers.isAddress(normalized)) {
      throw new AppError(ErrorCode.AUTH_WALLET_INVALID_ADDRESS, 400);
    }

    let recovered: string;
    try {
      recovered = ethers.verifyMessage(stored.message, signature).toLowerCase();
    } catch {
      throw new AppError(ErrorCode.AUTH_WALLET_INVALID_SIGNATURE, 400);
    }

    if (recovered !== normalized) {
      throw new AppError(ErrorCode.AUTH_WALLET_INVALID_SIGNATURE, 400);
    }

    const user = await this.repo.findById(userId);
    if (!user) {
      throw new AppError(ErrorCode.USER_NOT_FOUND, 404);
    }
    if (user.wallet && user.wallet !== normalized) {
      throw new AppError(ErrorCode.AUTH_WALLET_ALREADY_LINKED, 400);
    }

    const taken = await this.repo.findByWallet(normalized);
    if (taken && taken.id !== userId) {
      throw new AppError(ErrorCode.AUTH_WALLET_TAKEN, 409);
    }

    await this.repo.updateWallet(userId, normalized);
    await this.redis.del(KEY_CHALLENGE(userId));

    return { wallet: normalized };
  }

  async unlinkWallet(userId: string): Promise<{ wallet: string }> {
    const user = await this.repo.findById(userId);
    if (!user?.wallet) {
      throw new AppError(ErrorCode.AUTH_WALLET_NOT_LINKED, 400);
    }
    const oldWallet = user.wallet;
    await this.repo.updateWallet(userId, null);
    return { wallet: oldWallet };
  }
}

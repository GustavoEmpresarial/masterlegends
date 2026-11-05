import { Queue } from 'bullmq';
import type Redis from 'ioredis';
import { CHAIN_INDEXER_QUEUE, REFERRAL_REWARDS_QUEUE } from '@mll/shared';
import { asBullMqConnection } from './redis-queue.js';
export { CHAIN_INDEXER_QUEUE, REFERRAL_REWARDS_QUEUE } from '@mll/shared';

const CHAIN_LAST_BLOCK_KEY = 'chain:indexer:last-block';
const CHAIN_LAST_EVENT_KEY = 'chain:indexer:last-event';
const TREASURY_POLL_LAST_BLOCK_KEY = 'chain:treasury-deposit-poller:last-block';

export class JobQueues {
  private readonly chainIndexer: Queue;
  private readonly referralRewards: Queue;

  constructor(private readonly redis: Redis) {
    const opts = {
      connection: asBullMqConnection(redis),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential' as const, delay: 5000 },
        removeOnComplete: { age: 3600, count: 1000 },
        removeOnFail: { age: 24 * 3600 },
      },
    };
    this.chainIndexer = new Queue(CHAIN_INDEXER_QUEUE, opts);
    this.referralRewards = new Queue(REFERRAL_REWARDS_QUEUE, opts);
  }

  async enqueueChainEvent(event: string, data: Record<string, unknown>): Promise<void> {
    await this.chainIndexer.add(event, { event, data });
    await this.redis.set(
      CHAIN_LAST_EVENT_KEY,
      JSON.stringify({ event, at: new Date().toISOString() }),
    );
  }

  async saveBlockCheckpoint(blockNumber: number): Promise<void> {
    await this.redis.set(CHAIN_LAST_BLOCK_KEY, String(blockNumber));
  }

  async getBlockCheckpoint(): Promise<number | null> {
    const value = await this.redis.get(CHAIN_LAST_BLOCK_KEY);
    return value ? Number(value) : null;
  }

  async getTreasuryPollCheckpoint(): Promise<number | null> {
    const value = await this.redis.get(TREASURY_POLL_LAST_BLOCK_KEY);
    return value ? Number(value) : null;
  }

  async saveTreasuryPollCheckpoint(blockNumber: number): Promise<void> {
    await this.redis.set(TREASURY_POLL_LAST_BLOCK_KEY, String(blockNumber));
  }

  async enqueueReferralReward(userId: string, mgtAmount: number): Promise<void> {
    if (mgtAmount <= 0) return;
    await this.referralRewards.add('reward', { userId, mgtAmount });
  }
}

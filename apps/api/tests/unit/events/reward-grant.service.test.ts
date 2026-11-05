import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ErrorCode, QuestRewardType, QUEST_REWARD_CAPS } from '@mll/shared';
import { grantQuestRewards } from '../../../src/modules/events/reward-grant.service.js';

vi.mock('../../../src/modules/wallet/mgt-ledger.js', () => ({
  applyMgtCredit: vi.fn().mockResolvedValue(100),
  applyUsdcCredit: vi.fn().mockResolvedValue(50),
  applyUsdtCredit: vi.fn().mockResolvedValue(50),
}));

import { applyMgtCredit, applyUsdcCredit, applyUsdtCredit } from '../../../src/modules/wallet/mgt-ledger.js';

function makeTx() {
  return {
    eventOverwallGrant: {
      create: vi.fn().mockResolvedValue({ id: 'ow-1' }),
    },
    basePlayer: {
      create: vi.fn().mockResolvedValue({ id: 'p1' }),
      aggregate: vi.fn().mockResolvedValue({ _sum: { overwall: 100 } }),
      updateMany: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn(),
    },
    club: {
      updateMany: vi.fn(),
    },
    itemTemplate: {
      findUnique: vi.fn(),
    },
    stadiumShopItem: {
      findUnique: vi.fn(),
    },
    eventBadge: {
      findUnique: vi.fn(),
    },
    userBadge: {
      upsert: vi.fn(),
    },
  } as any;
}

describe('grantQuestRewards', () => {
  beforeEach(() => {
    vi.mocked(applyMgtCredit).mockClear();
    vi.mocked(applyUsdcCredit).mockClear();
    vi.mocked(applyUsdtCredit).mockClear();
  });

  it('credits USDT via ledger', async () => {
    const tx = makeTx();
    await grantQuestRewards(tx, 'u1', 'q1', 'once', [{ type: QuestRewardType.USDT, amount: 5 }]);
    expect(applyUsdtCredit).toHaveBeenCalledWith(
      tx,
      'u1',
      5,
      expect.any(String),
      expect.objectContaining({ currency: 'USDT' }),
    );
  });

  it('rejects when total USDT exceeds soft cap', async () => {
    const tx = makeTx();
    await expect(
      grantQuestRewards(tx, 'u1', 'q1', 'once', [
        { type: QuestRewardType.USDT, amount: QUEST_REWARD_CAPS.usdt },
        { type: QuestRewardType.USDT, amount: 1 },
      ]),
    ).rejects.toMatchObject({
      code: ErrorCode.QUEST_REWARD_INVALID,
      details: { reason: 'usdt_cap' },
    });
  });

  it('creates EventOverwallGrant for OVERWALL', async () => {
    const tx = makeTx();
    await grantQuestRewards(tx, 'u1', 'q1', 'once', [
      { type: QuestRewardType.OVERWALL, amount: 50 },
    ]);

    expect(tx.eventOverwallGrant.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'u1',
          questId: 'q1',
          periodKey: 'once',
          amount: 50,
          lineIndex: 0,
        }),
      }),
    );
  });

  it('credits GMT via ledger', async () => {
    const tx = makeTx();
    await grantQuestRewards(tx, 'u1', 'q1', 'once', [{ type: QuestRewardType.GMT, amount: 25 }]);
    expect(applyMgtCredit).toHaveBeenCalled();
  });

  it('rejects when total GMT exceeds soft cap', async () => {
    const tx = makeTx();
    await expect(
      grantQuestRewards(tx, 'u1', 'q1', 'once', [
        { type: QuestRewardType.GMT, amount: QUEST_REWARD_CAPS.gmt },
        { type: QuestRewardType.GMT, amount: 1 },
      ]),
    ).rejects.toMatchObject({
      code: ErrorCode.QUEST_REWARD_INVALID,
      details: { reason: 'gmt_cap' },
    });
  });

  it('rejects rewards that are not gmt, usdc, usdt or overwall', async () => {
    const tx = makeTx();
    await expect(
      grantQuestRewards(tx, 'u1', 'q1', 'once', [
        { type: 'badge', badgeId: '11111111-1111-1111-1111-111111111111' },
      ]),
    ).rejects.toMatchObject({ code: ErrorCode.QUEST_REWARD_INVALID });
  });
});

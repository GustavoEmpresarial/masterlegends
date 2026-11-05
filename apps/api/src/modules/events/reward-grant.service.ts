import type { Prisma } from '@prisma/client';
import {
  ErrorCode,
  EVENT_OVERWALL_DURATION_DAYS,
  MgtTxType,
  QUEST_REWARD_CAPS,
  QuestRewardType,
  questRewardSchema,
  type QuestReward,
} from '@mll/shared';
import { AppError } from '../../common/lib/errors.js';
import { applyMgtCredit, applyUsdcCredit, applyUsdtCredit } from '../wallet/mgt-ledger.js';

type Tx = Prisma.TransactionClient;

function assertCap(type: string, amount: number) {
  if (type === QuestRewardType.GMT && amount > QUEST_REWARD_CAPS.gmt) {
    throw new AppError(ErrorCode.QUEST_REWARD_INVALID, 400, { reason: 'gmt_cap' });
  }
  if (type === QuestRewardType.USDC && amount > QUEST_REWARD_CAPS.usdc) {
    throw new AppError(ErrorCode.QUEST_REWARD_INVALID, 400, { reason: 'usdc_cap' });
  }
  if (type === QuestRewardType.USDT && amount > QUEST_REWARD_CAPS.usdt) {
    throw new AppError(ErrorCode.QUEST_REWARD_INVALID, 400, { reason: 'usdt_cap' });
  }
  if (type === QuestRewardType.OVERWALL && amount > QUEST_REWARD_CAPS.overwall) {
    throw new AppError(ErrorCode.QUEST_REWARD_INVALID, 400, { reason: 'overwall_cap' });
  }
}

/** Soft caps apply to the sum of all lines of the same currency in one claim. */
function assertTotalCaps(rewards: QuestReward[]) {
  const totals: Record<string, number> = {};
  for (const r of rewards) {
    if (
      r.type === QuestRewardType.GMT ||
      r.type === QuestRewardType.USDC ||
      r.type === QuestRewardType.USDT ||
      r.type === QuestRewardType.OVERWALL
    ) {
      totals[r.type] = (totals[r.type] ?? 0) + (r.amount ?? 0);
    }
  }
  for (const [type, total] of Object.entries(totals)) {
    assertCap(type, total);
  }
}

export async function grantQuestRewards(
  tx: Tx,
  userId: string,
  questId: string,
  periodKey: string,
  rewardsRaw: unknown,
): Promise<QuestReward[]> {
  const parsed = questRewardSchema.array().safeParse(rewardsRaw);
  if (!parsed.success) {
    throw new AppError(ErrorCode.QUEST_REWARD_INVALID, 400, { zod: parsed.error.flatten() });
  }
  const rewards = parsed.data;
  assertTotalCaps(rewards);

  const metaBase = { questId, periodKey, source: 'event_reward' };
  let overwallLine = 0;

  for (const r of rewards) {
    switch (r.type) {
      case QuestRewardType.GMT: {
        await applyMgtCredit(tx, userId, r.amount!, MgtTxType.EVENT_REWARD, metaBase);
        break;
      }
      case QuestRewardType.USDC: {
        await applyUsdcCredit(tx, userId, r.amount!, MgtTxType.EVENT_REWARD, {
          ...metaBase,
          currency: 'USDC',
        });
        break;
      }
      case QuestRewardType.USDT: {
        await applyUsdtCredit(tx, userId, r.amount!, MgtTxType.EVENT_REWARD, {
          ...metaBase,
          currency: 'USDT',
        });
        break;
      }
      case QuestRewardType.OVERWALL: {
        const now = new Date();
        const expiresAt = new Date(now.getTime() + EVENT_OVERWALL_DURATION_DAYS * 86_400_000);
        const lineIndex = overwallLine++;
        await tx.eventOverwallGrant.create({
          data: {
            userId,
            questId,
            periodKey,
            lineIndex,
            amount: Math.floor(r.amount!),
            expiresAt,
          },
        });
        break;
      }
      default:
        throw new AppError(ErrorCode.QUEST_REWARD_INVALID, 400);
    }
  }

  return rewards;
}

import type { PrismaClient } from '@prisma/client';
import type { SwapGmtInput, SwapGmtResultDTO } from '@mll/shared';
import { GMT_USDC_SWAP_RATE, MgtTxType, swapGmtSchema } from '@mll/shared';
import {
  applyMgtCredit,
  applyUsdcDebit,
  applyUsdtDebit,
  getBalances,
} from './mgt-ledger.js';

export class SwapService {
  constructor(private readonly prisma: PrismaClient) {}

  async swap(userId: string, raw: unknown): Promise<SwapGmtResultDTO> {
    const body: SwapGmtInput = swapGmtSchema.parse(raw);
    const from = body.from ?? 'usdc';
    const gmtAmount = body.amount * GMT_USDC_SWAP_RATE;
    const txType = from === 'usdt' ? MgtTxType.SWAP_USDT_TO_GMT : MgtTxType.SWAP_USDC_TO_GMT;

    return this.prisma.$transaction(async (tx) => {
      if (from === 'usdt') {
        await applyUsdtDebit(tx, userId, body.amount, txType, {
          gmtReceived: gmtAmount,
        });
        await applyMgtCredit(tx, userId, gmtAmount, txType, {
          usdtSpent: body.amount,
        });
      } else {
        await applyUsdcDebit(tx, userId, body.amount, txType, {
          gmtReceived: gmtAmount,
        });
        await applyMgtCredit(tx, userId, gmtAmount, txType, {
          usdcSpent: body.amount,
        });
      }

      const balances = await getBalances(tx, userId);
      return {
        amount: body.amount,
        from,
        gmtBalance: balances.gmtBalance,
        usdcBalance: balances.usdcBalance,
        usdtBalance: balances.usdtBalance,
      };
    });
  }
}

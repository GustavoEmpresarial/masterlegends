import { Prisma, type PrismaClient } from '@prisma/client';
import type {
  AdminPlatformRoiDTO,
  AdminPlatformRoiUserAlertDTO,
  AdminRoiAuditCheckDTO,
  AdminRoiAlertLevel,
  AdminUserRoiBlockRowDTO,
  AdminUserRoiDTO,
  AdminUserRoiListItemDTO,
} from '@mll/shared';
import { AppError, ErrorCode } from '../../common/lib/errors.js';
import { DEPOSITOR_OR } from './admin-user-filters.util.js';

/** Tipos que historicamente só mexiam no vault USDC (antes de meta.currency). */
const LEGACY_USDC_ONLY_TYPES = new Set([
  'usdc_deposit',
  'usdc_withdraw',
  'mining_claim',
  'swap_usdc_to_gmt',
  'swap_gmt_to_usdc',
  'stadium_license',
]);

const MINING_TYPE = 'mining_claim';
const DRIFT_TOLERANCE = 0.02;

/**
 * Corte operacional da auditoria ROI (00:00 America/Sao_Paulo de 26/07/2026).
 * Divergências anteriores a esta data são ignoradas nos totais de pool/ledger.
 * Override: ROI_AUDIT_SINCE=YYYY-MM-DD ou ISO completo.
 */
const ROI_AUDIT_EPOCH_DEFAULT = '2026-07-26T03:00:00.000Z';

function getRoiAuditSince(): Date {
  const raw = process.env.ROI_AUDIT_SINCE?.trim();
  if (raw) {
    const iso = raw.length <= 10 ? `${raw}T03:00:00.000Z` : raw;
    const d = new Date(iso);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date(ROI_AUDIT_EPOCH_DEFAULT);
}

function formatAuditSinceBr(d: Date): string {
  return d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

/** Movimento do vault USDC — nunca misturar com GMT (marketplace, farm, etc.). */
function isUsdcLedgerRow(type: string, meta: unknown): boolean {
  if (meta && typeof meta === 'object') {
    const currency = (meta as { currency?: string }).currency;
    if (currency === 'usdc') return true;
    if (currency === 'gmt') return false;
  }
  return LEGACY_USDC_ONLY_TYPES.has(type);
}

function poolDriftSeverity(drift: number, poolUsdc: number): AdminRoiAlertLevel {
  const abs = Math.abs(drift);
  const pct = poolUsdc > 0 ? abs / poolUsdc : abs;
  // Falta no pool (drift negativo) = arredondamento / poeira — não é over-distribution
  if (drift <= 0) return abs > 5 ? 'warning' : 'ok';
  if (abs > 5 || pct > 0.02) return 'critical';
  if (abs > 1 || pct > 0.01) return 'warning';
  return 'ok';
}

function ledgerDriftSeverity(drift: number): AdminRoiAlertLevel {
  const abs = Math.abs(drift);
  // Gap histórico (blocos sem credit no extrato) é comum — nunca "Crítico"
  if (abs > 0.5) return 'warning';
  if (abs > DRIFT_TOLERANCE) return 'warning';
  return 'ok';
}

export type AdminRoiUserSort = 'mining_desc' | 'capital_desc' | 'roi_desc' | 'name_asc';

function roiSortClause(sort: AdminRoiUserSort): string {
  switch (sort) {
    case 'capital_desc':
      return 'net_capital DESC NULLS LAST, u.id ASC';
    case 'roi_desc':
      return 'roi_ratio DESC NULLS LAST, u.id ASC';
    case 'name_asc':
      return 'COALESCE(u.username, u.email, u.id) ASC';
    case 'mining_desc':
    default:
      return 'paid DESC NULLS LAST, u.id ASC';
  }
}

function listItemAlert(netCapital: number, paid: number, currentUsdc = 0): AdminRoiAlertLevel {
  // Tem saldo na carteira → não grita “sem capital” (legado / extrato sujo).
  if (currentUsdc > DRIFT_TOLERANCE) return 'ok';
  if (paid > DRIFT_TOLERANCE && netCapital <= DRIFT_TOLERANCE) return 'warning';
  if (paid > netCapital * 2 && netCapital > DRIFT_TOLERANCE) return 'warning';
  return 'ok';
}

function roundUsdc(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}

function isUsdcAdminAdjust(meta: unknown): boolean {
  return isUsdcLedgerRow('admin_adjust', meta);
}

function expectedShareAmount(userOverwall: number, networkOverwall: number, blockReward: number): number {
  if (networkOverwall <= 0 || userOverwall <= 0 || blockReward <= 0) return 0;
  const raw = (userOverwall / networkOverwall) * blockReward;
  return Math.floor(raw * 1e8) / 1e8;
}

function blocksPerDay(intervalMin: number): number {
  return (24 * 60) / Math.max(1, intervalMin);
}

function maxAlertLevel(levels: AdminRoiAlertLevel[]): AdminRoiAlertLevel {
  if (levels.includes('critical')) return 'critical';
  if (levels.includes('warning')) return 'warning';
  return 'ok';
}

/** Uma auditoria por vez. O painel reabre a tela a cada 30s e cada chamada segura várias conexões. */
let platformRoiFlight: Promise<AdminPlatformRoiDTO> | null = null;
const usersRoiFlights = new Map<string, Promise<{ users: AdminUserRoiListItemDTO[]; total: number; nextOffset?: number }>>();

export class AdminRoiService {
  constructor(private readonly prisma: PrismaClient) {}

  async getUserRoi(userId: string): Promise<AdminUserRoiDTO> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        email: true,
        mgtBalance: { select: { usdcAmount: true, usdtAmount: true } },
      },
    });
    if (!user) throw new AppError(ErrorCode.USER_NOT_FOUND, 404);

    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const auditSince = getRoiAuditSince();
    const sinceLabel = formatAuditSinceBr(auditSince);

    const [
      cfg,
      miningBalance,
      mgtRows,
      mgtRowsSince,
      walletDeposits,
      walletWithdrawals,
      miningRewards,
      miningRewards24h,
      miningLedgerAgg,
      miningRewardAgg,
    ] = await Promise.all([
      this.prisma.platformConfig.findUnique({ where: { id: 'default' } }),
      this.prisma.miningBalance.findUnique({ where: { userId } }),
      this.prisma.mGTTransaction.findMany({
        where: { userId },
        select: { type: true, amount: true, meta: true, createdAt: true },
      }),
      this.prisma.mGTTransaction.findMany({
        where: { userId, createdAt: { gte: auditSince } },
        select: { type: true, amount: true, meta: true },
      }),
      this.prisma.walletTransaction.aggregate({
        where: { userId, type: 'usdc_deposit', status: 'confirmed' },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.walletTransaction.aggregate({
        where: { userId, type: 'usdc_withdraw', status: 'confirmed' },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.miningReward.findMany({
        where: { userId, createdAt: { gte: auditSince }, currency: 'usdt' },
        orderBy: { createdAt: 'desc' },
        take: 30,
        include: { block: true },
      }),
      this.prisma.miningReward.findMany({
        where: { userId, createdAt: { gte: since24h }, currency: 'usdt' },
        include: { block: true },
      }),
      this.prisma.mGTTransaction.aggregate({
        where: { userId, type: MINING_TYPE, createdAt: { gte: auditSince }, meta: { path: ['currency'], equals: 'usdt' } },
        _sum: { amount: true },
      }),
      this.prisma.miningReward.aggregate({
        where: { userId, createdAt: { gte: auditSince }, currency: 'usdt' },
        _sum: { amountUsdc: true },
        _count: true,
      }),
    ]);

    const platform = cfg ?? (await this.prisma.platformConfig.upsert({
      where: { id: 'default' },
      update: {},
      create: { id: 'default' },
    }));

    const intervalMin = platform.miningBlockIntervalMin;
    const blockReward = Number(platform.miningBlockRewardUsdc);
    const perDay = blocksPerDay(intervalMin);

    let ledgerUsdcSum = 0;
    let depositsUsdc = 0;
    let depositCount = 0;
    let adminCreditsUsdc = 0;
    let adminCreditCount = 0;
    let adminDebitsUsdc = 0;
    let adminDebitCount = 0;
    let withdrawalsUsdc = 0;
    let withdrawalCount = 0;
    let otherCreditsUsdc = 0;
    let otherDebitsUsdc = 0;

    // Capital (depósitos/saques/admin) continua all-time — é a posição real de aportação.
    for (const row of mgtRows) {
      const amount = Number(row.amount);
      const meta = row.meta;
      if (!isUsdcLedgerRow(row.type, meta)) continue;

      if (row.type === 'usdc_deposit' && amount > 0) {
        depositsUsdc += amount;
        depositCount++;
      } else if (row.type === 'usdc_withdraw' && amount < 0) {
        withdrawalsUsdc += Math.abs(amount);
        withdrawalCount++;
      } else if (row.type === 'admin_adjust') {
        if (amount > 0) {
          adminCreditsUsdc += amount;
          adminCreditCount++;
        } else if (amount < 0) {
          adminDebitsUsdc += Math.abs(amount);
          adminDebitCount++;
        }
      } else if (row.type === MINING_TYPE) {
        // counted separately
      } else if (amount > 0) {
        otherCreditsUsdc += amount;
      } else if (amount < 0) {
        otherDebitsUsdc += Math.abs(amount);
      }
    }

    // Extrato USDC só no período de auditoria (evita lixo antigo na comparação).
    for (const row of mgtRowsSince) {
      const amount = Number(row.amount);
      if (!isUsdcLedgerRow(row.type, row.meta)) continue;
      ledgerUsdcSum += amount;
    }

    // Cross-check deposits with wallet ledger (informational — MGT is source of truth)
    const walletDepVol = Math.abs(Number(walletDeposits._sum.amount ?? 0));
    const walletWdVol = Math.abs(Number(walletWithdrawals._sum.amount ?? 0));
    if (walletDepVol > depositsUsdc + DRIFT_TOLERANCE) {
      depositsUsdc = walletDepVol;
      depositCount = walletDeposits._count;
    }
    if (walletWdVol > withdrawalsUsdc + DRIFT_TOLERANCE) {
      withdrawalsUsdc = walletWdVol;
      withdrawalCount = walletWithdrawals._count;
    }

    const netCapitalIn = roundUsdc(
      depositsUsdc + adminCreditsUsdc - withdrawalsUsdc - adminDebitsUsdc,
    );

    const totalPaidUsdc = roundUsdc(Number(miningRewardAgg._sum.amountUsdc ?? 0));
    const totalLedgerUsdc = roundUsdc(Number(miningLedgerAgg._sum.amount ?? 0));
    const ledgerVsRewardDrift = roundUsdc(totalLedgerUsdc - totalPaidUsdc);

    const allRewardsForPool = await this.prisma.miningReward.findMany({
      where: { userId, createdAt: { gte: auditSince }, currency: 'usdt' },
      select: {
        overwallSnapshot: true,
        block: { select: { rewardUsdc: true, totalOverwall: true } },
      },
    });

    let expectedFromShare = 0;
    for (const r of allRewardsForPool) {
      const network = Number(r.block.totalOverwall);
      const blockRewardVal = Number(r.block.rewardUsdc);
      expectedFromShare += expectedShareAmount(r.overwallSnapshot, network, blockRewardVal);
    }
    const shareVsPaidDriftUsdc = roundUsdc(totalPaidUsdc - expectedFromShare);

    const last24hUsdc = roundUsdc(
      miningRewards24h.reduce((s, r) => s + Number(r.amountUsdc), 0),
    );
    const last24hBlocks = new Set(miningRewards24h.map((r) => r.blockId)).size;

    const blocksParticipated = miningRewardAgg._count;
    const avgPerBlockUsdc =
      blocksParticipated > 0 ? roundUsdc(totalPaidUsdc / blocksParticipated) : 0;

    const currentUsdc = Number(user.mgtBalance?.usdcAmount ?? 0);
    const currentUsdt = Number(user.mgtBalance?.usdtAmount ?? 0);
    // drift vs extrato do período (não vs saldo total — saldo é all-time)
    const ledgerDrift = roundUsdc(totalLedgerUsdc - totalPaidUsdc);

    const recentBlocks: AdminUserRoiBlockRowDTO[] = miningRewards.map((r) => {
      const networkOverwall = Number(r.block.totalOverwall);
      const blockRewardUsdc = Number(r.block.rewardUsdc);
      const paidUsdc = Number(r.amountUsdc);
      const expectedUsdc = expectedShareAmount(r.overwallSnapshot, networkOverwall, blockRewardUsdc);
      const sharePct =
        networkOverwall > 0 ? (r.overwallSnapshot / networkOverwall) * 100 : 0;
      return {
        blockNumber: Number(r.block.blockNumber),
        minedAt: r.createdAt.toISOString(),
        userOverwall: r.overwallSnapshot,
        networkOverwall,
        sharePct: roundUsdc(sharePct),
        blockRewardUsdc,
        expectedUsdc,
        paidUsdc,
        driftUsdc: roundUsdc(paidUsdc - expectedUsdc),
      };
    });

    const sharePctLatest =
      recentBlocks[0]?.sharePct ??
      (miningRewards[0]
        ? (miningRewards[0].overwallSnapshot / Math.max(1, Number(miningRewards[0].block.totalOverwall))) *
          100
        : 0);
    const estimatedDailyUsdc = roundUsdc((sharePctLatest / 100) * blockReward * perDay);

    const alerts: string[] = [];
    let alertLevel: AdminRoiAlertLevel = 'ok';

    // Extrato vs blocos no período (não compara carteira all-time com extrato legado).
    if (Math.abs(ledgerVsRewardDrift) > 0.5) {
      const gap = Math.abs(ledgerVsRewardDrift);
      alerts.push(
        ledgerVsRewardDrift < 0
          ? `Desde ${sinceLabel}: blocos pagaram ${totalPaidUsdc.toFixed(2)} USDC, mas o extrato (mining_claim) só tem ${totalLedgerUsdc.toFixed(2)} (faltam ~${gap.toFixed(2)}).`
          : `Desde ${sinceLabel}: extrato tem ${gap.toFixed(2)} USDC a mais que a soma dos blocos.`,
      );
      alertLevel = maxAlertLevel([alertLevel, 'warning']);
    }
    if (shareVsPaidDriftUsdc > DRIFT_TOLERANCE) {
      alerts.push(
        `Desde ${sinceLabel}: patrocínios pagos (${totalPaidUsdc.toFixed(4)}) acima da fatia esperada por overwall (${expectedFromShare.toFixed(4)}) em ${shareVsPaidDriftUsdc.toFixed(4)} USDC`,
      );
      alertLevel = maxAlertLevel([alertLevel, 'warning']);
    }
    if (last24hUsdc > blockReward * last24hBlocks * 1.01 && last24hBlocks > 0) {
      alerts.push(
        `Últimas 24h: recebido ${last24hUsdc.toFixed(4)} USDC em ${last24hBlocks} blocos — acima do pool configurado (${(blockReward * last24hBlocks).toFixed(4)} USDC)`,
      );
      alertLevel = maxAlertLevel([alertLevel, 'warning']);
    }
    // Só alerta "sem capital" se no período novo ganhou patrocínio E não tem saldo nem capital.
    if (
      netCapitalIn <= DRIFT_TOLERANCE &&
      currentUsdc <= DRIFT_TOLERANCE &&
      currentUsdt <= DRIFT_TOLERANCE &&
      totalPaidUsdc > DRIFT_TOLERANCE
    ) {
      alerts.push(
        `Desde ${sinceLabel}: usuário recebeu patrocínios sem capital depositado e sem saldo USDC (depósitos + ajustes admin − saques).`,
      );
      alertLevel = maxAlertLevel([alertLevel, 'warning']);
    }

    const percentOnCapital =
      netCapitalIn > DRIFT_TOLERANCE ? roundUsdc((totalPaidUsdc / netCapitalIn) * 100) : null;
    const dailyPercentOnCapital =
      netCapitalIn > DRIFT_TOLERANCE ? roundUsdc((last24hUsdc / netCapitalIn) * 100) : null;

    return {
      userId: user.id,
      username: user.username,
      email: user.email,
      config: {
        miningBlockRewardUsdc: blockReward,
        miningBlockIntervalMin: intervalMin,
        miningPaused: platform.miningPaused,
      },
      balances: {
        currentUsdc: roundUsdc(currentUsdc),
        currentUsdt: roundUsdc(currentUsdt),
        ledgerUsdcSum: roundUsdc(ledgerUsdcSum),
        driftUsdc: ledgerDrift,
      },
      capital: {
        depositsUsdc: roundUsdc(depositsUsdc),
        depositCount,
        adminCreditsUsdc: roundUsdc(adminCreditsUsdc),
        adminCreditCount,
        adminDebitsUsdc: roundUsdc(adminDebitsUsdc),
        adminDebitCount,
        withdrawalsUsdc: roundUsdc(withdrawalsUsdc),
        withdrawalCount,
        netCapitalIn,
      },
      mining: {
        blocksParticipated,
        totalPaidUsdc,
        totalLedgerUsdc,
        ledgerVsRewardDriftUsdc: ledgerVsRewardDrift,
        expectedShareUsdc: roundUsdc(expectedFromShare),
        shareVsPaidDriftUsdc,
        lifetimeEarnedUsdc: roundUsdc(Number(miningBalance?.lifetimeEarned ?? 0)),
        avgPerBlockUsdc,
        last24hUsdc,
        last24hBlocks,
        blocksPerDay: roundUsdc(perDay),
        estimatedDailyUsdc,
      },
      flows: {
        otherCreditsUsdc: roundUsdc(otherCreditsUsdc),
        otherDebitsUsdc: roundUsdc(otherDebitsUsdc),
        netGameFlowUsdc: roundUsdc(otherCreditsUsdc - otherDebitsUsdc),
      },
      roi: {
        percentOnCapital,
        dailyPercentOnCapital,
        alertLevel,
        alerts,
      },
      recentBlocks,
    };
  }

  getPlatformRoi(): Promise<AdminPlatformRoiDTO> {
    if (platformRoiFlight) return platformRoiFlight;
    platformRoiFlight = this.computePlatformRoi().finally(() => {
      platformRoiFlight = null;
    });
    return platformRoiFlight;
  }

  private async computePlatformRoi(): Promise<AdminPlatformRoiDTO> {
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const auditSince = getRoiAuditSince();

    const cfg = await this.prisma.platformConfig.upsert({
      where: { id: 'default' },
      update: {},
      create: { id: 'default' },
    });

    const intervalMin = cfg.miningBlockIntervalMin;
    const blockReward = Number(cfg.miningBlockRewardUsdc);
    const perDay = blocksPerDay(intervalMin);

    const [
      blockAgg,
      rewardAgg,
      ledgerMiningAgg,
      blocks24h,
      rewards24h,
      depositAgg,
      withdrawAgg,
      adminCredits,
    ] = await Promise.all([
      this.prisma.miningBlock.aggregate({
        where: { minedAt: { gte: auditSince } },
        _sum: { rewardUsdc: true },
        _count: true,
      }),
      this.prisma.miningReward.aggregate({
        where: { createdAt: { gte: auditSince }, currency: 'usdt' },
        _sum: { amountUsdc: true },
      }),
      this.prisma.mGTTransaction.aggregate({
        where: { type: MINING_TYPE, createdAt: { gte: auditSince }, meta: { path: ['currency'], equals: 'usdt' } },
        _sum: { amount: true },
      }),
      this.prisma.miningBlock.findMany({
        where: { minedAt: { gte: since24h } },
        select: { id: true, rewardUsdc: true },
      }),
      this.prisma.miningReward.aggregate({
        where: { createdAt: { gte: since24h }, currency: 'usdt' },
        _sum: { amountUsdc: true },
      }),
      this.prisma.mGTTransaction.aggregate({
        where: { type: 'usdc_deposit' },
        _sum: { amount: true },
      }),
      this.prisma.mGTTransaction.aggregate({
        where: { type: 'usdc_withdraw' },
        _sum: { amount: true },
      }),
      this.prisma.mGTTransaction.findMany({
        where: { type: 'admin_adjust' },
        select: { amount: true, meta: true },
      }),
    ]);

    let totalAdminCreditsUsdc = 0;
    let totalAdminDebitsUsdc = 0;
    for (const row of adminCredits) {
      if (!isUsdcAdminAdjust(row.meta)) continue;
      const amount = Number(row.amount);
      if (amount > 0) totalAdminCreditsUsdc += amount;
      else if (amount < 0) totalAdminDebitsUsdc += Math.abs(amount);
    }

    const configuredPoolUsdc = roundUsdc(Number(blockAgg._sum.rewardUsdc ?? 0));
    const historicalPoolUsdc = configuredPoolUsdc;
    const distributedUsdc = roundUsdc(Number(rewardAgg._sum.amountUsdc ?? 0));
    const ledgerMiningUsdc = roundUsdc(Number(ledgerMiningAgg._sum.amount ?? 0));
    const poolVsDistributedDrift = roundUsdc(distributedUsdc - configuredPoolUsdc);
    const ledgerVsDistributedDrift = roundUsdc(ledgerMiningUsdc - distributedUsdc);

    const last24hRecordedPoolUsdc = roundUsdc(
      blocks24h.reduce((s, b) => s + Number(b.rewardUsdc), 0),
    );
    const last24hDistributedUsdc = roundUsdc(Number(rewards24h._sum.amountUsdc ?? 0));
    const last24hDrift = roundUsdc(last24hDistributedUsdc - last24hRecordedPoolUsdc);
    const last24hExpectedPoolAtCurrentRateUsdc = roundUsdc(blocks24h.length * blockReward);
    const last24hConfigDrift = roundUsdc(last24hRecordedPoolUsdc - last24hExpectedPoolAtCurrentRateUsdc);
    const rateEpsilon = Math.max(0.000001, blockReward * 0.001);
    const last24hLegacyBlockCount = blocks24h.filter(
      (b) => Math.abs(Number(b.rewardUsdc) - blockReward) > rateEpsilon,
    ).length;
    const last24hAvgBlockRewardUsdc =
      blocks24h.length > 0 ? roundUsdc(last24hRecordedPoolUsdc / blocks24h.length) : blockReward;

    const totalDepositsUsdc = roundUsdc(Number(depositAgg._sum.amount ?? 0));
    const totalWithdrawalsUsdc = roundUsdc(Math.abs(Number(withdrawAgg._sum.amount ?? 0)));
    const netCapitalInUsdc = roundUsdc(
      totalDepositsUsdc + totalAdminCreditsUsdc - totalWithdrawalsUsdc - totalAdminDebitsUsdc,
    );

    const alerts: string[] = [];
    const auditChecks: AdminRoiAuditCheckDTO[] = [];
    let alertLevel: AdminRoiAlertLevel = 'ok';
    const sinceLabel = formatAuditSinceBr(auditSince);

    auditChecks.push({
      id: 'audit_window',
      level: 'ok',
      title: `Janela de auditoria (desde ${sinceLabel})`,
      detail: `Pool, extrato e divergências de patrocínios só contam a partir de ${sinceLabel} 00:00 (horário de Brasília). Dados anteriores foram descartados desta tela de propósito.`,
    });

    auditChecks.push({
      id: 'config',
      level: 'ok',
      title: 'Cota por rodada (Carteira)',
      detail: `${blockReward.toFixed(4)} USDC a cada ${intervalMin} min · pool diário ${roundUsdc(blockReward * perDay).toFixed(4)} USDC · ${cfg.miningPaused ? 'patrocínios pausados' : 'patrocínios ativos'}`,
    });

    auditChecks.push({
      id: 'distribution_24h',
      level:
        Math.abs(last24hDrift) > 0.05
          ? poolDriftSeverity(last24hDrift, last24hRecordedPoolUsdc)
          : 'ok',
      title: 'Distribuição últimas 24h',
      detail: `${blocks24h.length} rodadas · ${last24hDistributedUsdc.toFixed(4)} USDC pagos · pool esperado (cota atual) ${last24hExpectedPoolAtCurrentRateUsdc.toFixed(4)} USDC`,
    });

    if (last24hLegacyBlockCount > 0) {
      auditChecks.push({
        id: 'legacy_rate',
        level: 'warning',
        title: 'Rodadas com cota antiga (24h)',
        detail: `${last24hLegacyBlockCount} de ${blocks24h.length} blocos gravaram cota diferente de ${blockReward.toFixed(4)} USDC. Média registrada: ${last24hAvgBlockRewardUsdc.toFixed(4)}. Normal após mudar a cota em Carteira — novas rodadas já usam ${blockReward.toFixed(4)}.`,
      });
    }

    const poolDriftLevel = poolDriftSeverity(poolVsDistributedDrift, configuredPoolUsdc);
    if (poolVsDistributedDrift > DRIFT_TOLERANCE && poolDriftLevel !== 'ok') {
      auditChecks.push({
        id: 'pool_historical',
        level: poolDriftLevel,
        title: `Over-distribution (desde ${sinceLabel})`,
        detail: `Pago ${distributedUsdc.toFixed(2)} USDC acima do pool registrado nos blocos (${configuredPoolUsdc.toFixed(2)} USDC). Δ +${poolVsDistributedDrift.toFixed(4)} USDC.`,
      });
    }

    const ledgerDriftLevel = ledgerDriftSeverity(ledgerVsDistributedDrift);
    if (Math.abs(ledgerVsDistributedDrift) > 0.5) {
      const gap = Math.abs(ledgerVsDistributedDrift);
      auditChecks.push({
        id: 'ledger',
        level: ledgerDriftLevel,
        title: `Extrato vs blocos (desde ${sinceLabel})`,
        detail:
          ledgerVsDistributedDrift < 0
            ? `Os blocos dizem que foram pagos ${distributedUsdc.toFixed(2)} USDC, mas no extrato (mining_claim) só aparece ${ledgerMiningUsdc.toFixed(2)} — faltam ~${gap.toFixed(2)} USDC neste período.`
            : `O extrato tem ${gap.toFixed(2)} USDC a mais que a soma dos blocos neste período.`,
      });
    }

    for (const check of auditChecks) {
      if (check.level !== 'ok') {
        alerts.push(`${check.title}: ${check.detail}`);
        alertLevel = maxAlertLevel([alertLevel, check.level]);
      }
    }

    if (cfg.miningPaused) {
      const pausedCheck: AdminRoiAuditCheckDTO = {
        id: 'paused',
        level: 'warning',
        title: 'Patrocínios pausados',
        detail: 'Mining pausado na configuração da plataforma (Carteira).',
      };
      auditChecks.push(pausedCheck);
      alerts.push(`${pausedCheck.title}: ${pausedCheck.detail}`);
      alertLevel = maxAlertLevel([alertLevel, 'warning']);
    }

    const topDrifts = await this.findTopUserDrifts(auditSince);

    const [minersRow, depositorsCount] = await Promise.all([
      this.prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(DISTINCT "userId")::bigint AS count FROM "MiningReward"
        WHERE "createdAt" >= ${auditSince}
      `,
      this.prisma.user.count({ where: DEPOSITOR_OR }),
    ]);

    const minersCount = Number(minersRow[0]?.count ?? 0);
    const percentOnCapital =
      netCapitalInUsdc > DRIFT_TOLERANCE
        ? roundUsdc((distributedUsdc / netCapitalInUsdc) * 100)
        : null;
    const dailyPercentOnCapital =
      netCapitalInUsdc > DRIFT_TOLERANCE
        ? roundUsdc((last24hDistributedUsdc / netCapitalInUsdc) * 100)
        : null;
    const payoutVsPoolPercent =
      historicalPoolUsdc > DRIFT_TOLERANCE
        ? roundUsdc((distributedUsdc / historicalPoolUsdc) * 100)
        : null;

    return {
      auditSinceAt: auditSince.toISOString(),
      config: {
        miningBlockRewardUsdc: blockReward,
        miningBlockIntervalMin: intervalMin,
        miningPaused: cfg.miningPaused,
        blocksPerDay: roundUsdc(perDay),
        expectedDailyPoolUsdc: roundUsdc(blockReward * perDay),
        last24hAvgBlockRewardUsdc,
        last24hExpectedPoolAtCurrentRateUsdc,
        last24hLegacyBlockCount,
      },
      totals: {
        blockCount: blockAgg._count,
        historicalPoolUsdc,
        distributedUsdc,
        ledgerMiningUsdc,
        poolVsDistributedDriftUsdc: poolVsDistributedDrift,
        ledgerVsDistributedDriftUsdc: ledgerVsDistributedDrift,
        last24hBlocks: blocks24h.length,
        last24hRecordedPoolUsdc,
        last24hDistributedUsdc,
        last24hDriftUsdc: last24hDrift,
        last24hConfigDriftUsdc: last24hConfigDrift,
      },
      capital: {
        totalDepositsUsdc,
        totalAdminCreditsUsdc: roundUsdc(totalAdminCreditsUsdc),
        totalWithdrawalsUsdc,
        totalAdminDebitsUsdc: roundUsdc(totalAdminDebitsUsdc),
        netCapitalInUsdc,
      },
      roi: {
        percentOnCapital,
        dailyPercentOnCapital,
        payoutVsPoolPercent,
        minersCount,
        depositorsCount,
      },
      alertLevel,
      alerts,
      auditChecks,
      topDrifts,
    };
  }

  listUsersRoi(opts: {
    search?: string;
    limit: number;
    offset: number;
    sort?: AdminRoiUserSort;
  }): Promise<{ users: AdminUserRoiListItemDTO[]; total: number; nextOffset?: number }> {
    const key = `${opts.search ?? ''}|${opts.limit}|${opts.offset}|${opts.sort ?? 'mining_desc'}`;
    const existing = usersRoiFlights.get(key);
    if (existing) return existing;
    const flight = this.computeListUsersRoi(opts).finally(() => {
      usersRoiFlights.delete(key);
    });
    usersRoiFlights.set(key, flight);
    return flight;
  }

  private async computeListUsersRoi(opts: {
    search?: string;
    limit: number;
    offset: number;
    sort?: AdminRoiUserSort;
  }): Promise<{ users: AdminUserRoiListItemDTO[]; total: number; nextOffset?: number }> {
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const auditSince = getRoiAuditSince();
    const limit = Math.min(Math.max(1, opts.limit), 100);
    const offset = Math.max(0, opts.offset);
    const sort = opts.sort ?? 'mining_desc';
    const search = opts.search?.trim() ?? '';
    const pattern = search ? `%${search}%` : null;

    type Row = {
      id: string;
      username: string | null;
      email: string | null;
      current_usdc: Prisma.Decimal;
      current_usdt: Prisma.Decimal;
      net_capital: Prisma.Decimal;
      paid: Prisma.Decimal;
      paid_24h: Prisma.Decimal;
      roi_ratio: Prisma.Decimal;
    };

    const orderBy = roiSortClause(sort);

    const rows = pattern
      ? await this.prisma.$queryRaw<Row[]>`
          WITH capital AS (
            SELECT t."userId",
              COALESCE(SUM(CASE WHEN t.type = 'usdc_deposit' THEN t.amount ELSE 0 END), 0) AS deposits,
              COALESCE(SUM(CASE WHEN t.type = 'usdc_withdraw' THEN ABS(t.amount) ELSE 0 END), 0) AS withdrawals,
              COALESCE(SUM(CASE WHEN t.type = 'admin_adjust' AND t.meta->>'currency' = 'usdc' AND t.amount > 0 THEN t.amount ELSE 0 END), 0) AS admin_cr,
              COALESCE(SUM(CASE WHEN t.type = 'admin_adjust' AND t.meta->>'currency' = 'usdc' AND t.amount < 0 THEN ABS(t.amount) ELSE 0 END), 0) AS admin_db
            FROM "MGTTransaction" t
            WHERE t.type IN ('usdc_deposit', 'usdc_withdraw', 'admin_adjust')
            GROUP BY t."userId"
          ),
          mining AS (
            SELECT mr."userId",
              COALESCE(SUM(CASE WHEN mr."createdAt" >= ${auditSince} THEN mr."amountUsdc" ELSE 0 END), 0) AS paid,
              COALESCE(SUM(CASE WHEN mr."createdAt" >= ${since24h} THEN mr."amountUsdc" ELSE 0 END), 0) AS paid_24h
            FROM "MiningReward" mr
            WHERE mr.currency = 'usdt' AND mr."createdAt" >= ${auditSince}
            GROUP BY mr."userId"
          )
          SELECT u.id, u.username, u.email,
            COALESCE(b."usdcAmount", 0) AS current_usdc,
            COALESCE(b."usdtAmount", 0) AS current_usdt,
            (COALESCE(c.deposits, 0) + COALESCE(c.admin_cr, 0) - COALESCE(c.withdrawals, 0) - COALESCE(c.admin_db, 0)) AS net_capital,
            COALESCE(m.paid, 0) AS paid,
            COALESCE(m.paid_24h, 0) AS paid_24h,
            CASE WHEN (COALESCE(c.deposits, 0) + COALESCE(c.admin_cr, 0) - COALESCE(c.withdrawals, 0) - COALESCE(c.admin_db, 0)) > 0.02
              THEN COALESCE(m.paid, 0) / (COALESCE(c.deposits, 0) + COALESCE(c.admin_cr, 0) - COALESCE(c.withdrawals, 0) - COALESCE(c.admin_db, 0))
              ELSE 0 END AS roi_ratio
          FROM "User" u
          LEFT JOIN "MGTBalance" b ON b."userId" = u.id
          LEFT JOIN capital c ON c."userId" = u.id
          LEFT JOIN mining m ON m."userId" = u.id
          WHERE (
            u.email ILIKE ${pattern}
            OR u.username ILIKE ${pattern}
            OR u.wallet ILIKE ${pattern}
            OR u."referralCode" ILIKE ${pattern}
            OR u.id::text ILIKE ${pattern}
          )
          ORDER BY ${Prisma.raw(orderBy)}
          LIMIT ${limit} OFFSET ${offset}
        `
      : await this.prisma.$queryRaw<Row[]>`
          WITH capital AS (
            SELECT t."userId",
              COALESCE(SUM(CASE WHEN t.type = 'usdc_deposit' THEN t.amount ELSE 0 END), 0) AS deposits,
              COALESCE(SUM(CASE WHEN t.type = 'usdc_withdraw' THEN ABS(t.amount) ELSE 0 END), 0) AS withdrawals,
              COALESCE(SUM(CASE WHEN t.type = 'admin_adjust' AND t.meta->>'currency' = 'usdc' AND t.amount > 0 THEN t.amount ELSE 0 END), 0) AS admin_cr,
              COALESCE(SUM(CASE WHEN t.type = 'admin_adjust' AND t.meta->>'currency' = 'usdc' AND t.amount < 0 THEN ABS(t.amount) ELSE 0 END), 0) AS admin_db
            FROM "MGTTransaction" t
            WHERE t.type IN ('usdc_deposit', 'usdc_withdraw', 'admin_adjust')
            GROUP BY t."userId"
          ),
          mining AS (
            SELECT mr."userId",
              COALESCE(SUM(CASE WHEN mr."createdAt" >= ${auditSince} THEN mr."amountUsdc" ELSE 0 END), 0) AS paid,
              COALESCE(SUM(CASE WHEN mr."createdAt" >= ${since24h} THEN mr."amountUsdc" ELSE 0 END), 0) AS paid_24h
            FROM "MiningReward" mr
            WHERE mr.currency = 'usdt' AND mr."createdAt" >= ${auditSince}
            GROUP BY mr."userId"
          )
          SELECT u.id, u.username, u.email,
            COALESCE(b."usdcAmount", 0) AS current_usdc,
            COALESCE(b."usdtAmount", 0) AS current_usdt,
            (COALESCE(c.deposits, 0) + COALESCE(c.admin_cr, 0) - COALESCE(c.withdrawals, 0) - COALESCE(c.admin_db, 0)) AS net_capital,
            COALESCE(m.paid, 0) AS paid,
            COALESCE(m.paid_24h, 0) AS paid_24h,
            CASE WHEN (COALESCE(c.deposits, 0) + COALESCE(c.admin_cr, 0) - COALESCE(c.withdrawals, 0) - COALESCE(c.admin_db, 0)) > 0.02
              THEN COALESCE(m.paid, 0) / (COALESCE(c.deposits, 0) + COALESCE(c.admin_cr, 0) - COALESCE(c.withdrawals, 0) - COALESCE(c.admin_db, 0))
              ELSE 0 END AS roi_ratio
          FROM "User" u
          LEFT JOIN "MGTBalance" b ON b."userId" = u.id
          LEFT JOIN capital c ON c."userId" = u.id
          LEFT JOIN mining m ON m."userId" = u.id
          WHERE COALESCE(m.paid, 0) > 0.001
             OR (COALESCE(c.deposits, 0) + COALESCE(c.admin_cr, 0) - COALESCE(c.withdrawals, 0) - COALESCE(c.admin_db, 0)) > 0.02
          ORDER BY ${Prisma.raw(orderBy)}
          LIMIT ${limit} OFFSET ${offset}
        `;

    const countRows = pattern
      ? await this.prisma.$queryRaw<[{ count: bigint }]>`
          SELECT COUNT(*)::bigint AS count FROM "User" u
          WHERE (
            u.email ILIKE ${pattern}
            OR u.username ILIKE ${pattern}
            OR u.wallet ILIKE ${pattern}
            OR u."referralCode" ILIKE ${pattern}
            OR u.id::text ILIKE ${pattern}
          )
        `
      : await this.prisma.$queryRaw<[{ count: bigint }]>`
          WITH capital AS (
            SELECT t."userId",
              COALESCE(SUM(CASE WHEN t.type = 'usdc_deposit' THEN t.amount ELSE 0 END), 0) AS deposits,
              COALESCE(SUM(CASE WHEN t.type = 'admin_adjust' AND t.meta->>'currency' = 'usdc' AND t.amount > 0 THEN t.amount ELSE 0 END), 0) AS admin_cr,
              COALESCE(SUM(CASE WHEN t.type = 'usdc_withdraw' THEN ABS(t.amount) ELSE 0 END), 0) AS withdrawals,
              COALESCE(SUM(CASE WHEN t.type = 'admin_adjust' AND t.meta->>'currency' = 'usdc' AND t.amount < 0 THEN ABS(t.amount) ELSE 0 END), 0) AS admin_db
            FROM "MGTTransaction" t
            WHERE t.type IN ('usdc_deposit', 'usdc_withdraw', 'admin_adjust')
            GROUP BY t."userId"
          ),
          mining AS (
            SELECT mr."userId",
              COALESCE(SUM(mr."amountUsdc"), 0) AS paid
            FROM "MiningReward" mr
            WHERE mr.currency = 'usdt' AND mr."createdAt" >= ${auditSince}
            GROUP BY mr."userId"
          )
          SELECT COUNT(*)::bigint AS count FROM "User" u
          LEFT JOIN capital c ON c."userId" = u.id
          LEFT JOIN mining m ON m."userId" = u.id
          WHERE COALESCE(m.paid, 0) > 0.001
             OR (COALESCE(c.deposits, 0) + COALESCE(c.admin_cr, 0) - COALESCE(c.withdrawals, 0) - COALESCE(c.admin_db, 0)) > 0.02
        `;

    const total = Number(countRows[0]?.count ?? 0);

    const users: AdminUserRoiListItemDTO[] = rows.map((r) => {
      const netCapitalIn = roundUsdc(Number(r.net_capital));
      const totalPaidUsdc = roundUsdc(Number(r.paid));
      const last24hUsdc = roundUsdc(Number(r.paid_24h));
      const currentUsdc = roundUsdc(Number(r.current_usdc));
      const currentUsdt = roundUsdc(Number(r.current_usdt));
      const roiPercent =
        netCapitalIn > DRIFT_TOLERANCE ? roundUsdc((totalPaidUsdc / netCapitalIn) * 100) : null;
      const dailyRoiPercent =
        netCapitalIn > DRIFT_TOLERANCE ? roundUsdc((last24hUsdc / netCapitalIn) * 100) : null;

      return {
        userId: r.id,
        username: r.username,
        email: r.email,
        netCapitalIn,
        totalPaidUsdc,
        last24hUsdc,
        currentUsdc,
        currentUsdt,
        roiPercent,
        dailyRoiPercent,
        alertLevel: listItemAlert(netCapitalIn, totalPaidUsdc, currentUsdc + currentUsdt),
      };
    });

    const nextOffset = offset + limit < total ? offset + limit : undefined;
    return { users, total, nextOffset };
  }

  private async findTopUserDrifts(auditSince: Date): Promise<AdminPlatformRoiUserAlertDTO[]> {
    const rows = await this.prisma.$queryRaw<
      Array<{ userId: string; paid: Prisma.Decimal; ledger: Prisma.Decimal }>
    >`
      WITH paid AS (
        SELECT mr."userId" AS "userId",
               COALESCE(SUM(mr."amountUsdc"), 0) AS paid
        FROM "MiningReward" mr
        WHERE mr."createdAt" >= ${auditSince} AND mr.currency = 'usdt'
        GROUP BY mr."userId"
      ),
      ledger AS (
        SELECT t."userId" AS "userId",
               COALESCE(SUM(t.amount), 0) AS ledger
        FROM "MGTTransaction" t
        WHERE t.type = 'mining_claim'
          AND t."createdAt" >= ${auditSince}
          AND t.meta->>'currency' = 'usdt'
        GROUP BY t."userId"
      )
      SELECT p."userId" AS "userId",
             p.paid AS paid,
             COALESCE(l.ledger, 0) AS ledger
      FROM paid p
      LEFT JOIN ledger l ON l."userId" = p."userId"
      WHERE ABS(COALESCE(l.ledger, 0) - p.paid) > ${DRIFT_TOLERANCE}
      ORDER BY ABS(COALESCE(l.ledger, 0) - p.paid) DESC
      LIMIT 10
    `;

    if (rows.length === 0) return [];

    const users = await this.prisma.user.findMany({
      where: { id: { in: rows.map((r) => r.userId) } },
      select: { id: true, username: true, email: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    return rows.map((r) => {
      const paid = Number(r.paid);
      const ledger = Number(r.ledger);
      const u = userMap.get(r.userId);
      return {
        userId: r.userId,
        username: u?.username ?? null,
        email: u?.email ?? null,
        driftUsdc: roundUsdc(ledger - paid),
        kind: 'ledger_vs_rewards' as const,
      };
    });
  }
}

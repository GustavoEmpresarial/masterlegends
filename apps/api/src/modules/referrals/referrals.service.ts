import { ReferralsRepository } from './referrals.repository.js';

export class ReferralsService {
  constructor(private readonly repo: ReferralsRepository) {}

  async getStats(referrerId: string) {
    const referrals = await this.repo.findByReferrerId(referrerId);
    return {
      totalReferrals: referrals.length,
      totalEarned: referrals.reduce((sum, r) => sum + Number(r.totalEarnedMGT), 0),
    };
  }

  async getDetails(referrerId: string) {
    const details = await this.repo.findDetailsByReferrerId(referrerId);
    const totalEarnedUsdc = details.referrals.reduce((s, r) => s + r.totalEarnedUsdc, 0);
    const totalDepositedUsdc = details.referrals.reduce((s, r) => s + r.totalDepositedUsdc, 0);
    return {
      bonusPct: details.bonusPct,
      totalReferrals: details.referrals.length,
      totalEarnedUsdc,
      totalDepositedUsdc,
      referrals: details.referrals,
      commissions: details.commissions,
    };
  }
}

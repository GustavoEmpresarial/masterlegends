import { PrismaClient, User } from '@prisma/client';


export class AuthRepository {
  constructor(readonly prisma: PrismaClient) {}

  findByEmailOrUsername(email: string, username: string) {
    return this.prisma.user.findFirst({
      where: {
        OR: [{ email: email.toLowerCase() }, { username: username.toLowerCase() }],
      },
    });
  }

  findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { club: true },
    });
  }

  findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: { club: true },
    });
  }

  findByReferralCode(code: string) {
    return this.prisma.user.findUnique({
      where: { referralCode: code.toUpperCase() },
    });
  }

  create(data: {
    email: string;
    username: string;
    password: string;
    referralCode: string;
    referredBy?: string;
  }): Promise<User> {
    return this.prisma.user.create({
      data: {
        email: data.email.toLowerCase(),
        username: data.username.toLowerCase(),
        password: data.password,
        referralCode: data.referralCode,
        referredBy: data.referredBy,
      },
    });
  }

  createReferral(referrerId: string, referredId: string) {
    return this.prisma.referral.create({
      data: { referrerId, referredId },
    });
  }

  setReferredBy(userId: string, referrerId: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { referredBy: referrerId },
    });
  }

  referrerIps(referrerId: string) {
    return this.prisma.userIpEvent.findMany({
      where: { userId: referrerId },
      select: { ip: true },
    });
  }

  parentReferrerId(userId: string) {
    return this.prisma.referral.findUnique({
      where: { referredId: userId },
      select: { referrerId: true },
    });
  }

  recordRejectedReferral(input: {
    referrerId: string;
    referredId: string;
    reason: string;
  }) {
    const at = new Date().toISOString();
    return this.prisma.referralCommission.create({
      data: {
        referrerId: input.referrerId,
        referredId: input.referredId,
        purchaseType: 'signup',
        purchaseRef: input.referredId,
        grossAmount: 0,
        rate: 0,
        commissionAmount: 0,
        currency: 'usdc',
        status: 'rejected',
        history: [{ at, status: 'rejected', reason: input.reason }],
      },
    });
  }

  findByUsername(username: string) {
    return this.prisma.user.findUnique({
      where: { username: username.toLowerCase() },
    });
  }

  updateUsername(userId: string, username: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { username: username.toLowerCase() },
    });
  }

  updatePassword(userId: string, hashed: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { password: hashed, failedLoginCount: 0, lockedUntil: null },
    });
  }

  markTutorialCompleted(userId: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { tutorialCompletedAt: new Date() },
    });
  }

  async bumpFailedLogins(userId: string, threshold: number, lockoutMin: number): Promise<void> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { failedLoginCount: { increment: 1 } },
      select: { failedLoginCount: true },
    });

    if (user.failedLoginCount >= threshold) {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          lockedUntil: new Date(Date.now() + lockoutMin * 60 * 1000),
          failedLoginCount: 0,
        },
      });
    }
  }

  clearFailedLogins(userId: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { failedLoginCount: 0, lockedUntil: null },
    });
  }

  findByWallet(wallet: string) {
    return this.prisma.user.findUnique({
      where: { wallet: wallet.toLowerCase() },
    });
  }

  updateWallet(userId: string, wallet: string | null) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { wallet },
    });
  }

  async createStarterPlayer(userId: string) {
    // Pega qualquer template ativo (rarity 0 = comum) definido pelo admin
    const template = await this.prisma.itemTemplate.findFirst({
      where: { active: true, rarity: 0 },
      orderBy: { createdAt: 'asc' },
    });

    return this.prisma.basePlayer.create({
      data: {
        userId,
        rarity: template?.rarity ?? 0,
        overwall: template?.overwall ?? 350,
        position: template?.position ?? 0,
        name: template?.name ?? null,
        imageUrl: template?.imageUrl ?? null,
        templateId: template?.id ?? null,
        listed: false,
      },
    });
  }

  async grantReferralRewardToReferrer(referrerId: string): Promise<void> {
    const cfg = await this.prisma.platformConfig.findUnique({ where: { id: 'default' } });

    const name = cfg?.referralNftName ?? 'Craque Indicação';
    const imageUrl = cfg?.referralNftImageUrl ?? null;
    const overwall = cfg?.referralNftOverwall ?? 100;
    const position = cfg?.referralNftPosition ?? 2;
    const durationDays = cfg?.referralNftDurationDays ?? 30;
    const expiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);

    await this.prisma.basePlayer.create({
      data: { userId: referrerId, rarity: 0, overwall, position, name, imageUrl, source: 'referral', listed: false, expiresAt },
    });
  }
}

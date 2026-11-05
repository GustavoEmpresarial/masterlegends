import { PrismaClient } from '@prisma/client';
import { AppError, ErrorCode } from '../../../common/lib/errors.js';
import { generatePlainToken, hashToken } from './hash.js';

const TTL_HOURS = 24;

export class EmailVerificationService {
  constructor(private readonly prisma: PrismaClient) {}

  async issue(userId: string): Promise<string> {
    const plain = generatePlainToken(32);
    const tokenHash = hashToken(plain);
    const expiresAt = new Date(Date.now() + TTL_HOURS * 60 * 60 * 1000);

    await this.prisma.emailVerificationToken.create({
      data: { userId, tokenHash, expiresAt },
    });

    return plain;
  }

  async consume(plain: string): Promise<{ userId: string }> {
    const tokenHash = hashToken(plain);
    const token = await this.prisma.emailVerificationToken.findUnique({
      where: { tokenHash },
    });

    if (!token || token.consumedAt || token.expiresAt < new Date()) {
      throw new AppError(ErrorCode.AUTH_VERIFY_TOKEN_INVALID, 400);
    }

    await this.prisma.$transaction([
      this.prisma.emailVerificationToken.update({
        where: { id: token.id },
        data: { consumedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: token.userId },
        data: { emailVerifiedAt: new Date() },
      }),
    ]);

    return { userId: token.userId };
  }
}

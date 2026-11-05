import { PrismaClient } from '@prisma/client';
import { AppError, ErrorCode } from '../../../common/lib/errors.js';
import { generatePlainToken, hashToken } from './hash.js';

const TTL_MIN = 30;

export class PasswordResetService {
  constructor(private readonly prisma: PrismaClient) {}

  async issue(userId: string, ip?: string): Promise<{ token: string; expiresAt: Date }> {
    const plain = generatePlainToken(32);
    const tokenHash = hashToken(plain);
    const expiresAt = new Date(Date.now() + TTL_MIN * 60 * 1000);

    await this.prisma.passwordResetToken.create({
      data: { userId, tokenHash, expiresAt, ip: ip ?? null },
    });

    return { token: plain, expiresAt };
  }

  async consume(plain: string): Promise<{ userId: string }> {
    const tokenHash = hashToken(plain);
    const token = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
    });

    if (!token || token.consumedAt || token.expiresAt < new Date()) {
      throw new AppError(ErrorCode.AUTH_RESET_TOKEN_INVALID, 400);
    }

    await this.prisma.passwordResetToken.update({
      where: { id: token.id },
      data: { consumedAt: new Date() },
    });

    return { userId: token.userId };
  }
}

export const PASSWORD_RESET_TTL_MIN = TTL_MIN;

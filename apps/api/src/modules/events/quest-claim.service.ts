import { Prisma, type PrismaClient } from '@prisma/client';
import { ErrorCode } from '@mll/shared';
import { AppError } from '../../common/lib/errors.js';
import { isWithinWindow, periodKeyFor } from './period.js';
import { ClubRepository } from '../club/club.repository.js';
import { StadiumRepository } from '../stadium/stadium.repository.js';
import { StaminaService } from '../stamina/stamina.service.js';
import { getStaminaRules } from '../stamina/stamina-rules.js';
import { VestiarioTemplateRepository } from '../vestiario/vestiario-template.repository.js';
import { grantQuestRewards } from './reward-grant.service.js';

export class QuestClaimService {
  constructor(private readonly prisma: PrismaClient) {}

  async claim(
    userId: string,
    questId: string,
    meta?: { ip?: string; userAgent?: string },
  ) {
    const now = new Date();
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { emailVerifiedAt: true },
    });
    if (!user) throw new AppError(ErrorCode.USER_NOT_FOUND, 404);

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        // Serialize claims for this quest so global/user caps cannot race.
        await tx.$executeRaw`
          SELECT id FROM "QuestDefinition" WHERE id = ${questId} FOR UPDATE
        `;

        const quest = await tx.questDefinition.findUnique({
          where: { id: questId },
          include: { campaign: true },
        });
        if (!quest) throw new AppError(ErrorCode.QUEST_NOT_FOUND, 404);
        if (!quest.active) throw new AppError(ErrorCode.QUEST_INACTIVE, 400);

        if (!isWithinWindow(quest.startsAt, quest.endsAt, now)) {
          throw new AppError(ErrorCode.QUEST_WINDOW_CLOSED, 400);
        }
        if (quest.campaign) {
          if (
            !quest.campaign.active ||
            !isWithinWindow(quest.campaign.startsAt, quest.campaign.endsAt, now)
          ) {
            throw new AppError(ErrorCode.QUEST_WINDOW_CLOSED, 400);
          }
        }

        if (quest.requireEmailVerified && !user.emailVerifiedAt) {
          throw new AppError(ErrorCode.AUTH_EMAIL_NOT_VERIFIED, 403);
        }

        const periodKey = periodKeyFor(quest.period, now);

        // Daily/weekly: maxClaimsPerUser applies per periodKey (recurring).
        // Achievement (none): lifetime cap across all claims.
        const userClaimCount = await tx.questClaim.count({
          where: {
            userId,
            questId,
            ...(quest.period !== 'none' ? { periodKey } : {}),
          },
        });
        if (userClaimCount >= quest.maxClaimsPerUser) {
          throw new AppError(ErrorCode.QUEST_CLAIM_CAP, 409, { scope: 'user' });
        }

        if (quest.maxGlobalClaims != null) {
          const globalCount = await tx.questClaim.count({ where: { questId } });
          if (globalCount >= quest.maxGlobalClaims) {
            throw new AppError(ErrorCode.QUEST_CLAIM_CAP, 409, { scope: 'global' });
          }
        }

        const progress = await tx.questProgress.findUnique({
          where: {
            userId_questId_periodKey: { userId, questId, periodKey },
          },
        });
        if (!progress || progress.count < quest.target) {
          throw new AppError(ErrorCode.QUEST_NOT_READY, 400, {
            count: progress?.count ?? 0,
            target: quest.target,
          });
        }

        const rules = await getStaminaRules(this.prisma);
        if (rules.specialStaminaCost > 0) {
          const club = await tx.club.findUnique({
            where: { userId },
            select: { user: { select: { wallet: true } } },
          });
          const stamina = new StaminaService(
            this.prisma,
            new ClubRepository(this.prisma),
            new StadiumRepository(this.prisma),
            new VestiarioTemplateRepository(this.prisma),
          );
          await stamina.consumeLineupInTx(
            tx,
            userId,
            club?.user?.wallet ?? null,
            rules.specialStaminaCost,
            'special',
            { rejectIfShort: true },
          );
        }

        await tx.questClaim.create({
          data: { userId, questId, periodKey },
        });

        const granted = await grantQuestRewards(
          tx,
          userId,
          questId,
          periodKey,
          quest.rewards,
        );

        await tx.questClaimLog.create({
          data: {
            userId,
            questId,
            periodKey,
            rewards: granted as unknown as Prisma.InputJsonValue,
            ip: meta?.ip?.slice(0, 64) ?? null,
            userAgent: meta?.userAgent?.slice(0, 512) ?? null,
          },
        });

        return { periodKey, rewards: granted };
      });

      return {
        ok: true,
        questId,
        periodKey: result.periodKey,
        rewards: result.rewards,
      };
    } catch (err) {
      if (err instanceof AppError) throw err;
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new AppError(ErrorCode.QUEST_ALREADY_CLAIMED, 409);
      }
      throw err;
    }
  }
}

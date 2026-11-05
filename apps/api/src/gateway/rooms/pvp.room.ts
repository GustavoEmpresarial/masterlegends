import type { Server } from 'socket.io';
import type Redis from 'ioredis';
import type { PrismaClient } from '@prisma/client';
import { SocketEvent } from '@mll/shared';
import type { AuthedSocket } from '../types.js';
import { logger } from '../../common/lib/logger.js';
import { GAME_CONFIG } from '../../config/game.js';
import { DEFAULT_STAMINA_RULES, getStaminaRules } from '../../modules/stamina/stamina-rules.js';
import { ClubRepository } from '../../modules/club/club.repository.js';
import { StadiumRepository } from '../../modules/stadium/stadium.repository.js';
import { StaminaService } from '../../modules/stamina/stamina.service.js';
import { VestiarioTemplateRepository } from '../../modules/vestiario/vestiario-template.repository.js';
import { AppError } from '../../common/lib/errors.js';

const QUEUE_KEY = 'pvp:queue';

function queueRateKey(userId: string) {
  return `pvp:queue-rate:${userId}`;
}

interface QueueEntry {
  userId: string;
  socketId: string;
  enqueuedAt: number;
}

function isAppError(err: unknown): err is AppError {
  return err instanceof AppError;
}

export function setupPvpRoom(io: Server, redis: Redis, prisma: PrismaClient) {
  const staminaService = new StaminaService(
    prisma,
    new ClubRepository(prisma),
    new StadiumRepository(prisma),
    new VestiarioTemplateRepository(prisma),
  );

  io.on('connection', (socket) => {
    const s = socket as AuthedSocket;
    const userId = s.data.user.id;

    s.on(SocketEvent.PVP_QUEUE, async () => {
      let rules = DEFAULT_STAMINA_RULES;
      try {
        rules = await getStaminaRules(prisma);
      } catch {
        rules = DEFAULT_STAMINA_RULES;
      }
      const cooldownSec = Math.max(1, rules.matchCooldownSec);
      const rateKey = queueRateKey(userId);
      const alreadyQueued = await redis.set(rateKey, '1', 'EX', cooldownSec, 'NX');
      if (!alreadyQueued) {
        s.emit(SocketEvent.PVP_ERROR, { code: 'RATE_LIMITED', details: { retryAfterSeconds: cooldownSec } });
        return;
      }

      try {
        await staminaService.validateLineupForAction(
          userId,
          Math.max(GAME_CONFIG.STAMINA.MIN_TO_PVP, rules.matchStaminaCost),
        );
      } catch (err) {
        const code = isAppError(err) ? err.code : 'UNKNOWN';
        const details = isAppError(err) ? err.details : undefined;
        s.emit(SocketEvent.PVP_ERROR, { code, details });
        await redis.del(rateKey);
        return;
      }

      const entry: QueueEntry = {
        userId,
        socketId: s.id,
        enqueuedAt: Date.now(),
      };

      const opponentRaw = await redis.lpop(QUEUE_KEY);
      if (!opponentRaw) {
        await redis.rpush(QUEUE_KEY, JSON.stringify(entry));
        return;
      }

      let opponent: QueueEntry;
      try {
        opponent = JSON.parse(opponentRaw) as QueueEntry;
      } catch {
        await redis.rpush(QUEUE_KEY, JSON.stringify(entry));
        return;
      }

      if (opponent.userId === userId) {
        await redis.rpush(QUEUE_KEY, JSON.stringify(entry));
        return;
      }

      try {
        await staminaService.validateLineupForAction(
          opponent.userId,
          Math.max(GAME_CONFIG.STAMINA.MIN_TO_PVP, rules.matchStaminaCost),
        );
      } catch (err) {
        const code = isAppError(err) ? err.code : 'UNKNOWN';
        const details = isAppError(err) ? err.details : undefined;
        io.to(opponent.socketId).emit(SocketEvent.PVP_ERROR, { code, details });
        await redis.rpush(QUEUE_KEY, JSON.stringify(entry));
        return;
      }

      const matchId = `m_${Date.now()}_${userId.slice(0, 6)}_${opponent.userId.slice(0, 6)}`;
      const room = `match:${matchId}`;
      await Promise.all([s.join(room), io.in(opponent.socketId).socketsJoin(room)]);

      await Promise.all([
        staminaService.consumeLineup(userId, rules.matchStaminaCost, 'match'),
        staminaService.consumeLineup(opponent.userId, rules.matchStaminaCost, 'match'),
      ]);

      await Promise.all([
        redis.del(queueRateKey(userId)),
        redis.del(queueRateKey(opponent.userId)),
      ]);

      io.to(room).emit(SocketEvent.PVP_MATCHED, {
        matchId,
        rounds: 5,
        playerA: userId,
        playerB: opponent.userId,
      });
      logger.info({ event: 'pvp.matched', matchId, a: userId, b: opponent.userId }, 'PvP matched');
    });

    s.on('disconnect', async () => {
      const items = await redis.lrange(QUEUE_KEY, 0, -1);
      for (const raw of items) {
        try {
          const entry = JSON.parse(raw) as QueueEntry;
          if (entry.socketId === s.id) {
            await redis.lrem(QUEUE_KEY, 1, raw);
          }
        } catch {
          /* ignore corrupt entry */
        }
      }
    });
  });
}

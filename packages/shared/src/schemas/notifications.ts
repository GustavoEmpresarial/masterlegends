import { z } from 'zod';

export const NotificationType = {
  MINT_COMPLETED: 'mint.completed',
  MARKETPLACE_SOLD: 'marketplace.sold',
  MARKETPLACE_OFFER: 'marketplace.offer',
  REFERRAL_EARNED: 'referral.earned',
  PASS_REWARD_UNLOCKED: 'pass.reward.unlocked',
  ACCOUNT_PASSWORD_CHANGED: 'account.password.changed',
  SUPPORT_REPLIED: 'support.replied',
  WITHDRAWAL_APPROVED: 'withdrawal.approved',
  WITHDRAWAL_REJECTED: 'withdrawal.rejected',
  AFFLICTION_APPLIED: 'affliction.applied',
  ANNOUNCEMENT: 'announcement.published',
} as const;

export type NotificationTypeValue = (typeof NotificationType)[keyof typeof NotificationType];

export const notificationPayloadSchema = z.object({
  id: z.string(),
  type: z.enum([
    NotificationType.MINT_COMPLETED,
    NotificationType.MARKETPLACE_SOLD,
    NotificationType.MARKETPLACE_OFFER,
    NotificationType.REFERRAL_EARNED,
    NotificationType.PASS_REWARD_UNLOCKED,
    NotificationType.ACCOUNT_PASSWORD_CHANGED,
    NotificationType.SUPPORT_REPLIED,
    NotificationType.WITHDRAWAL_APPROVED,
    NotificationType.WITHDRAWAL_REJECTED,
    NotificationType.AFFLICTION_APPLIED,
    NotificationType.ANNOUNCEMENT,
  ]),
  createdAt: z.string().datetime(),
  data: z.record(z.string(), z.unknown()).default({}),
});

export type NotificationPayload = z.infer<typeof notificationPayloadSchema>;

// PvP socket events
export interface PvpQueuePayload {
  band?: 'low' | 'mid' | 'high';
}

export interface PvpMatchedEvent {
  matchId: string;
  opponentId: string;
  rounds: number;
}

export interface PvpRoundResultEvent {
  matchId: string;
  round: number;
  winner: 'A' | 'B';
  scoreA: number;
  scoreB: number;
}

export interface PresenceUpdateEvent {
  userId: string;
  online: boolean;
}

// Canonical socket event names (used by client + server, never inlined)
export const SocketEvent = {
  // server -> client
  NOTIFICATION: 'notification',
  PVP_MATCHED: 'pvp:matched',
  PVP_ROUND_RESULT: 'pvp:round-result',
  PVP_MATCH_END: 'pvp:match-end',
  PVP_ERROR: 'pvp:error',
  PRESENCE_UPDATE: 'presence:update',
  // CT / Vestiário realtime (server -> client, room: user:{id})
  CT_VIEW_INVALIDATE: 'ct:view-invalidate',
  CT_STAMINA_UPDATE: 'ct:stamina-update',
  CT_ROSTER_UPDATE: 'ct:roster-update',
  // client -> server
  PVP_QUEUE: 'pvp:queue',
  PVP_PLAY: 'pvp:play',
  PVP_USE_BOOSTER: 'pvp:use-booster',
  PRESENCE_HEARTBEAT: 'presence:heartbeat',
  STADIUM_WATCH: 'stadium:watch',
  STADIUM_UNWATCH: 'stadium:unwatch',
} as const;

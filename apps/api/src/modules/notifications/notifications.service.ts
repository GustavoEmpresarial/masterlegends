import crypto from 'node:crypto';
import type { Server } from 'socket.io';
import { SocketEvent, type NotificationPayload, type NotificationTypeValue } from '@mll/shared';

export class NotificationsService {
  constructor(private readonly io: Server) {}

  notify(userId: string, type: NotificationTypeValue, data: Record<string, unknown> = {}) {
    const payload: NotificationPayload = {
      id: crypto.randomUUID(),
      type,
      createdAt: new Date().toISOString(),
      data,
    };
    this.io.to(`user:${userId}`).emit(SocketEvent.NOTIFICATION, payload);
    return payload;
  }

  emitCtInvalidate(userId: string, reason: string, extra: Record<string, unknown> = {}) {
    this.io
      .to(`user:${userId}`)
      .emit(SocketEvent.CT_VIEW_INVALIDATE, { reason, at: new Date().toISOString(), ...extra });
  }

  emitCtStaminaUpdate(userId: string, data: Record<string, unknown>) {
    this.io.to(`user:${userId}`).emit(SocketEvent.CT_STAMINA_UPDATE, {
      at: new Date().toISOString(),
      ...data,
    });
  }

  emitCtRosterUpdate(userId: string, action: 'add' | 'remove' | 'rest' | 'lineup', data: Record<string, unknown> = {}) {
    this.io.to(`user:${userId}`).emit(SocketEvent.CT_ROSTER_UPDATE, {
      action,
      at: new Date().toISOString(),
      ...data,
    });
  }
}

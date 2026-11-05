import { describe, it, expect, vi } from 'vitest';
import { NotificationType, SocketEvent } from '@mll/shared';
import { NotificationsService } from '../../../src/modules/notifications/notifications.service.js';

function makeIo() {
  const emit = vi.fn();
  const to = vi.fn().mockReturnValue({ emit });
  return { io: { to } as any, to, emit };
}

describe('NotificationsService', () => {
  it('emits notification to user room', () => {
    const { io, to, emit } = makeIo();
    const service = new NotificationsService(io);
    const payload = service.notify('user-1', NotificationType.MINT_COMPLETED, { id: '42' });
    expect(to).toHaveBeenCalledWith('user:user-1');
    expect(emit).toHaveBeenCalledWith('notification', expect.objectContaining({ type: NotificationType.MINT_COMPLETED }));
    expect(payload.id).toBeTruthy();
  });

  it('emits CT view invalidate event with reason', () => {
    const { io, to, emit } = makeIo();
    const service = new NotificationsService(io);
    service.emitCtInvalidate('user-2', 'daily-rest', { extra: 1 });
    expect(to).toHaveBeenCalledWith('user:user-2');
    expect(emit).toHaveBeenCalledWith(
      SocketEvent.CT_VIEW_INVALIDATE,
      expect.objectContaining({ reason: 'daily-rest', extra: 1, at: expect.any(String) }),
    );
  });

  it('emits CT stamina update event', () => {
    const { io, emit } = makeIo();
    const service = new NotificationsService(io);
    service.emitCtStaminaUpdate('user-3', { playerId: 'p1', stamina: 80 });
    expect(emit).toHaveBeenCalledWith(
      SocketEvent.CT_STAMINA_UPDATE,
      expect.objectContaining({ playerId: 'p1', stamina: 80, at: expect.any(String) }),
    );
  });

  it('emits CT roster update event with action', () => {
    const { io, emit } = makeIo();
    const service = new NotificationsService(io);
    service.emitCtRosterUpdate('user-4', 'lineup', { assignments: 11 });
    expect(emit).toHaveBeenCalledWith(
      SocketEvent.CT_ROSTER_UPDATE,
      expect.objectContaining({ action: 'lineup', assignments: 11, at: expect.any(String) }),
    );
  });
});

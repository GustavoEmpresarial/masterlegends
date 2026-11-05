import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { SocketEvent } from '@mll/shared';
import { useAuth } from './useAuth';
import { useSocket } from './useSocket';

/**
 * Listens to CT/Vestiário realtime events on the user's socket room and
 * invalidates the relevant React Query caches so stamina, roster and CT view
 * stay in sync across tabs / after backend mutations.
 */
export function useCtRealtime(): void {
  const socket = useSocket();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id;

  useEffect(() => {
    if (!socket) return;

    const invalidateAll = () => {
      void queryClient.invalidateQueries({ queryKey: ['ct', userId] });
      void queryClient.invalidateQueries({ queryKey: ['vestiario', userId] });
      void queryClient.invalidateQueries({ queryKey: ['club', userId] });
      void queryClient.invalidateQueries({ queryKey: ['stadium-view', userId] });
    };

    const onInvalidate = (payload: unknown) => {
      if (import.meta.env.DEV) console.debug('[ws] ct:view-invalidate', payload);
      invalidateAll();
    };
    const onStamina = (payload: unknown) => {
      if (import.meta.env.DEV) console.debug('[ws] ct:stamina-update', payload);
      void queryClient.invalidateQueries({ queryKey: ['ct', userId] });
      void queryClient.invalidateQueries({ queryKey: ['vestiario', userId] });
    };
    const onRoster = (payload: unknown) => {
      if (import.meta.env.DEV) console.debug('[ws] ct:roster-update', payload);
      invalidateAll();
    };

    socket.on(SocketEvent.CT_VIEW_INVALIDATE, onInvalidate);
    socket.on(SocketEvent.CT_STAMINA_UPDATE, onStamina);
    socket.on(SocketEvent.CT_ROSTER_UPDATE, onRoster);

    return () => {
      socket.off(SocketEvent.CT_VIEW_INVALIDATE, onInvalidate);
      socket.off(SocketEvent.CT_STAMINA_UPDATE, onStamina);
      socket.off(SocketEvent.CT_ROSTER_UPDATE, onRoster);
    };
  }, [socket, queryClient, userId]);
}

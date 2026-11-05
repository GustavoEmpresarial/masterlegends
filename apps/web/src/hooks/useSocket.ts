import { useEffect } from 'react';
import { Socket } from 'socket.io-client';
import { useAuth } from './useAuth';
import { connectSocket, disconnectSocket, getSocket, refreshSocketAuth } from '../lib/socket/client';
import { SocketEvent } from '@mll/shared';

export function useSocket(): Socket {
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) {
      disconnectSocket();
      return;
    }
    const socket = connectSocket();

    const heartbeat = window.setInterval(() => {
      socket.emit(SocketEvent.PRESENCE_HEARTBEAT);
    }, 30_000);

    const onError = (err: Error) => {
      if (err.message === 'WS_UNAUTHORIZED') {
        // access token likely expired; reconnect with fresh one
        refreshSocketAuth();
      }
    };
    socket.on('connect_error', onError);

    return () => {
      window.clearInterval(heartbeat);
      socket.off('connect_error', onError);
    };
  }, [isAuthenticated]);

  return getSocket();
}

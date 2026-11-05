import { useEffect, useState } from 'react';
import { SocketEvent } from '@mll/shared';
import { useAuth } from './useAuth';
import { connectSocket } from '../lib/socket/client';

const HEARTBEAT_MS = 20_000;

/** Mantém a aba do estádio marcada como aberta enquanto a página está montada e online. */
export function useStadiumIncomeWatch(): boolean {
  const { isAuthenticated } = useAuth();
  const [online, setOnline] = useState(
    () => typeof navigator === 'undefined' || navigator.onLine,
  );

  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    const socket = connectSocket();

    const publish = () => {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        socket.emit(SocketEvent.STADIUM_UNWATCH);
        return;
      }
      socket.emit(SocketEvent.STADIUM_WATCH);
    };

    publish();
    const timer = window.setInterval(publish, HEARTBEAT_MS);
    const onOffline = () => socket.emit(SocketEvent.STADIUM_UNWATCH);
    const onOnline = () => socket.emit(SocketEvent.STADIUM_WATCH);
    const onHide = () => socket.emit(SocketEvent.STADIUM_UNWATCH);

    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);
    window.addEventListener('pagehide', onHide);
    window.addEventListener('pageshow', publish);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('pagehide', onHide);
      window.removeEventListener('pageshow', publish);
      socket.emit(SocketEvent.STADIUM_UNWATCH);
    };
  }, [isAuthenticated]);

  return online;
}

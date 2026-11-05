import { io, Socket } from 'socket.io-client';
import { getAccessToken } from '../auth/storage';
import { resolveApiUrl } from '../api/baseUrl';

const baseURL = resolveApiUrl();
const socketPath = import.meta.env.VITE_SOCKET_PATH || '/socket.io';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (socket) return socket;
  socket = io(baseURL, {
    path: socketPath,
    autoConnect: false,
    withCredentials: true,
    transports: ['websocket'],
    auth: (cb) => cb({ token: getAccessToken() ?? '' }),
  });
  return socket;
}

export function connectSocket(): Socket {
  const s = getSocket();
  if (!s.connected) s.connect();
  return s;
}

export function disconnectSocket(): void {
  if (socket?.connected) socket.disconnect();
}

export function refreshSocketAuth(): void {
  if (!socket) return;
  // socket.io picks the new token from the auth callback on next reconnect.
  socket.disconnect();
  socket.connect();
}

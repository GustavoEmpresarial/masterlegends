import type { Socket } from 'socket.io';

export interface SocketUser {
  id: string;
  email?: string;
}

export type AuthedSocket = Socket & { data: { user: SocketUser } };

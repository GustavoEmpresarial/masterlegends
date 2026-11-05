/** Quanto tempo a aba do estádio continua contando como aberta sem novo heartbeat. */
export const STADIUM_WATCH_TTL_SEC = 150;

/** Fatia paga quando a aba do estádio está aberta e online. */
export const STADIUM_WATCH_ONLINE_RATE = 1;

/** Fatia paga com o site fechado ou offline (perde 30%). */
export const STADIUM_WATCH_OFFLINE_RATE = 0.7;

/** Corte aplicado sobre a fatia quando a aba não está aberta. */
export const STADIUM_WATCH_OFFLINE_CUT = 0.3;

export function stadiumWatchKey(userId: string): string {
  return `stadium:watch:${userId}`;
}

export function stadiumWatchSocketsKey(userId: string): string {
  return `stadium:watch:sockets:${userId}`;
}

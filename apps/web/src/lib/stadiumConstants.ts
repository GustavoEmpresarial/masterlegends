import type { StadiumSlotRole } from '@mll/shared';

export const POSITION_EMOJI: Record<string, string> = {
  GK: '🧤',
  DEF: '🛡️',
  LAT: '↔️',
  MID: '🎯',
  FW: '⚽',
};

export const SLOT_ROLE_EMOJI: Record<StadiumSlotRole, string> = {
  GK: '🧤',
  DEF: '🛡️',
  LAT: '↔️',
  MID: '🎯',
  FW: '⚽',
  DECOR: '⚙️',
};

export const DRAG_PLAYER_MIME = 'application/x-mll-player';

export interface DragPlayerPayload {
  playerId: string;
  kind: 'base' | 'nft';
  position?: string;
}

export function encodeDragPlayer(payload: DragPlayerPayload): string {
  return JSON.stringify(payload);
}

export function decodeDragPlayer(raw: string): DragPlayerPayload | null {
  try {
    const parsed = JSON.parse(raw) as DragPlayerPayload;
    if (parsed?.playerId && (parsed.kind === 'base' || parsed.kind === 'nft')) {
      return parsed;
    }
  } catch {
    /* invalid */
  }
  return null;
}

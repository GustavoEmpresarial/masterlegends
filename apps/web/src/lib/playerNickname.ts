import { isPlaceholderPlayerName, playerNicknameFromSeed } from '@mll/shared';

/**
 * Apelido na UI.
 * - Nome real `Fulano — O Monarca` → `O Monarca`
 * - Placeholder `[seed-v1] Comum #03` → apelido gerado estável a partir do `seed` (id)
 */
export function playerNickname(
  name: string | null | undefined,
  seed?: string | null,
  fallback = 'Jogador',
): string {
  if (isPlaceholderPlayerName(name)) {
    return playerNicknameFromSeed(seed || name || 'x');
  }

  let raw = name?.trim() || '';
  if (!raw) {
    return seed ? playerNicknameFromSeed(seed) : fallback;
  }

  raw = raw.replace(/^\[[^\]]+\]\s*/u, '').trim();
  const parts = raw.split(/\s+[—–-]\s+/u);
  const nick = parts.length > 1 ? parts[parts.length - 1]?.trim() : '';
  return nick || raw || fallback;
}

export function shortPlayerNickname(
  name: string | null | undefined,
  seed?: string | null,
  fallback = 'Jogador',
  maxLen = 10,
): string {
  const nick = playerNickname(name, seed, fallback);
  return nick.length > maxLen ? `${nick.slice(0, maxLen - 1)}…` : nick;
}

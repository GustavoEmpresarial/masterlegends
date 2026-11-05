/** Nomes fictícios MLL — sem referência a jogadores reais. */

const FIRST_NAMES = [
  'Kael', 'Ravi', 'Nox', 'Lio', 'Vash', 'Orin', 'Tari', 'Miro', 'Zeke', 'Fenn',
  'Soren', 'Dax', 'Kian', 'Rolo', 'Pax', 'Enzo', 'Yuri', 'Ciro', 'Nilo', 'Beto',
  'Ludo', 'Guri', 'Tiko', 'Veno', 'Arlo', 'Remy', 'Juno', 'Otis', 'Cal', 'Ivo',
] as const;

const LAST_NAMES = [
  'Voss', 'Moura', 'Drax', 'Pires', 'Holt', 'Quill', 'Sanz', 'Vale', 'Cruz', 'Neri',
  'Bastos', 'Ramos', 'Lira', 'Tava', 'Moss', 'Kane', 'Veld', 'Rusk', 'Paz', 'Nova',
  'Grell', 'Faro', 'Solis', 'Dune', 'Korr', 'West', 'Bane', 'Lux', 'Rift', 'Gale',
] as const;

const NICKNAMES = [
  'O Relâmpago', 'A Muralha', 'O Frio', 'O Gelo', 'A Flecha', 'O Martelo', 'O Sombra',
  'O Drible', 'O Canhão', 'A Trava', 'O Tempo', 'O Pulmão', 'O Raio', 'A Besta',
  'O Fantasma', 'O Pivô', 'O Corte', 'A Cobra', 'O Foguetinho', 'O Tanque',
  'El Trueno', 'O Expresso', 'A Rede', 'O Capataz', 'O Moleque', 'O Veterano',
  'O Xerife', 'A Tromba', 'O Giro', 'O Furacão', 'O Pedreiro', 'A Escova',
  'O Sensor', 'O Radar', 'O Gatilho', 'A Parede', 'O Lobisomem', 'O Cometa',
] as const;

function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pick<T extends readonly string[]>(list: T, n: number): T[number] {
  const len = list.length;
  const idx = ((n % len) + len) % len;
  return list[idx]!;
}

/** True se o nome ainda é placeholder de seed/admin (ex: `[seed-v1] Comum #03`). */
export function isPlaceholderPlayerName(name: string | null | undefined): boolean {
  const raw = name?.trim() || '';
  if (!raw) return true;
  if (/^\[[^\]]+\]/u.test(raw)) return true;
  const bare = raw.replace(/^\[[^\]]+\]\s*/u, '').trim();
  // Também nomes quebrados do backfill antigo ("Ivo undefined — undefined")
  if (/\bundefined\b/i.test(bare)) return true;
  return /^(Comum|Incomum|Raro|Super\s*Raro|S\.?\s*Raro|Épico|Epico|Lendário|Lendario)\s*#?\s*\d*/iu.test(
    bare,
  );
}

/** Gera `Nome Sobrenome — Apelido` estável a partir de um seed (id do jogador). */
export function generatePlayerDisplayName(seed: string): string {
  const h = hashSeed(seed || 'x');
  const first = pick(FIRST_NAMES, h);
  const last = pick(LAST_NAMES, (h >>> 8) ^ 0x9e3779b9);
  const nick = pick(NICKNAMES, (h >>> 16) ^ 0x85ebca6b);
  return `${first} ${last} — ${nick}`;
}

/** Apelido curto para UI (placa do campo, cards). */
export function playerNicknameFromSeed(seed: string): string {
  const h = hashSeed(seed || 'x');
  return pick(NICKNAMES, (h >>> 16) ^ 0x85ebca6b);
}

/**
 * Nome completo para persistir / exibir.
 * Mantém nomes reais (ex: `Reydo Costa — O Monarca`); troca placeholders por gerado.
 */
export function resolvePlayerDisplayName(
  name: string | null | undefined,
  seed: string,
): string {
  if (!isPlaceholderPlayerName(name)) return name!.trim();
  return generatePlayerDisplayName(seed);
}

/** Só o apelido (após "—"), com fallback gerado se o nome for placeholder. */
export function displayPlayerNickname(name: string | null | undefined, seed: string): string {
  const full = resolvePlayerDisplayName(name, seed);
  const parts = full.split(/\s+[—–-]\s+/u);
  const nick = parts.length > 1 ? parts[parts.length - 1]?.trim() : '';
  return nick || full;
}

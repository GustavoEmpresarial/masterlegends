import { useMemo, useState } from 'react';
import type { InventoryPlayerDTO } from '@mll/shared';
import { stakeExitPenaltyPercent, stakeGmtForRarityName } from '@mll/shared';
import { StakeConfirmDialog } from '../stake/StakeConfirmDialog';
import { usePlayerStake, usePlayerUnstake } from '../../hooks/useApi';
import { translateError } from '../../lib/apiError';
import { resolveUploadUrl } from '../../lib/resolveUploadUrl';
import { playerNickname } from '../../lib/playerNickname';
import { POSITION_EMOJI } from '../../lib/stadiumConstants';
import { rarityGlowCss } from './stadiumBonecoTheme';

export type RosterRole = 'titular' | 'reserva';

export interface RosterEntry {
  player: InventoryPlayerDTO;
  role: RosterRole;
  slotId: string | null;
}

const RARITY_LABEL: Record<string, string> = {
  common: 'COMUM',
  uncommon: 'INCOMUM',
  rare: 'RARO',
  'super-rare': 'SUPER RARO',
  epic: 'ÉPICO',
  legendary: 'LENDÁRIO',
};

/** Higher = rarer. Used for sort high→low. */
const RARITY_RANK: Record<string, number> = {
  legendary: 6,
  mythic: 6,
  epic: 5,
  'super-rare': 4,
  rare: 3,
  uncommon: 2,
  common: 1,
};

const RARITY_FILTERS = ['legendary', 'epic', 'super-rare', 'rare', 'uncommon', 'common'] as const;

const POSITION_LABEL: Record<string, string> = {
  GK: 'GOL',
  DEF: 'ZAG',
  LAT: 'LAT',
  MID: 'MEI',
  FW: 'ATA',
};

const POSITIONS = ['GK', 'DEF', 'LAT', 'MID', 'FW'] as const;

function rarityRank(rarity: string | undefined): number {
  return RARITY_RANK[rarity ?? 'common'] ?? 0;
}

function compareByRarityThenOw(a: InventoryPlayerDTO, b: InventoryPlayerDTO): number {
  const stakeDiff = Number(Boolean(b.staked)) - Number(Boolean(a.staked));
  if (stakeDiff !== 0) return stakeDiff;
  const rarityDiff = rarityRank(b.rarity) - rarityRank(a.rarity);
  if (rarityDiff !== 0) return rarityDiff;
  return (b.overwall ?? 0) - (a.overwall ?? 0);
}

function staminaColor(pct: number) {
  if (pct >= 70) return 'var(--green)';
  if (pct >= 40) return 'var(--gold)';
  return 'var(--red)';
}

function playerStatus(player: InventoryPlayerDTO): string {
  if (player.listed) return 'À venda';
  if ((player.stamina ?? 100) <= 0) return 'Sem energia';
  if (player.retiredAt) return 'Aposentado';
  return 'Disponível';
}

export function VestiarioRoster({
  entries,
  onOpen,
}: {
  entries: RosterEntry[];
  onOpen: (entry: RosterEntry) => void;
}) {
  const [query, setQuery] = useState('');
  const [role, setRole] = useState<'todos' | RosterRole>('todos');
  const [position, setPosition] = useState<string>('todas');
  const [rarity, setRarity] = useState<string>('todas');

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries
      .filter((entry) => {
        if (role !== 'todos' && entry.role !== role) return false;
        if (position !== 'todas' && entry.player.position !== position) return false;
        if (rarity !== 'todas') {
          const playerRarity = entry.player.rarity === 'mythic' ? 'legendary' : entry.player.rarity;
          if (playerRarity !== rarity) return false;
        }
        if (!q) return true;
        const name = playerNickname(entry.player.name, entry.player.id).toLowerCase();
        const full = (entry.player.name ?? '').toLowerCase();
        const pos = (POSITION_LABEL[entry.player.position] ?? entry.player.position).toLowerCase();
        return name.includes(q) || full.includes(q) || pos.includes(q) || entry.player.position.toLowerCase().includes(q);
      })
      .sort((a, b) => compareByRarityThenOw(a.player, b.player));
  }, [entries, query, role, position, rarity]);

  return (
    <section className="pixel-card space-y-3" style={{ borderColor: 'var(--blue)' }}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="ui-label" style={{ color: 'var(--blue)' }}>
          <i className="bi bi-people-fill" aria-hidden /> Elenco
        </h2>
        <span className="retro-text text-xs" style={{ color: 'var(--text-muted)' }}>
          {visible.length} de {entries.length}
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar jogador"
          className="pixel-input min-w-[12rem] flex-1"
          aria-label="Buscar jogador"
        />
        {(['todos', 'titular', 'reserva'] as const).map((item) => (
          <button
            key={item}
            type="button"
            className="pixel-btn pixel-btn-sm"
            style={{ borderColor: role === item ? 'var(--gold)' : 'var(--bg-lighter)' }}
            onClick={() => setRole(item)}
          >
            {item === 'todos' ? 'TODOS' : item === 'titular' ? 'TITULARES' : 'RESERVAS'}
          </button>
        ))}
        <select
          value={rarity}
          onChange={(event) => setRarity(event.target.value)}
          className="pixel-select pixel-select-md"
          aria-label="Filtrar raridade"
        >
          <option value="todas">Todas as raridades</option>
          {RARITY_FILTERS.map((key) => (
            <option key={key} value={key}>
              {RARITY_LABEL[key]}
            </option>
          ))}
        </select>
        <select
          value={position}
          onChange={(event) => setPosition(event.target.value)}
          className="pixel-select pixel-select-md"
          aria-label="Filtrar posição"
        >
          <option value="todas">Todas as posições</option>
          {POSITIONS.map((pos) => (
            <option key={pos} value={pos}>
              {POSITION_LABEL[pos]}
            </option>
          ))}
        </select>
      </div>

      {visible.length === 0 ? (
        <p className="retro-text text-sm" style={{ color: 'var(--text-muted)' }}>
          Nenhum jogador com esse filtro.
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {visible.map((entry) => (
            <li key={`${entry.role}-${entry.player.kind}-${entry.player.id}`}>
              <RosterCard entry={entry} onOpen={() => onOpen(entry)} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function RosterCard({ entry, onOpen }: { entry: RosterEntry; onOpen: () => void }) {
  const { player, role } = entry;
  const stamina = player.stamina ?? 100;
  const staminaMax = player.staminaMax ?? 100;
  const pct = Math.max(0, Math.min(100, Math.round((stamina / staminaMax) * 100)));
  const color = staminaColor(pct);
  const status = playerStatus(player);
  const stake = usePlayerStake();
  const unstake = usePlayerUnstake();
  const [stakeErr, setStakeErr] = useState('');
  const [confirm, setConfirm] = useState(false);
  const stakeGmt = player.stakeGmt ?? stakeGmtForRarityName(player.rarity ?? 'common');
  const staked = Boolean(player.staked);
  const pending = stake.isPending || unstake.isPending;
  const penaltyPct = staked && player.stakedAt ? stakeExitPenaltyPercent(player.stakedAt) : null;
  const nick = playerNickname(player.name, player.id, player.position);

  const runStake = async () => {
    setStakeErr('');
    try {
      if (staked) {
        await unstake.mutateAsync({ kind: player.kind, playerId: player.id });
      } else {
        await stake.mutateAsync({ kind: player.kind, playerId: player.id });
      }
      setConfirm(false);
    } catch (err: unknown) {
      setConfirm(false);
      setStakeErr(translateError(err));
    }
  };

  return (
    <div
      className="flex items-stretch gap-3 p-3 h-full"
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: `2px solid ${staked ? 'rgba(0,200,120,0.35)' : 'rgba(255,255,255,0.08)'}`,
        borderRadius: 4,
      }}
    >
      <button
        type="button"
        onClick={onOpen}
        className="relative flex aspect-[2/3] h-44 w-auto sm:h-56 shrink-0 overflow-hidden"
        style={{ border: `2px solid ${color}`, background: '#0f1622' }}
        aria-label={`Abrir ${playerNickname(player.name, player.id, player.position)}`}
      >
        {player.imageUrl ? (
          <img
            src={resolveUploadUrl(player.imageUrl)}
            alt=""
            className="h-full w-full object-cover"
            style={{ imageRendering: 'pixelated' }}
            draggable={false}
          />
        ) : (
          <i className={`bi ${POSITION_EMOJI[player.position] ?? 'bi-shield-fill'} text-5xl sm:text-6xl`} aria-hidden />
        )}
      </button>
      <div className="min-w-0 flex flex-1 flex-col justify-between gap-2">
        <button type="button" onClick={onOpen} className="min-w-0 text-left">
          <span className="flex items-center justify-between gap-2">
            <span
              className="retro-text truncate text-sm font-bold"
              style={{ color: rarityGlowCss(player.rarity) }}
            >
              {playerNickname(player.name, player.id, player.position)}
            </span>
            <span
              className="retro-text shrink-0 text-[13px]"
              style={{ color: role === 'titular' ? 'var(--green)' : 'var(--gold)' }}
            >
              {role === 'titular' ? 'TITULAR' : 'RESERVA'}
            </span>
          </span>
          <span
            className="mt-1 grid grid-cols-2 gap-x-2 gap-y-1 retro-text text-[14px] leading-snug"
            style={{ color: 'var(--text-secondary)' }}
          >
            <span>{RARITY_LABEL[player.rarity] ?? player.rarity}</span>
            <span>{POSITION_LABEL[player.position] ?? player.position}</span>
            <span>OW {player.overwall}</span>
            <span>Nível {player.positionPower ?? '—'}</span>
            <span className="col-span-2" style={{ color }}>
              Stamina {stamina}/{staminaMax}
            </span>
            <span className="col-span-2" style={{ color: staked ? 'var(--green)' : 'var(--red)' }}>
              {staked ? `STAKE ${stakeGmt} GMT` : 'SEM STAKE · 5 MIN / 24H'}
            </span>
            {penaltyPct != null ? <span className="col-span-2" style={{ color: 'var(--gold)' }}>Penalidade {penaltyPct}%</span> : null}
            <span className="col-span-2">{status}</span>
          </span>
          {stakeErr ? (
            <span className="mt-1 block retro-text text-[14px]" style={{ color: 'var(--red)' }}>
              {stakeErr}
            </span>
          ) : null}
        </button>
        <button
          type="button"
          className={`pixel-btn pixel-btn-sm w-full ${staked ? 'pixel-btn-red' : 'pixel-btn-gold'}`}
          disabled={pending}
          onClick={(event) => {
            event.stopPropagation();
            setStakeErr('');
            setConfirm(true);
          }}
        >
          {pending ? '…' : staked ? 'TIRAR' : `STAKE ${stakeGmt} GMT`}
        </button>
        {confirm ? (
          <StakeConfirmDialog
            mode={staked ? 'unstake' : 'stake'}
            playerName={nick}
            stakeGmt={stakeGmt}
            stakedAt={player.stakedAt}
            pending={pending}
            onCancel={() => {
              if (!pending) setConfirm(false);
            }}
            onConfirm={() => void runStake()}
          />
        ) : null}
      </div>
    </div>
  );
}

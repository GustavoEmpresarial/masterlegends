import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { InventoryPlayerDTO } from '@mll/shared';
import { stakeExitPenaltyPercent, stakeGmtForRarityName } from '@mll/shared';
import { StakeConfirmDialog } from '../../../components/stake/StakeConfirmDialog';
import { useInventory, usePlayerStake, usePlayerUnstake } from '../../../hooks/useApi';
import { translateError } from '../../../lib/apiError';
import { resolveUploadUrl } from '../../../lib/resolveUploadUrl';
import { playerNickname } from '../../../lib/playerNickname';
import { POSITION_EMOJI } from '../../../lib/stadiumConstants';
import { PageContentShell } from '../../../components/content';
import { FreeFieldNotice } from '../../../components/stadium/FreeFieldNotice';

const RARITY_LABEL: Record<string, string> = {
  common: 'COMUM',
  uncommon: 'INCOMUM',
  rare: 'RARO',
  'super-rare': 'SUPER RARO',
  epic: 'ÉPICO',
  legendary: 'LENDÁRIO',
  mythic: 'LENDÁRIO',
};

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

function comparePlayers(a: InventoryPlayerDTO, b: InventoryPlayerDTO): number {
  const stakeDiff = Number(Boolean(b.staked)) - Number(Boolean(a.staked));
  if (stakeDiff !== 0) return stakeDiff;
  const rarityDiff = rarityRank(b.rarity) - rarityRank(a.rarity);
  if (rarityDiff !== 0) return rarityDiff;
  return (b.overwall ?? 0) - (a.overwall ?? 0);
}

export function StakePage() {
  const { data, isLoading, isError, error, refetch } = useInventory();
  const [query, setQuery] = useState('');
  const [rarity, setRarity] = useState('todas');
  const [position, setPosition] = useState('todas');
  const [stakeFilter, setStakeFilter] = useState<'todos' | 'com' | 'sem'>('todos');

  const players = useMemo(() => {
    const list = [...(data?.players ?? [])];
    return list.sort(comparePlayers);
  }, [data]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return players.filter((player) => {
      if (stakeFilter === 'com' && !player.staked) return false;
      if (stakeFilter === 'sem' && player.staked) return false;
      if (position !== 'todas' && player.position !== position) return false;
      if (rarity !== 'todas') {
        const playerRarity = player.rarity === 'mythic' ? 'legendary' : player.rarity;
        if (playerRarity !== rarity) return false;
      }
      if (!q) return true;
      const name = (player.name ?? '').toLowerCase();
      return name.includes(q) || player.position.toLowerCase().includes(q);
    });
  }, [players, query, rarity, position, stakeFilter]);

  const stakedCount = players.filter((p) => p.staked).length;
  const lockedGmt = players
    .filter((p) => p.staked)
    .reduce((sum, p) => sum + (p.stakeGmt ?? stakeGmtForRarityName(p.rarity ?? 'common')), 0);

  return (
    <PageContentShell wide>
      <div className="space-y-4">
        <header className="pixel-card space-y-2" style={{ borderColor: 'var(--gold)' }}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="ui-label" style={{ color: 'var(--gold)' }}>
                <i className="bi bi-lock-fill" aria-hidden /> STAKE
              </h1>
              <p className="retro-text text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                Sem stake, o jogador entra em campo por 5 minutos e depois trava. Só volta a jogar depois de 24 horas. Com stake, joga o tempo todo. Tirar o stake antes de 30 dias queima parte do GMT: 30% no dia do stake, menos 1% a cada dia.
              </p>
            </div>
            <Link to="/club/vestiario" className="pixel-btn pixel-btn-sm" style={{ borderColor: 'var(--blue)' }}>
              IR AO VESTIÁRIO
            </Link>
          </div>
          <div className="flex flex-wrap gap-4 retro-text text-xs" style={{ color: 'var(--text-muted)' }}>
            <span>
              Com stake: <strong style={{ color: 'var(--green)' }}>{stakedCount}</strong> / {players.length}
            </span>
            <span>
              GMT travado: <strong style={{ color: 'var(--gold)' }}>{lockedGmt}</strong>
            </span>
          </div>
        </header>

        <FreeFieldNotice players={players} />

        <div className="flex flex-wrap gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar jogador"
            className="pixel-input min-w-[12rem] flex-1"
            aria-label="Buscar jogador"
          />
          {(['todos', 'com', 'sem'] as const).map((item) => (
            <button
              key={item}
              type="button"
              className="pixel-btn pixel-btn-sm"
              style={{ borderColor: stakeFilter === item ? 'var(--gold)' : 'var(--bg-lighter)' }}
              onClick={() => setStakeFilter(item)}
            >
              {item === 'todos' ? 'TODOS' : item === 'com' ? 'COM STAKE' : 'SEM STAKE'}
            </button>
          ))}
          <select
            value={rarity}
            onChange={(e) => setRarity(e.target.value)}
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
            onChange={(e) => setPosition(e.target.value)}
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

        {isLoading ? (
          <p className="retro-text" style={{ color: 'var(--text-muted)' }}>Carregando elenco…</p>
        ) : isError ? (
          <div className="pixel-card space-y-2" style={{ borderColor: 'var(--red)' }}>
            <p className="retro-text" style={{ color: 'var(--red)' }}>
              {translateError(error)}
            </p>
            <button type="button" className="pixel-btn pixel-btn-sm" onClick={() => void refetch()}>
              Tentar de novo
            </button>
          </div>
        ) : visible.length === 0 ? (
          <p className="retro-text" style={{ color: 'var(--text-muted)' }}>
            Nenhum jogador com esse filtro.
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {visible.map((player) => (
              <li key={`${player.kind}:${player.id}`}>
                <StakeCard player={player} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </PageContentShell>
  );
}

function StakeCard({ player }: { player: InventoryPlayerDTO }) {
  const stake = usePlayerStake();
  const unstake = usePlayerUnstake();
  const [err, setErr] = useState('');
  const [confirm, setConfirm] = useState(false);
  const stakeGmt = player.stakeGmt ?? stakeGmtForRarityName(player.rarity ?? 'common');
  const staked = Boolean(player.staked);
  const pending = stake.isPending || unstake.isPending;
  const penaltyPct = staked && player.stakedAt ? stakeExitPenaltyPercent(player.stakedAt) : null;
  const icon = POSITION_EMOJI[player.position] ?? 'bi-shield-fill';
  const nick = playerNickname(player.name, player.id, player.position);

  const run = async () => {
    setErr('');
    try {
      if (staked) {
        await unstake.mutateAsync({ kind: player.kind, playerId: player.id });
      } else {
        await stake.mutateAsync({ kind: player.kind, playerId: player.id });
      }
      setConfirm(false);
    } catch (error: unknown) {
      setConfirm(false);
      setErr(translateError(error));
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
      <span
        className="relative flex aspect-[2/3] h-44 w-auto sm:h-56 shrink-0 items-center justify-center overflow-hidden"
        style={{ border: '2px solid rgba(255,255,255,0.2)', background: '#0f1622' }}
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
          <i className={`bi ${icon} text-5xl sm:text-6xl`} aria-hidden />
        )}
      </span>
      <div className="min-w-0 flex flex-1 flex-col justify-between gap-2">
        <div>
          <p className="retro-text truncate text-sm font-bold" style={{ color: '#fff' }}>
            {nick}
          </p>
          <div
            className="mt-1 grid grid-cols-2 gap-x-2 gap-y-1 retro-text text-[14px] leading-snug"
            style={{ color: 'var(--text-secondary)' }}
          >
            <span>{RARITY_LABEL[player.rarity] ?? player.rarity}</span>
            <span>{POSITION_LABEL[player.position] ?? player.position}</span>
            <span>OW {player.overwall}</span>
            <span className="col-span-2" style={{ color: staked ? 'var(--green)' : 'var(--red)' }}>
              {staked ? `STAKE ${stakeGmt} GMT` : 'SEM STAKE'}
            </span>
            {penaltyPct != null ? <span className="col-span-2" style={{ color: 'var(--gold)' }}>Penalidade {penaltyPct}%</span> : null}
          </div>
          {err ? (
            <p className="mt-1 retro-text text-[14px]" style={{ color: 'var(--red)' }}>
              {err}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          className={`pixel-btn pixel-btn-sm w-full ${staked ? 'pixel-btn-red' : 'pixel-btn-gold'}`}
          disabled={pending}
          onClick={(e) => {
            e.preventDefault();
            setErr('');
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
            onConfirm={() => void run()}
          />
        ) : null}
      </div>
    </div>
  );
}

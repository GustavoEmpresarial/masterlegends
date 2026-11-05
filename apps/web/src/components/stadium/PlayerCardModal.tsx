import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import type { LineupPlayerDTO } from '@mll/shared';
import { stakeExitPenaltyPercent, stakeGmtForRarityName } from '@mll/shared';
import { StakeConfirmDialog } from '../stake/StakeConfirmDialog';
import { apiClient } from '../../lib/api/client';
import { usePlayerStake, usePlayerUnstake } from '../../hooks/useApi';
import { resolveUploadUrl } from '../../lib/resolveUploadUrl';
import { translateError } from '../../lib/apiError';
import { hasPlayerAge } from '../players/PlayerAgeBadge';
import { rarityColor, type ScoutRarity } from '../scout/scoutMintConstants';

interface PlayerCardModalProps {
  player: LineupPlayerDTO | null;
  onClose: () => void;
  extraAction?: ReactNode;
}

const RARITY_LABEL: Record<string, string> = {
  common: 'COMUM',
  uncommon: 'INCOMUM',
  rare: 'RARO',
  'super-rare': 'SUPER RARO',
  epic: 'ÉPICO',
  legendary: 'LENDÁRIO',
  mythic: 'LENDÁRIO',
};

const POSITION_LABEL: Record<string, string> = {
  GK: 'Goleiro',
  DEF: 'Zagueiro',
  LAT: 'Lateral',
  MID: 'Meio-campista',
  FW: 'Atacante',
  GOL: 'Goleiro',
  ZAG: 'Zagueiro',
  MEI: 'Meio-campista',
  ATA: 'Atacante',
};

const CT_ATTR: Record<string, string> = {
  goleiro: 'Goleiro',
  defesa: 'Defesa',
  velocidade: 'Velocidade',
  passe: 'Passe',
  finalizacao: 'Finalização',
};

const POSITION_EMOJI: Record<string, string> = {
  GK: 'bi-hand-index-thumb-fill',
  DEF: 'bi-shield-fill',
  LAT: 'bi-arrow-left-right',
  MID: 'bi-gear-fill',
  FW: 'bi-lightning-fill',
  GOL: 'bi-hand-index-thumb-fill',
  ZAG: 'bi-shield-fill',
  MEI: 'bi-gear-fill',
  ATA: 'bi-lightning-fill',
};

function playerStatus(player: LineupPlayerDTO): string {
  if (player.listed) return 'À venda';
  if (player.inLineup) return 'Escalado';
  return 'Banco';
}

function formatCreated(iso?: string | null): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('pt-BR');
}

function staminaColor(stamina: number) {
  if (stamina >= 70) return 'var(--green)';
  if (stamina >= 40) return 'var(--gold)';
  return 'var(--red)';
}

export function PlayerCardModal({ player, onClose, extraAction }: PlayerCardModalProps) {
  return (
    <AnimatePresence>
      {player && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-x-0 bottom-0 z-[97] flex items-center justify-center overflow-y-auto bg-black/80 p-3 sm:p-4"
          style={{ top: 'var(--app-header-h)', background: 'rgba(0,0,0,0.78)' }}
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.92, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 24 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-5xl max-h-full overflow-y-auto"
          >
            <PlayerCard player={player} onClose={onClose} extraAction={extraAction} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function PlayerCard({ player, onClose, extraAction }: { player: LineupPlayerDTO; onClose: () => void; extraAction?: ReactNode }) {
  const rarityKey = (player.rarity ?? 'common') as ScoutRarity;
  const accent = rarityColor(rarityKey);
  const stamina = player.stamina ?? 100;
  const stake = usePlayerStake();
  const unstake = usePlayerUnstake();
  const [stakeErr, setStakeErr] = useState('');
  const [confirmStake, setConfirmStake] = useState(false);
  const [stakeOverride, setStakeOverride] = useState<{ staked: boolean; stakeGmt: number } | null>(null);

  useEffect(() => {
    setStakeOverride(null);
    setStakeErr('');
    setConfirmStake(false);
  }, [player.id, player.kind, player.staked, player.stakeGmt]);

  const stakeGmt =
    stakeOverride?.stakeGmt ?? player.stakeGmt ?? stakeGmtForRarityName(player.rarity ?? 'common');
  const staked = stakeOverride?.staked ?? Boolean(player.staked);
  const evolution = useQuery({
    queryKey: ['ct-records', player.kind, player.id],
    queryFn: async () => {
      const { data } = await apiClient.get<{
        records: Array<{ id: string; kind: string; before: number | null; after: number | null; detail: string | null; createdAt: string }>;
      }>('/api/ct/records', { params: { playerId: player.id, kind: player.kind } });
      return data.records.filter((row) => row.kind === 'evolution');
    },
  });
  const staminaMax = player.staminaMax ?? 100;
  const staminaPct = Math.max(0, Math.min(100, Math.round((stamina / staminaMax) * 100)));
  const positionLabel = POSITION_LABEL[player.position] ?? player.position;
  const positionEmoji = POSITION_EMOJI[player.position] ?? 'bi-shield-fill';
  const sColor = staminaColor(staminaPct);

  const stakePending = stake.isPending || unstake.isPending;
  const penaltyPct = staked && player.stakedAt ? stakeExitPenaltyPercent(player.stakedAt) : staked ? 30 : null;
  const playerName = player.name?.trim() || positionLabel;

  const runStake = async () => {
    setStakeErr('');
    try {
      const result = staked
        ? await unstake.mutateAsync({ kind: player.kind, playerId: player.id })
        : await stake.mutateAsync({ kind: player.kind, playerId: player.id });
      setStakeOverride({ staked: result.staked, stakeGmt: result.stakeGmt });
      setConfirmStake(false);
    } catch (err: unknown) {
      setConfirmStake(false);
      setStakeErr(translateError(err));
    }
  };

  return (
    <div
      className="relative overflow-hidden"
      style={{
        borderRadius: 4,
        border: `3px solid ${accent}`,
        background: 'linear-gradient(180deg, #1a1d2e 0%, #0d0f1a 100%)',
        boxShadow: `0 0 48px ${accent}55, 0 0 0 1px ${accent}, 0 20px 40px rgba(0,0,0,0.6)`,
      }}
    >
      <div
        aria-hidden
        className="absolute inset-0 opacity-30 pointer-events-none"
        style={{ background: `radial-gradient(ellipse at 20% 40%, ${accent}, transparent 55%)` }}
      />
      <div
        aria-hidden
        className="absolute inset-0 opacity-10 pointer-events-none"
        style={{
          backgroundImage: `repeating-linear-gradient(45deg, ${accent}20 0 2px, transparent 2px 14px)`,
        }}
      />

      <button
        type="button"
        onClick={onClose}
        aria-label="Fechar"
        className="absolute top-3 right-3 z-20 w-9 h-9 flex items-center justify-center rounded-full text-white text-lg transition-transform hover:scale-110"
        style={{ background: 'rgba(0,0,0,0.65)', border: `1px solid ${accent}` }}
      >
        <i className="bi bi-x-lg" aria-hidden />
      </button>

      {/* Horizontal body: art left · info right */}
      <div className="relative flex flex-col sm:flex-row">
        {/* LEFT — portrait */}
        <div
          className="relative shrink-0 flex flex-col sm:w-[340px] md:w-[400px] lg:w-[440px]"
          style={{ borderRight: `1px solid ${accent}40` }}
        >
          <div
            className="flex items-center justify-between gap-2 px-3 py-2"
            style={{
              background: `linear-gradient(90deg, ${accent}35, transparent)`,
              borderBottom: `1px solid ${accent}40`,
            }}
          >
            <span
              className="ui-label-sm px-2 py-1 inline-block"
              style={{
                background: accent,
                color: '#000',
                fontWeight: 700,
                letterSpacing: '0.08em',
                borderRadius: 2,
                boxShadow: `0 0 10px ${accent}`,
              }}
            >
              <i className="bi bi-star-fill" aria-hidden /> {RARITY_LABEL[rarityKey] ?? rarityKey.toUpperCase()}
            </span>
            <div className="text-right pr-8 sm:pr-0">
              <p className="retro-text text-[9px]" style={{ color: '#fff', opacity: 0.65 }}>OVR</p>
              <p className="pixel-text text-2xl leading-none" style={{ color: accent, textShadow: `0 0 10px ${accent}` }}>
                {player.overwall}
              </p>
            </div>
          </div>

          <div
            className="relative mx-auto flex flex-1 items-center justify-center overflow-hidden w-full"
            style={{
              minHeight: 280,
              aspectRatio: '1 / 1',
              maxHeight: 440,
              background: `
                radial-gradient(circle at 50% 40%, ${accent}28 0%, transparent 65%),
                linear-gradient(180deg, #0b0d18 0%, #1a1d2e 100%)
              `,
              boxShadow: `inset 0 0 24px ${accent}35`,
            }}
          >
            {player.imageUrl ? (
              <img
                src={resolveUploadUrl(player.imageUrl)}
                alt={player.name ?? player.position}
                className="w-[88%] h-[88%] object-contain"
                style={{ imageRendering: 'pixelated', filter: `drop-shadow(0 6px 12px ${accent}60)` }}
                draggable={false}
              />
            ) : (
              <i className={`bi ${positionEmoji} text-7xl`} aria-hidden />
            )}

            <div
              className="absolute top-2 left-2 flex items-center gap-1 px-2 py-1"
              style={{ background: 'rgba(0,0,0,0.7)', border: `1px solid ${accent}`, borderRadius: 2 }}
            >
              <i className={`bi ${positionEmoji} text-sm`} aria-hidden />
              <span className="retro-text text-[10px]" style={{ color: '#fff' }}>{player.position}</span>
            </div>
            <div
              className="absolute top-2 right-2 px-2 py-1"
              style={{
                background: 'rgba(60,90,140,0.85)',
                border: '1px solid #7aa0d6',
                borderRadius: 2,
              }}
            >
              <span className="retro-text text-[10px] font-bold" style={{ color: '#fff' }}>
                JOGADOR
              </span>
            </div>
            {hasPlayerAge(player) && (
              <div
                className="absolute bottom-2 left-2 px-2 py-1"
                style={{ background: 'rgba(0,0,0,0.75)', border: '1px solid var(--gold)', borderRadius: 2 }}
              >
                <span className="retro-text text-[10px] font-bold" style={{ color: 'var(--gold)' }}>
                  {player.age} anos
                </span>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT — info */}
        <div className="relative flex min-w-0 flex-1 flex-col gap-3 p-4 sm:p-5">
          <div>
            <p className="retro-text text-xs pr-8" style={{ color: '#fff', opacity: 0.7 }}>
              {positionLabel} · {playerStatus(player)}
            </p>
            {(player.source === 'referral' || player.source === 'social_reward') && (
              <TemporaryNftBadge source={player.source} expiresAt={player.expiresAt ?? null} />
            )}
            {player.source === 'referral_gift' && (
              <div
                className="mt-2 px-3 py-1.5 inline-flex items-center gap-2"
                style={{ background: 'rgba(0,200,120,0.12)', border: '1px solid rgba(0,200,120,0.5)', borderRadius: 2 }}
              >
                <span style={{ color: 'var(--green)' }}><i className="bi bi-gift-fill" aria-hidden /></span>
                <span className="retro-text text-xs" style={{ color: 'var(--green)' }}>
                  BÔNUS DE INDICAÇÃO
                </span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <StatBox label="OVERWALL" value={player.overwall} color={accent} />
            <StatBox label="STAMINA" value={`${staminaPct}%`} color={sColor} />
            <StatBox label="STAKE" value={`${stakeGmt} GMT`} color={staked ? 'var(--green)' : 'var(--gold)'} />
            <StatBox label="PODER" value={player.positionPower ?? player.overwall} color={accent} />
            <StatBox
              label="TIPO"
              value={player.source === 'referral' || player.source === 'social_reward' ? 'TEMPORÁRIO' : 'JOGADOR'}
              color="#7aa0d6"
            />
            {hasPlayerAge(player) && (
              <StatBox label="IDADE" value={`${player.age}`} color="var(--gold)" />
            )}
          </div>

          <div
            className="p-2.5"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: `1px solid ${sColor}40`,
              borderRadius: 2,
            }}
          >
            <div className="flex items-center justify-between retro-text text-[11px] mb-1.5">
              <span style={{ color: '#fff' }}><i className="bi bi-lightning-charge-fill" aria-hidden /> STAMINA</span>
              <span className="pixel-text" style={{ color: sColor }}>{stamina} / {staminaMax}</span>
            </div>
            <div
              className="relative h-3 w-full overflow-hidden"
              style={{ background: 'rgba(0,0,0,0.5)', border: `1px solid ${sColor}80`, borderRadius: 2 }}
            >
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${staminaPct}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className="h-full"
                style={{
                  background: `linear-gradient(90deg, ${sColor} 0%, ${sColor}cc 100%)`,
                  boxShadow: `0 0 10px ${sColor}`,
                }}
              />
            </div>
          </div>

          {player.attributes ? (
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
              {(
                [
                  ['ATK', player.attributes.ataque],
                  ['DEF', player.attributes.defesa],
                  ['PAS', player.attributes.passe],
                  ['VEL', player.attributes.velocidade],
                  ['FIN', player.attributes.finalizacao],
                  ['FRÇ', player.attributes.forca],
                  ['RES', player.attributes.resistencia],
                  ['TÉC', player.attributes.tecnica],
                  ['INT', player.attributes.inteligencia],
                  ...(player.position === 'GK' || player.position === 'GOL'
                    ? [['GOL', player.attributes.goleiro] as const]
                    : []),
                ] as Array<[string, number]>
              ).map(([label, value]) => (
                <div
                  key={label}
                  className="px-1.5 py-1 text-center"
                  style={{ background: 'rgba(0,0,0,0.3)', border: `1px solid ${accent}30`, borderRadius: 2 }}
                >
                  <p className="retro-text text-[8px]" style={{ color: '#fff', opacity: 0.55 }}>{label}</p>
                  <p className="pixel-text text-sm" style={{ color: accent }}>{value}</p>
                </div>
              ))}
            </div>
          ) : null}

          <dl
            className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 retro-text text-[11px]"
            style={{ color: '#fff', borderTop: `1px dashed ${accent}40`, paddingTop: 8 }}
          >
            <dt style={{ opacity: 0.65 }}>ID</dt>
            <dd className="truncate">{player.id}</dd>
            <dt style={{ opacity: 0.65 }}>Dono</dt>
            <dd>{player.ownerName?.trim() || '—'}</dd>
            <dt style={{ opacity: 0.65 }}>Criado</dt>
            <dd>{formatCreated(player.createdAt)}</dd>
            <dt style={{ opacity: 0.65 }}>Stake</dt>
            <dd>{staked ? `ATIVO · ${stakeGmt} GMT` : `SEM STAKE · ${stakeGmt} GMT`}</dd>
            {(evolution.data?.length ?? 0) > 0 ? (
              <>
                <dt style={{ opacity: 0.65 }}>Evolução</dt>
                <dd>
                  <ul className="space-y-0.5">
                    {evolution.data!.slice(0, 4).map((entry) => (
                      <li key={entry.id}>
                        {CT_ATTR[entry.detail ?? ''] ?? entry.detail} {entry.before}→{entry.after}
                      </li>
                    ))}
                  </ul>
                </dd>
              </>
            ) : null}
          </dl>

          <div className="mt-auto space-y-2 pt-1">
            <button
              type="button"
              className={`pixel-btn pixel-btn-md w-full ${staked ? 'pixel-btn-red' : 'pixel-btn-gold'}`}
              disabled={stakePending}
              onClick={() => {
                setStakeErr('');
                setConfirmStake(true);
              }}
            >
              {stakePending
                ? '…'
                : staked
                  ? `REMOVER STAKE (${stakeGmt} GMT)`
                  : `STAKE ${stakeGmt} GMT`}
            </button>
            {penaltyPct != null ? (
              <p className="retro-text text-center text-[11px]" style={{ color: 'var(--gold)' }}>
                Penalidade para tirar agora: {penaltyPct}%
              </p>
            ) : null}
            {confirmStake ? (
              <StakeConfirmDialog
                mode={staked ? 'unstake' : 'stake'}
                playerName={playerName}
                stakeGmt={stakeGmt}
                stakedAt={staked ? player.stakedAt : null}
                pending={stakePending}
                onCancel={() => {
                  if (!stakePending) setConfirmStake(false);
                }}
                onConfirm={() => void runStake()}
              />
            ) : null}
            {stakeErr ? <p className="retro-text text-center text-sm" style={{ color: 'var(--red)' }}>{stakeErr}</p> : null}
            {!staked ? (
              <p className="retro-text text-center text-sm" style={{ color: 'var(--gold)' }}>
                {player.freeField?.state === 'locked'
                  ? 'SEM STAKE: os 5 minutos acabaram. Travado. Só volta a entrar em campo depois de 24 horas.'
                  : player.freeField?.state === 'playing'
                    ? 'SEM STAKE: está em campo agora. Roda 5 minutos e depois trava até completar 24 horas.'
                    : 'SEM STAKE: entra em campo por 5 minutos. Depois trava e só volta a jogar depois de 24 horas. Com stake, joga o tempo todo.'}
              </p>
            ) : null}
            {extraAction ? <div>{extraAction}</div> : null}
            <div
              className="flex items-center justify-between retro-text text-[10px] pt-1"
              style={{ color: '#fff', opacity: 0.5, borderTop: `1px dashed ${accent}30` }}
            >
              <span>MASTER LEGENDS</span>
              <span>#{player.id.slice(0, 8).toUpperCase()}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TemporaryNftBadge({ source, expiresAt }: { source: string; expiresAt: string | null }) {
  const icon = source === 'social_reward' ? 'bi-play-fill' : 'bi-bullseye';
  let timeText = '— expira 30 dias após primeiro uso';
  if (expiresAt) {
    const ms = new Date(expiresAt).getTime() - Date.now();
    const daysLeft = Math.max(0, Math.ceil(ms / 86400000));
    const hoursLeft = Math.max(0, Math.ceil(ms / 3600000));
    if (ms <= 0) timeText = '— EXPIRADA';
    else if (daysLeft === 0) timeText = `— expira em ${hoursLeft}h`;
    else timeText = `— expira em ${daysLeft} dia${daysLeft !== 1 ? 's' : ''}`;
  }
  return (
    <div
      className="mt-2 px-3 py-1.5 inline-flex items-center gap-2"
      style={{ background: 'rgba(255,160,0,0.15)', border: '1px solid rgba(255,160,0,0.6)', borderRadius: 2 }}
    >
        <i className={`bi ${icon}`} style={{ color: '#ffa000' }} aria-hidden />
      <span className="retro-text text-xs" style={{ color: '#ffa000' }}>
        <i className="bi bi-hourglass-split" aria-hidden /> JOGADOR TEMPORÁRIO {timeText}
      </span>
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: string | number; color: string }) {
  const text = String(value);
  const compact = text.length > 6;
  return (
    <div
      className="p-2 text-center"
      style={{
        background: 'rgba(0,0,0,0.35)',
        border: `1px solid ${color}50`,
        borderRadius: 2,
      }}
    >
      <p className="retro-text text-[9px]" style={{ color: '#ffffff', opacity: 0.7, letterSpacing: '0.08em' }}>
        {label}
      </p>
      <p
        className={`pixel-text leading-tight mt-1 ${compact ? 'text-sm' : 'text-lg'}`}
        style={{ color, textShadow: `0 0 8px ${color}80` }}
      >
        {value}
      </p>
    </div>
  );
}

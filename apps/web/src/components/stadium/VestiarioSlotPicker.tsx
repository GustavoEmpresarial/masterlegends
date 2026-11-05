import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import type { InventoryPlayerDTO } from '@mll/shared';
import { PlayerAgeBadge } from '../players/PlayerAgeBadge';
import { resolveUploadUrl } from '../../lib/resolveUploadUrl';
import { playerNickname } from '../../lib/playerNickname';
import { POSITION_EMOJI } from '../../lib/stadiumConstants';
import { rarityGlowCss } from './stadiumBonecoTheme';
import { formatFreeFieldRemain, freeFieldRemainMs } from './FreeFieldNotice';

interface VestiarioSlotPickerProps {
  open: boolean;
  slotLabel?: string;
  slotRole?: string;
  players: InventoryPlayerDTO[];
  assignedKeys: Set<string>;
  onSelect: (player: InventoryPlayerDTO) => void;
  onClose: () => void;
}

const POSITION_LABEL: Record<string, string> = {
  GK: 'GOL',
  DEF: 'ZAG',
  LAT: 'LAT',
  MID: 'MEI',
  FW: 'ATA',
};

function staminaColor(s: number) {
  if (s >= 70) return 'var(--green)';
  if (s >= 40) return 'var(--gold)';
  return 'var(--red)';
}

export function VestiarioSlotPicker({
  open,
  slotLabel,
  slotRole,
  players,
  assignedKeys,
  onSelect,
  onClose,
}: VestiarioSlotPickerProps) {
  const { t } = useTranslation(['club', 'common']);
  const [stakeHint, setStakeHint] = useState('');

  useEffect(() => {
    if (!open) setStakeHint('');
  }, [open, slotLabel]);

  const available = useMemo(
    () =>
      players
        .filter((p) => {
          if (assignedKeys.has(`${p.kind}:${p.id}`)) return false;
          if (!slotRole || slotRole === 'DECOR') return true;
          return p.position === slotRole;
        })
        .sort((a, b) => {
          const stakeDiff = Number(Boolean(b.staked)) - Number(Boolean(a.staked));
          if (stakeDiff !== 0) return stakeDiff;
          return (b.overwall ?? 0) - (a.overwall ?? 0);
        }),
    [players, assignedKeys, slotRole],
  );

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="vestiario-slot-picker"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[98] flex items-end sm:items-center justify-center p-0 sm:p-4"
          style={{ background: 'rgba(0, 0, 0, 0.72)' }}
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-labelledby="vestiario-slot-picker-title"
        >
          <motion.div
            initial={{ y: '100%', opacity: 0.9 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0.9 }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            className="w-full sm:max-w-md pixel-card rounded-t-lg sm:rounded-lg max-h-[min(85dvh,640px)] flex flex-col"
            style={{ borderColor: 'var(--blue)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-white/10 px-4 py-3 shrink-0">
              <div className="min-w-0">
                <h2
                  id="vestiario-slot-picker-title"
                  className="ui-label-sm truncate"
                  style={{ color: 'var(--blue)' }}
                >
                  {t('club:vestiario.pickPlayerTitle')}
                </h2>
                {slotLabel && (
                  <p className="retro-text text-xs mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>
                    {t('club:vestiario.pickPlayerSlot', { slot: slotLabel })}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="pixel-btn pixel-btn-sm shrink-0"
                style={{ background: 'var(--bg-light)', borderColor: 'var(--bg-lighter)' }}
                aria-label={t('common:actions.close')}
              >
                <i className="bi bi-x-lg" aria-hidden />
              </button>
            </div>

            <div className="overflow-y-auto px-3 py-3 space-y-2 flex-1 min-h-0">
              <p className="retro-text text-sm text-center" style={{ color: 'var(--gold)' }}>
                {t('club:freeField.body')}
              </p>
              {stakeHint && (
                <p className="retro-text text-sm text-center" style={{ color: 'var(--red)' }}>
                  {stakeHint}
                </p>
              )}
              {available.length === 0 ? (
                <p className="retro-text text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>
                  {t('club:vestiario.pickPlayerEmpty')}
                </p>
              ) : (
                available.map((player) => (
                  <PickerPlayerRow
                    key={`${player.kind}-${player.id}`}
                    player={player}
                    onSelect={onSelect}
                    onNeedStake={() => {
                      const time = formatFreeFieldRemain(freeFieldRemainMs(player.freeField?.nextPlayAt));
                      setStakeHint(t('club:freeField.locked', { time }));
                    }}
                  />
                ))
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function PickerPlayerRow({
  player,
  onSelect,
  onNeedStake,
}: {
  player: InventoryPlayerDTO;
  onSelect: (player: InventoryPlayerDTO) => void;
  onNeedStake: () => void;
}) {
  const stamina = player.stamina ?? 100;
  const staminaMax = player.staminaMax ?? 100;
  const pct = Math.max(0, Math.min(100, Math.round((stamina / staminaMax) * 100)));
  const sColor = staminaColor(pct);

  return (
    <button
      type="button"
      onClick={() => {
        if (!player.staked && player.freeField?.state === 'locked') {
          onNeedStake();
          return;
        }
        onSelect(player);
      }}
      className="flex w-full items-center gap-3 p-2 text-left transition-transform active:scale-[0.98] hover:translate-x-0.5 disabled:opacity-45 disabled:hover:translate-x-0"
      style={{
        background: 'linear-gradient(90deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))',
        border: `2px solid ${player.staked ? `${sColor}55` : 'rgba(255,255,255,0.15)'}`,
        borderRadius: 3,
      }}
    >
      <div
        className="shrink-0 relative overflow-hidden flex items-center justify-center"
        style={{
          width: 52,
          height: 52,
          background: `radial-gradient(circle at 50% 35%, ${sColor}25, transparent 70%), #0f1622`,
          border: `2px solid ${sColor}`,
          borderRadius: 3,
        }}
      >
        {player.imageUrl ? (
          <img
            src={resolveUploadUrl(player.imageUrl)}
            alt=""
            className="w-full h-full object-contain"
            style={{ imageRendering: 'pixelated' }}
            draggable={false}
          />
        ) : (
          <i className={`bi ${POSITION_EMOJI[player.position] ?? 'bi-shield-fill'}`} style={{ fontSize: 24 }} aria-hidden />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <p className="retro-text text-sm truncate" style={{ color: rarityGlowCss(player.rarity), fontWeight: 600 }}>
            {playerNickname(player.name, player.id, player.position)} · {player.overwall}
          </p>
          <PlayerAgeBadge player={player} />
        </div>
        <p className="retro-text text-[10px] truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>
          {POSITION_LABEL[player.position] ?? player.position}
          {' · '}
          {player.staked
            ? `STAKE ${player.stakeGmt ?? '?'} GMT`
            : player.freeField?.state === 'locked'
              ? 'SEM STAKE · TRAVADO 24H'
              : player.freeField?.state === 'playing'
                ? 'SEM STAKE · RODANDO 5 MIN'
                : 'SEM STAKE · 5 MIN A CADA 24H'}
        </p>
        <div className="mt-1.5 flex items-center gap-2">
          <div
            className="relative h-1.5 flex-1 overflow-hidden"
            style={{ background: 'rgba(0,0,0,0.45)', borderRadius: 2, border: `1px solid ${sColor}60` }}
          >
            <div
              className="h-full"
              style={{ width: `${pct}%`, background: sColor, boxShadow: `0 0 4px ${sColor}` }}
            />
          </div>
          <span className="pixel-text text-[10px] tabular-nums shrink-0" style={{ color: sColor }}>
            {stamina}/{staminaMax}
          </span>
        </div>
      </div>
    </button>
  );
}

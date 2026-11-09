import { GearSprite } from '../gear/GearSprite';
import { useEffect, type DragEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  GEAR_SLOTS,
  GearSlot,
  PLAYER_CAREER_RETIRE_AGE,
  PLAYER_CAREER_START_AGE,
  type GearSlotType,
  type InventoryPlayerDTO,
  type UserGearDTO,
} from '@mll/shared';
import { resolveUploadUrl } from '../../lib/resolveUploadUrl';
import { rarityColor, type ScoutRarity } from '../scout/scoutMintConstants';
import { usePlayerGearDraft, type SlotItem } from './usePlayerGearDraft';

const RARITY_LABEL: Record<string, string> = {
  common: 'COMUM',
  rare: 'RARO',
  'super-rare': 'S.RARO',
  epic: 'ÉPICO',
  legendary: 'LENDÁRIO',
};

const POSITION_LABEL: Record<string, string> = {
  GK: 'Goleiro',
  DEF: 'Defensor',
  MID: 'Meio-Campo',
  FW: 'Atacante',
};

const SLOT_META: Record<
  GearSlotType,
  { emoji: string; labelKey: string; accent: string }
> = {
  [GearSlot.GLOVES]: { emoji: 'bi-hand-index-thumb-fill', labelKey: 'club:gear.gloves', accent: '#5eead4' },
  [GearSlot.SHINGUARDS]: { emoji: 'bi-shield-fill', labelKey: 'club:gear.shinguards', accent: '#fbbf24' },
  [GearSlot.BOOTS]: { emoji: 'bi-bag-fill', labelKey: 'club:gear.boots', accent: '#4ade80' },
};

const DRAG_GEAR_MIME = 'application/x-mll-gear';

function staminaColor(pct: number) {
  if (pct >= 70) return '#4ade80';
  if (pct >= 40) return '#fbbf24';
  return '#f87171';
}

/** Compact USDC for career card — avoid "0.0000". */
function formatUsdcShort(n: number): string {
  if (!Number.isFinite(n) || n === 0) return '0 USDC';
  if (n >= 100) return `${n.toFixed(0)} USDC`;
  if (n >= 1) return `${n.toFixed(2)} USDC`;
  if (n >= 0.01) return `${n.toFixed(2)} USDC`;
  return `${n.toFixed(4)} USDC`;
}

function formatRoiPct(n: number): string {
  if (!Number.isFinite(n) || n === 0) return '0%';
  if (Number.isInteger(n)) return `${n}%`;
  return `${n.toFixed(1)}%`;
}

export function PlayerInventorySheet({
  player,
  onClose,
}: {
  player: InventoryPlayerDTO | null;
  onClose: () => void;
}) {
  // Must portal out of Layout's `relative z-10` shell — otherwise sticky Header (z-96)
  // always paints on top of any modal z-index inside the page outlet.
  useEffect(() => {
    if (!player) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [player]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {player && (
        <motion.div
          key={`inv-sheet-${player.id}-${player.kind}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-x-0 bottom-0 z-[210] flex items-end sm:items-center justify-center p-2 sm:p-4"
          style={{
            // Header height + bottom border/shadow so the panel never tucks under the bar
            top: 'calc(var(--app-header-h) + 6px)',
            background: 'rgba(0,0,0,0.88)',
          }}
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label="Inventário do jogador"
        >
          <motion.div
            initial={{ y: 48, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 32, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            className="game-surface relative w-full max-w-6xl flex flex-col overflow-hidden"
            style={{
              height: 'calc(100dvh - var(--app-header-h) - 1.25rem)',
              maxHeight: 'calc(100dvh - var(--app-header-h) - 1.25rem)',
              borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.12)',
              background:
                'var(--game-panel)',
              boxShadow: '0 28px 90px rgba(0,0,0,0.7)',
            }}
          >
            <SheetBody player={player} onClose={onClose} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function SheetBody({ player, onClose }: { player: InventoryPlayerDTO; onClose: () => void }) {
  const { t } = useTranslation(['club', 'common', 'inventory']);
  const gear = usePlayerGearDraft(player);

  const rarityKey = (player.rarity ?? 'common') as ScoutRarity;
  const accent = rarityColor(rarityKey);
  const stamina = player.stamina ?? 100;
  const staminaMax = player.staminaMax ?? 100;
  const staminaPct = Math.max(0, Math.min(100, Math.round((stamina / staminaMax) * 100)));
  const sColor = staminaColor(staminaPct);
  const positionLabel = POSITION_LABEL[player.position] ?? player.position;
  const displayName = player.name?.trim() || positionLabel;
  const costBasis = player.costBasisUsdc ?? 0;
  const earned = player.lifetimeEarnedUsdc ?? 0;
  const hasCareer = player.kind === 'base' && costBasis > 0;
  const age = player.age ?? PLAYER_CAREER_START_AGE;
  const retireAge = player.retireAge ?? PLAYER_CAREER_RETIRE_AGE;
  const roiPct = player.roiPct ?? 0;
  const careerPct = Math.min(
    100,
    Math.max(0, ((age - PLAYER_CAREER_START_AGE) / (PLAYER_CAREER_RETIRE_AGE - PLAYER_CAREER_START_AGE)) * 100),
  );
  const retireAtUsdc = costBasis * 2;

  function onDragStart(e: DragEvent, g: UserGearDTO) {
    e.dataTransfer.setData(DRAG_GEAR_MIME, g.id);
    e.dataTransfer.setData('text/plain', g.id);
    e.dataTransfer.effectAllowed = 'move';
  }

  function onSlotDrop(e: DragEvent, slot: GearSlotType) {
    e.preventDefault();
    gear.setDragOverSlot(null);
    const id = e.dataTransfer.getData(DRAG_GEAR_MIME) || e.dataTransfer.getData('text/plain');
    if (id) gear.assignToSlot(slot, id);
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <header
        className="flex items-start justify-between gap-3 px-4 sm:px-6 py-4 shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}
      >
        <div className="min-w-0">
          <h2
            className="pixel-text truncate leading-none"
            style={{
              fontSize: 'clamp(1.75rem, 4vw, 2.25rem)',
              color: accent,
              textShadow: `0 0 20px ${accent}55`,
            }}
          >
            {displayName}
          </h2>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-label" style={{ color: '#ffffff' }}>
              #{player.id.slice(0, 8)}
            </span>
            <Pill bg={accent} color="#0a0c12">
              {RARITY_LABEL[rarityKey] ?? rarityKey.toUpperCase()}
            </Pill>
            <Pill bg="rgba(255,255,255,0.1)" color="#fff">
              {player.position} · {positionLabel}
            </Pill>
            <Pill bg="rgba(96,165,250,0.25)" color="#bfdbfe">
              JOGADOR
            </Pill>
            {player.inLineup && (
              <Pill bg="rgba(74,222,128,0.2)" color="#86efac">
                {t('club:gear.inLineup')}
              </Pill>
            )}
            {hasCareer && (
              <Pill bg="rgba(240,200,40,0.22)" color="var(--gold)">
                {age} anos
              </Pill>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="w-12 h-12 shrink-0 flex items-center justify-center text-xl"
          style={{
            borderRadius: 10,
            background: 'rgba(0,0,0,0.5)',
            border: '1px solid rgba(255,255,255,0.2)',
            color: '#fff',
          }}
        >
          <i className="bi bi-x-lg" aria-hidden />
        </button>
      </header>

      {/* Scrollable body */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-0">
          {/* LEFT */}
          <aside
            className="px-4 sm:px-6 py-5 flex flex-col gap-5"
            style={{ borderRight: '1px solid rgba(255,255,255,0.08)' }}
          >
            <div className="flex flex-col sm:flex-row lg:flex-col items-center gap-4">
              <div
                className="relative flex items-center justify-center overflow-hidden w-full max-w-[260px] aspect-square shrink-0"
                style={{
                  borderRadius: 14,
                  border: `3px solid ${accent}`,
                  background: `
                    radial-gradient(circle at 50% 30%, ${accent}28 0%, transparent 55%),
                    linear-gradient(180deg, #1a2030 0%, #0b0e16 100%)
                  `,
                  boxShadow: `0 0 36px ${accent}30`,
                }}
              >
                {player.imageUrl ? (
                  <img
                    src={resolveUploadUrl(player.imageUrl)}
                    alt={displayName}
                    className="w-[88%] h-[88%] object-contain"
                    style={{
                      imageRendering: 'pixelated',
                      filter: `drop-shadow(0 10px 18px ${accent}50)`,
                    }}
                    draggable={false}
                  />
                ) : (
                  <span className="text-7xl"><i className="bi bi-shield-fill" aria-hidden /></span>
                )}
                <span
                  className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1 text-label font-bold"
                  style={{
                    background: 'rgba(0,0,0,0.8)',
                    border: `2px solid ${accent}`,
                    borderRadius: 6,
                    color: accent,
                  }}
                >
                  OVR {gear.effectiveOw}
                </span>
              </div>

              {/* Slots row */}
              <div className="grid grid-cols-3 gap-3 w-full max-w-md lg:max-w-none">
                {([GearSlot.GLOVES, GearSlot.SHINGUARDS, GearSlot.BOOTS] as const).map((slot) => (
                  <SlotCard
                    key={slot}
                    slot={slot}
                    item={gear.resolveSlotItem(slot)}
                    busy={gear.busy}
                    dragOver={gear.dragOverSlot === slot}
                    label={t(SLOT_META[slot].labelKey)}
                    emptyHint={t('club:gear.tapOrDrop')}
                    removeLabel={t('club:gear.removeSlot')}
                    onClick={() => {
                      if (gear.draft[slot]) gear.clearSlot(slot);
                      else gear.setFilter(slot);
                    }}
                    onRemove={() => gear.clearSlot(slot)}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                      gear.setDragOverSlot(slot);
                    }}
                    onDragLeave={() =>
                      gear.setDragOverSlot((s) => (s === slot ? null : s))
                    }
                    onDrop={(e) => onSlotDrop(e, slot)}
                  />
                ))}
              </div>
            </div>

            {/* Career life — age as ROI metaphor */}
            {player.kind === 'base' && (
              <div
                className="p-4 sm:p-5"
                style={{
                  borderRadius: 12,
                  background: hasCareer
                    ? 'linear-gradient(135deg, rgba(240,200,40,0.18), rgba(0,0,0,0.5))'
                    : 'rgba(0,0,0,0.4)',
                  border: hasCareer
                    ? '2px solid var(--gold)'
                    : '2px solid rgba(255,255,255,0.2)',
                }}
              >
                {hasCareer ? (
                  <>
                    <div className="flex justify-between items-center gap-3">
                      <div className="min-w-0">
                        <p
                          className="font-bold uppercase tracking-wide"
                          style={{ color: 'var(--gold)', fontSize: 15 }}
                        >
                          Idade
                        </p>
                        <p
                          className="mt-1 leading-snug"
                          style={{ color: '#ffffff', fontSize: 14 }}
                        >
                          Sobe no XI · aos {retireAge} vai ao Museu
                        </p>
                      </div>
                      <p
                        className="pixel-text leading-none shrink-0"
                        style={{ fontSize: '2.1rem', color: 'var(--gold)' }}
                      >
                        {age}
                        <span style={{ fontSize: '1.05rem', color: '#ffffff' }}>
                          /{retireAge}
                        </span>
                      </p>
                    </div>

                    <div
                      className="h-4 mt-4 overflow-hidden"
                      style={{
                        background: 'rgba(0,0,0,0.55)',
                        borderRadius: 6,
                        border: '1px solid rgba(240,200,40,0.55)',
                      }}
                    >
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${careerPct}%` }}
                        transition={{ duration: 0.6, ease: 'easeOut' }}
                        className="h-full"
                        style={{
                          background: 'linear-gradient(90deg, var(--gold-dark), var(--gold))',
                        }}
                      />
                    </div>

                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      {[
                        { label: 'Custo', value: formatUsdcShort(costBasis) },
                        { label: 'Já rendeu', value: formatUsdcShort(earned) },
                        { label: 'Aposenta em', value: formatUsdcShort(retireAtUsdc) },
                      ].map((cell) => (
                        <div
                          key={cell.label}
                          className="px-3 py-2.5 text-center"
                          style={{
                            borderRadius: 10,
                            background: 'rgba(0,0,0,0.45)',
                            border: '1px solid rgba(255,255,255,0.14)',
                          }}
                        >
                          <p
                            className="font-semibold"
                            style={{ fontSize: 13, color: '#ffffff' }}
                          >
                            {cell.label}
                          </p>
                          <p
                            className="mt-1 font-bold tabular-nums"
                            style={{ color: '#fff', fontSize: 16 }}
                          >
                            {cell.value}
                          </p>
                        </div>
                      ))}
                    </div>

                    <p
                      className="mt-3 text-center font-medium"
                      style={{ fontSize: 14, color: '#ffffff' }}
                    >
                      {Math.round(careerPct)}% da carreira · retorno {formatRoiPct(roiPct)}
                    </p>
                  </>
                ) : (
                  <p style={{ color: '#ffffff', fontSize: 15, lineHeight: 1.45 }}>
                    Jogador grátis / indicação — sem ciclo de idade. Só scouts e compras do
                    marketplace envelhecem.
                  </p>
                )}
              </div>
            )}

            {/* Stats — 2 big blocks */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div
                className="p-4"
                style={{
                  borderRadius: 12,
                  background: 'rgba(0,0,0,0.4)',
                  border: `2px solid ${accent}55`,
                }}
              >
                <p className="text-label" style={{ color: '#ffffff' }}>
                  OVERWALL
                </p>
                <p
                  className="pixel-text mt-1"
                  style={{ fontSize: '2.25rem', color: accent, lineHeight: 1 }}
                >
                  {gear.effectiveOw}
                </p>
                <p className="text-body mt-1" style={{ color: '#ffffff' }}>
                  {t('club:gear.infoBaseOw')} {gear.baseOw}
                  {gear.draftOw > 0 ? ` · gear +${gear.draftOw}` : ''}
                </p>
              </div>
              <div
                className="p-4"
                style={{
                  borderRadius: 12,
                  background: 'rgba(0,0,0,0.4)',
                  border: `2px solid ${sColor}55`,
                }}
              >
                <div className="flex justify-between items-baseline gap-2">
                  <p className="text-label" style={{ color: '#ffffff' }}>
                    STAMINA
                  </p>
                  <p className="pixel-text" style={{ fontSize: '1.75rem', color: sColor }}>
                    {staminaPct}%
                  </p>
                </div>
                <p className="text-body mt-1 mb-2" style={{ color: '#ffffff' }}>
                  {stamina} / {staminaMax}
                </p>
                <div
                  className="h-4 overflow-hidden"
                  style={{
                    background: 'rgba(0,0,0,0.55)',
                    borderRadius: 6,
                    border: `1px solid ${sColor}66`,
                  }}
                >
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${staminaPct}%` }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                    className="h-full"
                    style={{
                      background: `linear-gradient(90deg, ${sColor}, ${sColor}aa)`,
                      boxShadow: `0 0 12px ${sColor}`,
                    }}
                  />
                </div>
              </div>
            </div>
          </aside>

          {/* RIGHT — bag */}
          <section className="px-4 sm:px-6 py-5 flex flex-col gap-4 min-h-[280px]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-label" style={{ color: '#fff', letterSpacing: '0.08em' }}>
                {t('club:gear.bag').toUpperCase()}
              </h3>
              <p className="text-body" style={{ color: '#ffffff' }}>
                {t('club:gear.oneClickHint')}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {(
                [
                  ['all', t('club:gear.filterAll')],
                  [GearSlot.BOOTS, t('club:gear.boots')],
                  [GearSlot.GLOVES, t('club:gear.gloves')],
                  [GearSlot.SHINGUARDS, t('club:gear.shinguards')],
                ] as const
              ).map(([key, label]) => {
                const active = gear.filter === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => gear.setFilter(key)}
                    className="px-3 py-2 text-label"
                    style={{
                      borderRadius: 8,
                      minHeight: 44,
                      border: active ? '2px solid #4ade80' : '2px solid rgba(255,255,255,0.15)',
                      background: active ? 'rgba(74,222,128,0.15)' : 'rgba(0,0,0,0.35)',
                      color: active ? '#86efac' : '#fff',
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            {/* Equipped summary */}
            {gear.equippedList.length > 0 && (
              <div>
                <p className="text-label mb-2" style={{ color: '#ffffff' }}>
                  {t('club:gear.equippedList')}
                </p>
                <ul className="space-y-2">
                  {gear.equippedList.map(({ slot, item }) => (
                    <li
                      key={slot}
                      className="flex items-center gap-3 px-3 py-2"
                      style={{
                        background: 'rgba(0,0,0,0.35)',
                        borderRadius: 10,
                        border: `1px solid ${SLOT_META[slot].accent}44`,
                      }}
                    >
                      <i className={`bi ${SLOT_META[slot].emoji} text-2xl`} aria-hidden />
                      {item.imageUrl && (
                        <GearSprite src={resolveUploadUrl(item.imageUrl)} className="w-24 shrink-0" style={{ borderRadius: 6 }} />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-body truncate" style={{ color: '#fff' }}>
                          {t(`club:${item.nameKey}`, { defaultValue: item.nameKey })}
                        </p>
                        <p className="text-label" style={{ color: SLOT_META[slot].accent }}>
                          {t(SLOT_META[slot].labelKey)} · {t('club:gear.bonus', { ow: item.owBonus, unit: '' })}
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={gear.busy}
                        onClick={() => gear.clearSlot(slot)}
                        className="px-3 py-2 text-label shrink-0"
                        style={{
                          minHeight: 44,
                          borderRadius: 8,
                          border: '2px solid rgba(248,113,113,0.5)',
                          color: '#fca5a5',
                          background: 'rgba(248,113,113,0.1)',
                        }}
                      >
                        {t('club:gear.removeSlot')}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Bag list */}
            <div
              className="flex-1 min-h-[160px] overflow-y-auto p-2 space-y-2"
              style={{
                background: 'rgba(0,0,0,0.35)',
                borderRadius: 12,
                border: '1px solid rgba(255,255,255,0.1)',
              }}
            >
              {gear.bagLoading && (
                <p className="text-body text-center py-10" style={{ color: '#ffffff' }}>
                  …
                </p>
              )}
              {!gear.bagLoading && gear.bagItems.length === 0 && (
                <div className="flex flex-col items-center justify-center gap-4 py-10 px-4 text-center">
                  <p className="text-body" style={{ color: '#fff' }}>
                    {t('club:gear.bagEmpty')}
                  </p>
                  <Link
                    to="/club/shop"
                    onClick={onClose}
                    className="inline-flex items-center justify-center px-5 py-3 text-label font-bold"
                    style={{
                      minHeight: 52,
                      borderRadius: 10,
                      background: 'linear-gradient(180deg, rgba(74,222,128,0.4), rgba(22,163,74,0.5))',
                      border: '2px solid #4ade80',
                      color: '#ecfdf5',
                      boxShadow: '0 0 24px rgba(74,222,128,0.25)',
                    }}
                  >
                    {t('club:gear.goShop')}
                  </Link>
                </div>
              )}
              {gear.bagItems.map((g) => {
                const meta = SLOT_META[g.slot];
                const inDraft = GEAR_SLOTS.some((s) => gear.draft[s] === g.id);
                return (
                  <button
                    key={g.id}
                    type="button"
                    draggable={!gear.busy}
                    disabled={gear.busy}
                    onDragStart={(e) => onDragStart(e, g)}
                    onClick={() => gear.equipFromBag(g)}
                    className="flex w-full items-center gap-3 px-3 py-3 text-left transition-transform hover:scale-[1.01]"
                    style={{
                      borderRadius: 10,
                      cursor: 'pointer',
                      border: `2px solid ${inDraft ? meta.accent : 'rgba(255,255,255,0.12)'}`,
                      background: inDraft ? `${meta.accent}18` : 'rgba(18,22,30,0.95)',
                      minHeight: 72,
                    }}
                  >
                    {g.imageUrl ? (
                      <GearSprite src={resolveUploadUrl(g.imageUrl)} className="w-24 shrink-0 pointer-events-none" style={{ borderRadius: 6 }} />
                    ) : (
                      <span className="text-3xl w-14 text-center shrink-0 pointer-events-none">
                        <i className={`bi ${meta.emoji}`} aria-hidden />
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-body truncate" style={{ color: '#fff' }}>
                        {t(`club:${g.nameKey}`, { defaultValue: g.nameKey })}
                      </p>
                      <p className="text-label" style={{ color: '#ffffff' }}>
                        {t(meta.labelKey)}
                        {inDraft ? ` · ${t('club:gear.inLoadout')}` : ''}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="pixel-text" style={{ fontSize: '1.5rem', color: '#4ade80' }}>
                        {t('club:gear.bonusCompact', { ow: g.owBonus, unit: '' })}
                      </p>
                      <p className="text-label" style={{ color: '#ffffff' }}>
                        {t('club:gear.powerTarget')}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            {gear.err && (
              <p className="text-body text-center" style={{ color: '#fca5a5' }}>
                {gear.err}
              </p>
            )}
          </section>
        </div>
      </div>

      {/* Sticky footer */}
      <footer
        className="shrink-0 px-4 sm:px-6 py-3 flex flex-col gap-2"
        style={{
          borderTop: '1px solid rgba(255,255,255,0.1)',
          background: 'rgba(8,10,16,0.95)',
        }}
      >
        <div className="flex gap-3">
          <button
            type="button"
            disabled={!gear.dirty || gear.busy}
            onClick={gear.discard}
            className="flex-1 text-label"
            style={{
              minHeight: 52,
              borderRadius: 10,
              border: '2px solid rgba(255,255,255,0.2)',
              background: 'rgba(0,0,0,0.4)',
              color: gear.dirty ? '#fff' : 'rgba(255,255,255,0.35)',
              opacity: !gear.dirty || gear.busy ? 0.5 : 1,
            }}
          >
            {t('club:gear.discard')}
          </button>
          <button
            type="button"
            disabled={!gear.dirty || gear.busy}
            onClick={() => void gear.save()}
            className="flex-[1.4] text-label font-bold"
            style={{
              minHeight: 52,
              borderRadius: 10,
              border: gear.dirty ? '2px solid #4ade80' : '2px solid rgba(255,255,255,0.1)',
              background: gear.dirty
                ? 'linear-gradient(180deg, rgba(74,222,128,0.45), rgba(22,163,74,0.55))'
                : 'rgba(0,0,0,0.4)',
              color: gear.dirty ? '#ecfdf5' : 'rgba(255,255,255,0.35)',
              boxShadow: gear.dirty ? '0 0 28px rgba(74,222,128,0.3)' : undefined,
              opacity: !gear.dirty || gear.busy ? 0.55 : 1,
            }}
          >
            {gear.busy
              ? t('club:gear.saving')
              : gear.savedFlash
                ? t('club:gear.saved')
                : t('club:gear.save')}
          </button>
        </div>
        <Link
          to="/marketplace"
          onClick={onClose}
          className="text-center text-label py-2"
          style={{ color: 'rgba(251,191,36,0.9)' }}
        >
          {t('club:gear.sellMarketplace')} →
        </Link>
      </footer>
    </div>
  );
}

function SlotCard({
  slot,
  item,
  busy,
  dragOver,
  label,
  emptyHint,
  removeLabel,
  onClick,
  onRemove,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  slot: GearSlotType;
  item: SlotItem | null;
  busy: boolean;
  dragOver: boolean;
  label: string;
  emptyHint: string;
  removeLabel: string;
  onClick: () => void;
  onRemove: () => void;
  onDragOver: (e: DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: DragEvent) => void;
}) {
  const { t } = useTranslation(['club']);
  const meta = SLOT_META[slot];

  return (
    <div
      className="flex flex-col items-stretch"
      style={{ minHeight: 112 }}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <button
        type="button"
        disabled={busy}
        onClick={onClick}
        className="flex-1 flex flex-col items-center justify-center gap-1 px-2 py-3 transition-transform"
        style={{
          minHeight: 96,
          borderRadius: 12,
          border: `3px ${item ? 'solid' : 'dashed'} ${dragOver ? meta.accent : item ? meta.accent : 'rgba(255,255,255,0.25)'}`,
          background: dragOver
            ? `${meta.accent}28`
            : item
              ? 'rgba(0,0,0,0.5)'
              : 'rgba(255,255,255,0.04)',
          boxShadow: dragOver ? `0 0 20px ${meta.accent}55` : undefined,
          transform: dragOver ? 'scale(1.04)' : undefined,
        }}
      >
        {item?.imageUrl ? (
          <GearSprite src={resolveUploadUrl(item.imageUrl)} className="w-full" style={{ borderRadius: 6 }} />
        ) : (
          <i className={`bi ${meta.emoji} text-3xl`} style={{ opacity: 0.7 }} aria-hidden />
        )}
        <span className="text-label text-center" style={{ color: meta.accent }}>
          {label}
        </span>
        {item ? (
          <>
            <span className="text-body text-center truncate w-full px-1" style={{ color: '#fff' }}>
              {item.owBonus > 0 ? t('club:gear.bonusCompact', { ow: item.owBonus, unit: '' }) : '—'}
            </span>
          </>
        ) : (
          <span className="text-label text-center px-1" style={{ color: '#ffffff' }}>
            {emptyHint}
          </span>
        )}
      </button>
      {item && (
        <button
          type="button"
          disabled={busy}
          onClick={onRemove}
          className="mt-1 py-1 text-label"
          style={{ color: '#fca5a5', minHeight: 36 }}
        >
          {removeLabel}
        </button>
      )}
    </div>
  );
}

function Pill({ children, bg, color }: { children: ReactNode; bg: string; color: string }) {
  return (
    <span
      className="text-label px-2.5 py-1 font-bold"
      style={{ background: bg, color, borderRadius: 6 }}
    >
      {children}
    </span>
  );
}

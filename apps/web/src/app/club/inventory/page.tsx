import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import type { InventoryPlayerDTO } from '@mll/shared';
import { useInventory } from '../../../hooks/useApi';
import { resolveUploadUrl } from '../../../lib/resolveUploadUrl';
import { ScoutRevealCard, buildRarityConfig } from '../../../components/scout/ScoutRevealCard';
import { PlayerInventorySheet } from '../../../components/inventory/PlayerInventorySheet';
import { POSITION_EMOJI } from '../../../lib/stadiumConstants';
import { PageContentShell } from '../../../components/content';

const POSITION_SPRITES: Record<string, string> = POSITION_EMOJI;

const TEMP_SOURCE_CONFIG: Record<string, { icon: string; label: string; color: string }> = {
  referral: { icon: 'bi-bullseye', label: 'Indicação', color: 'var(--gold)' },
  social_reward: { icon: '▶', label: 'YouTube', color: '#ff4444' },
};

function TemporaryBadge({ player }: { player: InventoryPlayerDTO }) {
  if (player.listed) return null;
  const src = TEMP_SOURCE_CONFIG[player.source ?? ''];
  if (!src && player.source !== 'referral_gift') return null;
  if (!src) return null;

  const daysLeft = player.expiresAt
    ? Math.max(0, Math.ceil((Date.parse(player.expiresAt) - Date.now()) / 86400000))
    : null;

  const hoursLeft =
    player.expiresAt && daysLeft === 0
      ? Math.max(0, Math.ceil((Date.parse(player.expiresAt) - Date.now()) / 3600000))
      : null;

  const isExpired = daysLeft === 0 && hoursLeft === 0;
  const isUrgent = !isExpired && daysLeft !== null && daysLeft <= 3;

  const timeLabel = isExpired
    ? 'Expirado'
    : daysLeft === 0 && hoursLeft !== null
      ? `${hoursLeft}h`
      : daysLeft !== null
        ? `${daysLeft}d`
        : '~30d';

  const color = isExpired ? 'var(--red)' : isUrgent ? 'var(--orange)' : src.color;

  return (
    <span
      className="absolute top-2 left-2 pixel-badge z-10 flex items-center gap-0.5"
      style={{ borderColor: color, color, fontSize: '10px' }}
    >
      {src.icon} <span className="font-bold">{timeLabel}</span>
    </span>
  );
}

function sortPlayers(list: InventoryPlayerDTO[], sortBy: 'overwall' | 'recent') {
  const sorted = [...list];
  if (sortBy === 'recent') {
    sorted.sort((a, b) => {
      const aTime = a.createdAt ? Date.parse(a.createdAt) : 0;
      const bTime = b.createdAt ? Date.parse(b.createdAt) : 0;
      if (bTime !== aTime) return bTime - aTime;
      return (b.effectiveOverwall ?? b.overwall) - (a.effectiveOverwall ?? a.overwall);
    });
    return sorted;
  }
  sorted.sort(
    (a, b) => (b.effectiveOverwall ?? b.overwall) - (a.effectiveOverwall ?? a.overwall),
  );
  return sorted;
}

export function InventoryPage() {
  const { t } = useTranslation(['inventory', 'scout', 'common', 'club']);
  const { data, isLoading } = useInventory();
  const [rarityFilter, setRarityFilter] = useState('all');
  const [positionFilter, setPositionFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'overwall' | 'recent'>('recent');
  const [selected, setSelected] = useState<InventoryPlayerDTO | null>(null);

  const rarityConfig = useMemo(() => buildRarityConfig((key) => t(`scout:${key}`)), [t]);

  const players = data?.players ?? [];

  const filtered = useMemo(() => {
    let list: InventoryPlayerDTO[] = [...players];
    if (rarityFilter !== 'all') {
      list = list.filter((p) => p.rarity === rarityFilter);
    }
    if (positionFilter !== 'all') {
      list = list.filter((p) => p.position === positionFilter);
    }
    return sortPlayers(list, sortBy);
  }, [players, rarityFilter, positionFilter, sortBy]);

  const totalOverwall = players.filter((p) => !p.listed).reduce((sum, p) => sum + p.overwall, 0);

  // Keep selected player in sync after equip/unequip refreshes inventory
  const selectedLive = selected
    ? (players.find((p) => p.id === selected.id && p.kind === selected.kind) ?? selected)
    : null;

  if (isLoading) {
    return (
      <div className="pixel-card text-center py-16">
        <p className="retro-text text-xl" style={{ color: 'var(--text-muted)' }}>
          {t('common:labels.status.loading')}
        </p>
      </div>
    );
  }

  return (
    <PageContentShell>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="pixel-text text-xl sm:text-2xl md:text-3xl" style={{ color: 'var(--blue)' }}>
          <i className="bi bi-people-fill" aria-hidden /> {t('inventory:title')}
        </h1>
        <p className="retro-text text-lg mt-1" style={{ color: 'var(--text-secondary)' }}>
          {t('inventory:subtitle')}
        </p>
      </motion.div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 w-full min-w-0 max-w-2xl">
        <div className="pixel-box p-4 text-center" style={{ borderColor: 'var(--blue)' }}>
          <p className="ui-label-sm" style={{ color: 'var(--text-muted)' }}>
            {t('inventory:stats.total')}
          </p>
          <p className="retro-text text-2xl" style={{ color: 'var(--blue)' }}>
            {players.length}
          </p>
        </div>
        <div className="pixel-box p-4 text-center" style={{ borderColor: 'var(--purple)' }}>
          <p className="ui-label-sm" style={{ color: 'var(--text-muted)' }}>
            {t('inventory:stats.overwall')}
          </p>
          <p className="retro-text text-2xl" style={{ color: 'var(--purple)' }}>
            {totalOverwall.toLocaleString()}
          </p>
        </div>
      </div>

      {players.length > 0 && (
        <div className="pixel-card flex flex-wrap gap-2">
          {['all', 'common', 'uncommon', 'rare', 'super-rare', 'epic', 'legendary'].map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setRarityFilter(key)}
              className={`pixel-btn pixel-btn-sm ${rarityFilter === key ? 'pixel-btn-gold' : ''}`}
            >
              {key === 'all' ? t('inventory:filters.all') : t(`scout:rarities.${key}`)}
            </button>
          ))}
          <select
            value={positionFilter}
            onChange={(e) => setPositionFilter(e.target.value)}
            className="pixel-input text-sm ml-auto"
          >
            <option value="all">{t('inventory:filters.all')}</option>
            {['GK', 'DEF', 'LAT', 'MID', 'FW'].map((pos) => (
              <option key={pos} value={pos}>
                {pos}
              </option>
            ))}
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'overwall' | 'recent')}
            className="pixel-input text-sm"
          >
            <option value="recent">{t('inventory:filters.sortRecent')}</option>
            <option value="overwall">{t('inventory:filters.sortOverwall')}</option>
          </select>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="pixel-card text-center py-12">
          <p className="retro-text text-xl mb-4" style={{ color: 'var(--text-muted)' }}>
            {t('inventory:empty')}
          </p>
          <Link to="/scout" className="pixel-btn pixel-btn-gold pixel-btn-md">
            <i className="bi bi-search" aria-hidden /> {t('inventory:goScout')}
          </Link>
        </div>
      ) : (
        <div className="inventory-grid">
          {filtered.map((player, index) => {
            const config = rarityConfig[player.rarity] ?? rarityConfig.common;
            const label = player.name?.trim() || t(`inventory:kind.${player.kind}`);
            const displayOw = player.effectiveOverwall ?? player.overwall;
            return (
              <motion.button
                key={`${player.kind}-${player.id}`}
                type="button"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: Math.min(index * 0.03, 0.45) }}
                className="relative flex w-full min-w-0 cursor-pointer justify-center"
                onClick={() => setSelected(player)}
              >
                {player.listed && (
                  <span
                    className="absolute top-2 right-2 pixel-badge text-xs z-10"
                    style={{ borderColor: 'var(--gold)', color: 'var(--gold)' }}
                  >
                    {t('inventory:listed')}
                  </span>
                )}
                {player.equippedGear && player.equippedGear.length > 0 && (
                  <span
                    className="absolute bottom-2 right-2 pixel-badge text-xs z-10"
                    style={{ borderColor: 'var(--green)', color: 'var(--green)', fontSize: '10px' }}
                  >
                    {player.equippedGear.map((g, i) => (
                      <i
                        key={i}
                        className={`bi ${g.slot === 'boots' ? 'bi-bag-fill' : g.slot === 'gloves' ? 'bi-hand-index-thumb-fill' : 'bi-shield-fill'}`}
                        aria-hidden
                      />
                    ))}
                  </span>
                )}
                {player.source === 'referral_gift' && !player.listed && (
                  <span
                    className="absolute top-2 left-2 pixel-badge text-xs z-10"
                    style={{
                      borderColor: 'var(--green)',
                      color: 'var(--green)',
                      fontSize: '10px',
                    }}
                  >
                    <i className="bi bi-gift-fill" aria-hidden /> Bônus
                  </span>
                )}
                <TemporaryBadge player={player} />
                <ScoutRevealCard
                  player={{
                    id: player.id,
                    rarity: player.rarity,
                    overwall: displayOw,
                    position: player.position,
                    name: label,
                    imageUrl: player.imageUrl ? resolveUploadUrl(player.imageUrl) : undefined,
                    sprite: POSITION_SPRITES[player.position] ?? 'bi-shield-fill',
                    age: player.age,
                    costBasisUsdc: player.costBasisUsdc,
                    attributes: player.attributes,
                  }}
                  config={config}
                  size="grid"
                  index={index}
                  animate={false}
                />
              </motion.button>
            );
          })}
        </div>
      )}

      <PlayerInventorySheet player={selectedLive} onClose={() => setSelected(null)} />
    </PageContentShell>
  );
}

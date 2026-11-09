import { GearSprite } from '../../components/gear/GearSprite';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  useListings,
  useMyListings,
  useInventory,
  useListItemsBulk,
  useMarketplaceInfo,
  useBuyListing,
  useCancelListing,
  useUpdateListingPrice,
  useStadiumShop,
  useBuyGear,
  useBuyStadiumShopItem,
  useClub,
  type ListingDTO,
} from '../../hooks/useApi';
import { translateError } from '../../lib/apiError';
import { SpendConfirmDialog, type SpendChannel } from '../../components/economy/SpendConfirmDialog';
import { usePageTab } from '../../lib/telemetry/TabContext';
import { rarityColor, type ScoutRarity } from '../../components/scout/scoutMintConstants';
import { PlayerAgeBadge } from '../../components/players/PlayerAgeBadge';
import { PlayerCareerLife } from '../../components/players/PlayerCareerLife';
import { PlayerPixelPortrait } from '../../components/players/PlayerPixelPortrait';
import { resolveUploadUrl } from '../../lib/resolveUploadUrl';
import { PageContentShell } from '../../components/content';

type Listing = ListingDTO & { sprite: string };

const RARITY_KEYS: ScoutRarity[] = ['common', 'uncommon', 'rare', 'super-rare', 'epic', 'legendary'];

const POSITION_SPRITES: Record<string, string> = {
  GK: 'bi-hand-index-thumb-fill',
  DEF: 'bi-shield-fill',
  MID: 'bi-bullseye',
  FW: 'bi-shield-fill',
};

function ListModalPlayerArt({
  imageUrl,
  position,
  accent,
  rarity = 'rare',
  name,
  seed,
  size = 'md',
}: {
  imageUrl?: string | null;
  position: string;
  accent: string;
  rarity?: string;
  name?: string | null;
  seed?: string;
  size?: 'md' | 'lg';
}) {
  const dim = size === 'lg' ? 'h-36 w-36 sm:h-44 sm:w-44' : 'h-28 w-28 sm:h-32 sm:w-32';

  return (
    <div
      className={`${dim} shrink-0 pixel-box flex items-center justify-center overflow-hidden`}
      style={{
        borderColor: accent,
        borderWidth: 4,
        background: `radial-gradient(circle at center, ${accent}28 0%, var(--bg-dark) 78%)`,
        boxShadow: `0 0 0 2px ${accent}44, 0 8px 20px ${accent}22`,
      }}
    >
      {imageUrl ? (
        <img
          src={resolveUploadUrl(imageUrl)}
          alt={name?.trim() || position}
          className="w-[90%] h-[90%] object-contain"
          style={{ imageRendering: 'pixelated', filter: `drop-shadow(0 6px 10px ${accent}66)` }}
          draggable={false}
        />
      ) : (
        <PlayerPixelPortrait
          rarity={rarity}
          position={position}
          name={name}
          overwall={0}
          seed={seed || name || position}
          className="h-full w-full object-contain"
        />
      )}
    </div>
  );
}

export function MarketplacePage() {
  const { t } = useTranslation(['market', 'scout', 'common', 'inventory']);
  const [selectedRarity, setSelectedRarity] = useState<string>('all');
  const [asset, setAsset] = useState<'all' | 'player' | 'nft' | 'item'>('all');
  const [positionFilter, setPositionFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'selling' | 'available'>('all');
  const [minOw, setMinOw] = useState('');
  const [maxOw, setMaxOw] = useState('');
  const [minLevel, setMinLevel] = useState('');
  const [maxLevel, setMaxLevel] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [sortBy, setSortBy] = useState<'price' | 'overwall'>('price');
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const [listTab, setListTab] = useState<'anunciar' | 'meus'>('anunciar');
  usePageTab(listTab);
  const [listPlayerId, setListPlayerId] = useState('');
  const [listPrice, setListPrice] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [priceMap, setPriceMap] = useState<Record<string, string>>({});
  const [actionError, setActionError] = useState('');
  const [editingListing, setEditingListing] = useState<{ id: string; currentPrice: number } | null>(null);
  const [editPrice, setEditPrice] = useState('');
  const [spendTarget, setSpendTarget] = useState<SpendRequest | null>(null);
  const [spendError, setSpendError] = useState('');
  const [spendReceipt, setSpendReceipt] = useState<SpendReceipt | null>(null);

  const optionalNumber = (value: string) => {
    if (!value.trim()) return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  };
  const { data: apiListings = [], isLoading } = useListings({
    rarity: selectedRarity === 'all' ? undefined : selectedRarity,
    sortBy,
    limit: 100,
    ...(asset !== 'all' ? { asset } : {}),
    ...(positionFilter !== 'all' ? { position: positionFilter } : {}),
    ...(optionalNumber(minOw) != null ? { minOverwall: optionalNumber(minOw) } : {}),
    ...(optionalNumber(maxOw) != null ? { maxOverwall: optionalNumber(maxOw) } : {}),
    ...(optionalNumber(minLevel) != null ? { minLevel: optionalNumber(minLevel) } : {}),
    ...(optionalNumber(maxLevel) != null ? { maxLevel: optionalNumber(maxLevel) } : {}),
    ...(optionalNumber(minPrice) != null ? { minPrice: optionalNumber(minPrice) } : {}),
    ...(optionalNumber(maxPrice) != null ? { maxPrice: optionalNumber(maxPrice) } : {}),
  });
  const { data: inventory } = useInventory();
  const { data: marketInfo } = useMarketplaceInfo();
  const { data: shop } = useStadiumShop();
  const listItemsBulk = useListItemsBulk();
  const buyListing = useBuyListing();
  const buyGear = useBuyGear();
  const buyShopItem = useBuyStadiumShopItem();
  const { data: club } = useClub();
  const cancelListing = useCancelListing();
  const updatePrice = useUpdateListingPrice();
  const { data: myListings = [], isLoading: myListingsLoading } = useMyListings();
  const feeBps = marketInfo?.feeBps ?? 1000;
  const feePct = feeBps / 100;

  const listings: Listing[] = apiListings.map((l) => ({
    ...l,
    sprite: POSITION_SPRITES[l.position] ?? 'bi-shield-fill',
  }));
  const bonecosDisponiveis = listings.reduce((sum, row) => sum + (row.stock ?? 0), 0);

  const rarityConfig: Record<string, { color: string; label: string }> = {
    common: { color: rarityColor('common'), label: t('scout:rarities.common') },
    uncommon: { color: rarityColor('uncommon'), label: t('scout:rarities.uncommon') },
    rare: { color: rarityColor('rare'), label: t('scout:rarities.rare') },
    'super-rare': { color: rarityColor('super-rare'), label: t('scout:rarities.super-rare') },
    epic: { color: rarityColor('epic'), label: t('scout:rarities.epic') },
    legendary: { color: rarityColor('legendary'), label: t('scout:rarities.legendary') },
  };

  const getRarityConfig = (rarity: string) =>
    rarityConfig[rarity] ?? rarityConfig.common;

  const ownedBase = inventory?.players.filter((p) => p.kind === 'base') ?? [];
  const ownedNft = inventory?.players.filter((p) => p.kind === 'nft') ?? [];
  const listedTokens = new Set(myListings.map((listing) => listing.tokenId).filter(Boolean));
  const listablePlayers = [
    ...ownedBase.filter((p) => !p.listed && p.rarity !== 'common'),
    ...ownedNft.filter((p) => p.rarity !== 'common' && p.tokenId && !listedTokens.has(p.tokenId)),
  ];

  const requestSpend = (target: SpendRequest) => {
    setActionError('');
    setSpendError('');
    setSpendReceipt(null);
    setSpendTarget(target);
  };

  const spendPending =
    (spendTarget?.channel === 'p2p' && buyListing.isPending) ||
    (spendTarget?.shopKind === 'gear' && buyGear.isPending) ||
    (spendTarget?.shopKind === 'item' && buyShopItem.isPending);

  const confirmSpend = async () => {
    if (!spendTarget || spendPending) return;
    setSpendError('');
    const target = spendTarget;
    const balanceBefore = club?.gmtBalance ?? null;
    try {
      if (target.channel === 'p2p') {
        await buyListing.mutateAsync(target.id);
        setSelectedListing(null);
      } else if (target.shopKind === 'gear') {
        await buyGear.mutateAsync({ catalogItemId: target.id });
      } else {
        await buyShopItem.mutateAsync({ itemId: target.id });
      }
      setSpendTarget(null);
      setSpendReceipt({
        channel: target.channel,
        name: target.name,
        amountGmt: target.amountGmt,
        balanceAfter: balanceBefore != null ? Math.max(0, balanceBefore - target.amountGmt) : null,
      });
    } catch (err) {
      setSpendError(translateError(err, 'MARKET_BUY_FAILED'));
    }
  };

  const closeSpend = () => {
    if (spendPending) return;
    setSpendTarget(null);
    setSpendError('');
  };

  const handleCancel = async (listingId: string) => {
    setActionError('');
    try {
      await cancelListing.mutateAsync(listingId);
    } catch (err) {
      setActionError(translateError(err, 'MARKET_CANCEL_FAILED'));
    }
  };

  const openEditPrice = (id: string, currentPrice: number) => {
    setEditingListing({ id, currentPrice });
    setEditPrice(String(currentPrice));
    setActionError('');
  };

  const handleEditPrice = async () => {
    if (!editingListing) return;
    const price = parseFloat(editPrice);
    if (isNaN(price) || price <= 0) {
      setActionError(t('market:listModal.priceRequired'));
      return;
    }
    setActionError('');
    try {
      await updatePrice.mutateAsync({ listingId: editingListing.id, price });
      setEditingListing(null);
    } catch (err) {
      setActionError(translateError(err, 'MARKET_EDIT_FAILED'));
    }
  };

  const handleList = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError('');
    const items = Array.from(selectedIds)
      .map((id) => {
        const price = Number(String(priceMap[id] ?? '').replace(',', '.'));
        if (id.startsWith('nft:')) return { tokenId: id.slice(4), price };
        return { basePlayerId: id, price };
      })
      .filter((it) => Number.isFinite(it.price) && it.price > 0 && (it.basePlayerId || it.tokenId));
    if (items.length === 0) {
      setActionError(t('market:listModal.priceRequired'));
      return;
    }
    try {
      const res = await listItemsBulk.mutateAsync(items);
      const failed = (res.results ?? []).filter((r) => r.ok === false);
      if (failed.length > 0) {
        const errCode = failed[0]?.error ?? 'UNKNOWN';
        const reason = translateError(
          { response: { data: { error: { code: errCode } } } },
          'MARKET_LIST_FAILED',
        );
        setActionError(t('market:listModal.listFailed', { count: failed.length, reason }));
      } else {
        setListOpen(false);
        setSelectedIds(new Set());
        setPriceMap({});
      }
    } catch (err) {
      setActionError(translateError(err, 'MARKET_LIST_FAILED'));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const displayId = (l: Listing) => l.basePlayerId?.slice(0, 8) ?? l.tokenId ?? l.id.slice(0, 8);

  const pricedSelectedCount = Array.from(selectedIds).filter(
    (id) => Number(priceMap[id] ?? 0) > 0,
  ).length;
  const listGrossTotal = Array.from(selectedIds).reduce((acc, id) => {
    const v = Number(priceMap[id] ?? 0);
    return acc + (v > 0 ? v : 0);
  }, 0);
  const listFeeTotal = listGrossTotal * (feeBps / 10000);
  const listNetTotal = listGrossTotal - listFeeTotal;
  const showListings = asset !== 'item' && statusFilter !== 'available';
  const statFilterOn = [minOw, maxOw, minLevel, maxLevel].some((value) => optionalNumber(value) != null);
  const showShop = positionFilter === 'all' && !statFilterOn && (asset === 'all' || asset === 'item') && statusFilter !== 'selling';
  const rarityRank: Record<string, number> = { common: 0, uncommon: 1, rare: 2, 'super-rare': 3, epic: 4, legendary: 5 };
  const priceOk = (price: number) => {
    const min = optionalNumber(minPrice);
    const max = optionalNumber(maxPrice);
    if (min != null && price < min) return false;
    if (max != null && price > max) return false;
    return true;
  };
  const gearForSale = (shop?.gear ?? []).filter(
    (gear) => gear.active && priceOk(gear.priceGmt) && (selectedRarity === 'all' || gear.rarity === rarityRank[selectedRarity]),
  );
  const shopForSale = (shop?.items ?? []).filter(
    (item) => item.active && item.effectType !== 'affiliate_link' && priceOk(item.priceUsdc) && selectedRarity === 'all',
  );
  const hasShop = showShop && (gearForSale.length > 0 || shopForSale.length > 0);

  return (
    <PageContentShell>
      {actionError && (
        <div className="pixel-box-light p-3 border-red">
          <p className="retro-text text-red text-center">{actionError}</p>
        </div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
      >
        <div>
          <h1 className="pixel-text text-xl sm:text-2xl md:text-3xl" style={{ color: 'var(--purple)' }}>
            <i className="bi bi-cart-fill" aria-hidden /> {t('market:title')}
          </h1>
          <p className="retro-text text-xl mt-1" style={{ color: 'var(--text-secondary)' }}>
            {t('market:subtitle')}
          </p>
          <p className="retro-text text-sm mt-2 max-w-xl" style={{ color: 'var(--gold)' }}>
            {t('market:stockNotice')}
          </p>
          {bonecosDisponiveis > 0 && (
            <p className="pixel-text text-sm mt-2" style={{ color: 'var(--gold)' }}>
              {t('market:availableBonecos', { qty: bonecosDisponiveis.toLocaleString('pt-BR') })}
            </p>
          )}
        </div>
        <motion.button
          className="pixel-btn pixel-btn-gold pixel-btn-md w-full md:w-auto"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setListOpen(true)}
        >
          <i className="bi bi-plus-lg" aria-hidden /> {t('market:list')}
        </motion.button>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="pixel-card"
        style={{ borderColor: 'var(--bg-lighter)' }}
      >
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="ui-label-sm mb-2" style={{ color: 'var(--text-secondary)' }}>
              {t('market:rarity')}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setSelectedRarity('all')}
                className={`pixel-btn pixel-btn-sm ${selectedRarity === 'all' ? 'pixel-btn-gold' : ''}`}
                style={selectedRarity !== 'all' ? { background: 'var(--bg-light)', borderColor: 'var(--bg-lighter)' } : {}}
              >
                {t('market:all')}
              </button>
              {RARITY_KEYS.map((key) => {
                const config = rarityConfig[key]!;
                return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedRarity(key)}
                  className="pixel-btn pixel-btn-sm"
                  style={{
                    background: selectedRarity === key ? config.color : 'var(--bg-light)',
                    borderColor: config.color,
                    color: selectedRarity === key ? 'var(--bg-dark)' : config.color,
                  }}
                >
                  {config.label}
                </button>
              );})}
            </div>
          </div>

          <div>
            <div className="ui-label-sm mb-2" style={{ color: 'var(--text-secondary)' }}>
              {t('market:sort')}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setSortBy('price')}
                className={`pixel-btn pixel-btn-sm ${sortBy === 'price' ? 'pixel-btn-blue' : ''}`}
                style={sortBy !== 'price' ? { background: 'var(--bg-light)', borderColor: 'var(--bg-lighter)' } : {}}
              >
                <i className="bi bi-cash-stack" aria-hidden /> {t('market:byPrice')}
              </button>
              <button
                type="button"
                onClick={() => setSortBy('overwall')}
                className={`pixel-btn pixel-btn-sm ${sortBy === 'overwall' ? 'pixel-btn-blue' : ''}`}
                style={sortBy !== 'overwall' ? { background: 'var(--bg-light)', borderColor: 'var(--bg-lighter)' } : {}}
              >
                ⭐ {t('market:byOverwall')}
              </button>
            </div>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <label className="block">
            <span className="ui-label-sm mb-2 block" style={{ color: 'var(--text-secondary)' }}>{t('market:asset', { defaultValue: 'ATIVO' })}</span>
            <select className="pixel-input w-full" value={asset} onChange={(e) => setAsset(e.target.value as typeof asset)}>
              <option value="all">{t('market:all')}</option>
              <option value="player">{t('market:assets.player', { defaultValue: 'Jogador' })}</option>
              <option value="item">{t('market:assets.item', { defaultValue: 'Item' })}</option>
            </select>
          </label>
          <label className="block">
            <span className="ui-label-sm mb-2 block" style={{ color: 'var(--text-secondary)' }}>{t('market:position', { defaultValue: 'POSIÇÃO' })}</span>
            <select className="pixel-input w-full" value={positionFilter} onChange={(e) => setPositionFilter(e.target.value)}>
              <option value="all">{t('market:all')}</option>
              {['GK', 'DEF', 'LAT', 'MID', 'FW'].map((pos) => <option key={pos} value={pos}>{pos}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="ui-label-sm mb-2 block" style={{ color: 'var(--text-secondary)' }}>{t('market:status', { defaultValue: 'STATUS' })}</span>
            <select className="pixel-input w-full" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}>
              <option value="all">{t('market:all')}</option>
              <option value="selling">{t('market:statuses.selling', { defaultValue: 'À venda' })}</option>
              <option value="available">{t('market:statuses.available', { defaultValue: 'Disponível' })}</option>
            </select>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="ui-label-sm mb-2 block" style={{ color: 'var(--text-secondary)' }}>OW</span>
              <input className="pixel-input w-full" inputMode="numeric" placeholder="mín" value={minOw} onChange={(e) => setMinOw(e.target.value)} />
            </label>
            <label className="block">
              <span className="ui-label-sm mb-2 block" style={{ color: 'var(--text-secondary)' }}>{t('market:level', { defaultValue: 'NÍVEL' })}</span>
              <input className="pixel-input w-full" inputMode="numeric" placeholder="mín" value={minLevel} onChange={(e) => setMinLevel(e.target.value)} />
            </label>
          </div>
          <label className="block">
            <span className="ui-label-sm mb-2 block" style={{ color: 'var(--text-secondary)' }}>{t('market:byPrice')}</span>
            <div className="grid grid-cols-2 gap-2">
              <input className="pixel-input w-full" inputMode="decimal" placeholder="mín" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} />
              <input className="pixel-input w-full" inputMode="decimal" placeholder="máx" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} />
            </div>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="ui-label-sm mb-2 block" style={{ color: 'transparent' }}>OW</span>
              <input className="pixel-input w-full" inputMode="numeric" placeholder="OW máx" value={maxOw} onChange={(e) => setMaxOw(e.target.value)} />
            </label>
            <label className="block">
              <span className="ui-label-sm mb-2 block" style={{ color: 'transparent' }}>N</span>
              <input className="pixel-input w-full" inputMode="numeric" placeholder="nível máx" value={maxLevel} onChange={(e) => setMaxLevel(e.target.value)} />
            </label>
          </div>
        </div>
      </motion.div>

      {isLoading && (
        <div className="pixel-card text-center py-8">
          <p className="retro-text text-lg" style={{ color: 'var(--text-muted)' }}>
            {t('common:labels.status.loading')}
          </p>
        </div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4"
      >
        {!isLoading &&
          listings.map((listing, index) => {
            const config = getRarityConfig(listing.rarity);
            const canBuy = Boolean(listing.basePlayerId || listing.tokenId || (listing.stock ?? 0) > 0);
            if (!showListings) return null;
            return (
              <motion.div
                key={listing.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="player-card cursor-pointer w-full p-2 sm:p-3"
                style={{
                  maxWidth: '100%',
                  borderColor: config.color,
                  borderWidth: 4,
                  background: `linear-gradient(180deg, ${config.color}1a 0%, var(--bg-light) 60%)`,
                  boxShadow: `0 0 0 2px ${config.color}55, 0 8px 24px ${config.color}30`,
                }}
                whileHover={{ scale: 1.04, y: -6 }}
                onClick={() => setSelectedListing(listing)}
              >
                <div className="flex items-center justify-between mb-2 gap-1">
                  <div
                    className="pixel-badge text-[10px] sm:text-xs px-1 py-0.5 truncate"
                    style={{ color: config.color, borderColor: config.color }}
                  >
                    {config.label}
                  </div>
                  <div
                    className="retro-text text-[10px] truncate"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    #{displayId(listing)}
                  </div>
                </div>

                <div
                  className="relative w-full aspect-square mx-auto pixel-box flex items-center justify-center mb-3 overflow-hidden"
                  style={{
                    borderColor: config.color,
                    borderWidth: 4,
                    background: `radial-gradient(circle at center, ${config.color}22 0%, var(--bg-dark) 80%)`,
                  }}
                >
                  {listing.imageUrl ? (
                    <img
                      src={resolveUploadUrl(listing.imageUrl)}
                      alt={listing.name?.trim() || listing.position}
                      className="w-full h-full object-contain"
                      style={{ imageRendering: 'pixelated' }}
                      draggable={false}
                    />
                  ) : (
                    <PlayerPixelPortrait
                      rarity={listing.rarity}
                      position={listing.position}
                      name={listing.name}
                      overwall={listing.overwall}
                      seed={listing.basePlayerId || listing.tokenId || listing.id}
                      className="h-full w-full object-contain"
                    />
                  )}
                  <PlayerAgeBadge
                    player={{
                      kind: 'base',
                      age: listing.age,
                      costBasisUsdc: listing.costBasisUsdc,
                    }}
                    className="absolute left-2 bottom-2"
                  />
                </div>

                {listing.name && (
                  <div
                    className="retro-text text-xs sm:text-sm text-center mb-2 truncate flex items-center justify-center gap-2"
                    style={{ color: '#ffffff' }}
                  >
                    <span className="truncate">{listing.name}</span>
                  </div>
                )}

                <div
                  className="player-overwall text-xl sm:text-2xl text-center"
                  style={{ color: config.color }}
                >
                  {listing.overwall.toLocaleString()}
                </div>

                <div className="player-position mb-2 text-center text-xs sm:text-sm">
                  {listing.position} · {t('market:level', { defaultValue: 'NÍVEL' })} {listing.level}
                </div>

                {listing.stock != null && (
                  <p className="pixel-text text-sm sm:text-base text-center mb-2" style={{ color: config.color }}>
                    {t('market:stock', { qty: listing.stock.toLocaleString('pt-BR') })}
                  </p>
                )}

                <div className="mb-2 px-0.5">
                  <PlayerCareerLife
                    compact
                    player={{
                      kind: 'base',
                      age: listing.age,
                      costBasisUsdc: listing.costBasisUsdc,
                      roiPct: listing.roiPct,
                    }}
                  />
                </div>

                <div
                  className="border-t-2 sm:border-t-4 pt-2"
                  style={{ borderColor: 'var(--bg-lighter)' }}
                >
                  <div
                    className="pixel-text text-base sm:text-xl mb-2 text-center"
                    style={{ color: 'var(--gold)' }}
                  >
                    {listing.price} GMT
                  </div>
                  {canBuy ? (
                    <motion.button
                      className="pixel-btn pixel-btn-green pixel-btn-sm sm:pixel-btn-md w-full text-xs sm:text-sm"
                      style={{ background: 'var(--green-dark)', borderColor: 'var(--green)' }}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      disabled={buyListing.isPending}
                      onClick={(e) => {
                        e.stopPropagation();
                        requestSpend({
                          channel: 'p2p',
                          id: listing.id,
                          name: listing.name?.trim() || listing.position,
                          amountGmt: listing.price,
                        });
                      }}
                    >
                      {t('market:buy')}
                    </motion.button>
                  ) : (
                    <p className="retro-text text-xs text-center" style={{ color: 'var(--text-muted)' }}>
                      {t('market:demoOnly', { defaultValue: 'Demo (on-chain)' })}
                    </p>
                  )}
                </div>
              </motion.div>
            );
          })}
      </motion.div>

      {hasShop && (
        <div className="space-y-3">
          <h2 className="pixel-text text-lg" style={{ color: 'var(--gold)' }}>
            {t('market:assets.item', { defaultValue: 'Itens' })}
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
            {gearForSale.map((gear) => (
              <div key={gear.id} className="player-card w-full p-3" style={{ borderColor: 'var(--gold)', borderWidth: 4 }}>
                <div className="aspect-square pixel-box mb-3 flex items-center justify-center overflow-hidden" style={{ borderColor: 'var(--gold)' }}>
                  {gear.imageUrl ? (
                    <GearSprite src={resolveUploadUrl(gear.imageUrl)} className="w-full h-full" />
                  ) : (
                    <i className="bi bi-bag-fill text-5xl" style={{ color: 'var(--gold)' }} aria-hidden />
                  )}
                </div>
                <p className="retro-text text-sm text-center truncate">{t(gear.nameKey, { defaultValue: gear.slug })}</p>
                <p className="pixel-text text-center my-2" style={{ color: 'var(--gold)' }}>{gear.priceGmt} GMT</p>
                <button
                  type="button"
                  className="pixel-btn pixel-btn-green pixel-btn-sm w-full"
                  disabled={buyGear.isPending}
                  onClick={() => requestSpend({
                    channel: 'shop',
                    shopKind: 'gear',
                    id: gear.id,
                    name: t(gear.nameKey, { defaultValue: gear.slug }),
                    amountGmt: gear.priceGmt,
                  })}
                >
                  {t('market:buy')}
                </button>
              </div>
            ))}
            {shopForSale.map((item) => (
              <div key={item.id} className="player-card w-full p-3" style={{ borderColor: 'var(--blue)', borderWidth: 4 }}>
                <div className="aspect-square pixel-box mb-3 flex items-center justify-center overflow-hidden" style={{ borderColor: 'var(--blue)' }}>
                  {item.imageUrl ? (
                    <img src={resolveUploadUrl(item.imageUrl)} alt={item.nameKey} className="w-full h-full object-contain" draggable={false} />
                  ) : (
                    <i className="bi bi-box-seam-fill text-5xl" style={{ color: 'var(--blue)' }} aria-hidden />
                  )}
                </div>
                <p className="retro-text text-sm text-center truncate">{t(item.nameKey, { defaultValue: item.slug })}</p>
                <p className="retro-text text-xs text-center mb-2" style={{ color: 'var(--text-muted)' }}>{t('market:statuses.available', { defaultValue: 'Disponível' })}</p>
                <p className="pixel-text text-center my-2" style={{ color: 'var(--gold)' }}>{item.priceUsdc} GMT</p>
                <button
                  type="button"
                  className="pixel-btn pixel-btn-green pixel-btn-sm w-full"
                  disabled={buyShopItem.isPending}
                  onClick={() => requestSpend({
                    channel: 'shop',
                    shopKind: 'item',
                    id: item.id,
                    name: t(item.nameKey, { defaultValue: item.slug }),
                    amountGmt: item.priceUsdc,
                  })}
                >
                  {t('market:buy')}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {!isLoading && (showListings ? listings.length === 0 : true) && !hasShop && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pixel-card text-center py-16">
          <div className="text-6xl mb-4"><i className="bi bi-cart-fill" aria-hidden /></div>
          <h3 className="pixel-text text-xl mb-2" style={{ color: 'var(--text-muted)' }}>
            {t('market:empty.title')}
          </h3>
          <p className="retro-text text-lg" style={{ color: 'var(--text-muted)' }}>
            {t('market:empty.desc')}
          </p>
        </motion.div>
      )}

      {typeof document !== 'undefined' && createPortal(
      <AnimatePresence>
        {listOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mobile-sheet flex items-end justify-center bg-black/85 sm:items-center sm:p-4"
            onClick={() => setListOpen(false)}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              className="pixel-card flex h-full max-h-full min-h-0 w-full flex-col overflow-hidden rounded-t-2xl sm:h-auto sm:max-h-full sm:max-w-4xl sm:rounded-none lg:max-w-5xl"
              style={{ borderColor: 'var(--gold)' }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div
                className="flex items-start justify-between gap-3 px-4 sm:px-5 py-4 border-b-4"
                style={{ borderColor: 'var(--bg-lighter)', background: 'linear-gradient(180deg, rgba(255,215,0,0.08) 0%, transparent 100%)' }}
              >
                <div className="min-w-0">
                  <h2 className="pixel-text text-base sm:text-lg leading-tight" style={{ color: 'var(--gold)' }}>
                    <i className="bi bi-tag-fill" aria-hidden /> {t('market:listModal.title')}
                  </h2>
                  <p className="retro-text text-sm sm:text-base mt-1" style={{ color: 'var(--text-secondary)' }}>
                    {t('market:listModal.fee')}:{' '}
                    <span className="pixel-badge pixel-badge--gold text-[10px] sm:text-xs ml-1">
                      {feePct.toFixed(2)}%
                    </span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setListOpen(false)}
                  className="pixel-btn pixel-btn-sm shrink-0"
                  style={{ background: 'var(--bg-light)', borderColor: 'var(--bg-lighter)', minWidth: 36 }}
                  aria-label={t('common:labels.actions.close', { defaultValue: 'Fechar' })}
                >
                  <i className="bi bi-x-lg" aria-hidden />
                </button>
              </div>

              {/* Tabs */}
              <div className="px-4 sm:px-5 pt-3 pb-2">
                <div className="pixel-filter-row" role="tablist">
                  {(['anunciar', 'meus'] as const).map((tab) => {
                    const active = listTab === tab;
                    const count = tab === 'meus' ? myListings.length : listablePlayers.length;
                    return (
                      <button
                        key={tab}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => setListTab(tab)}
                        className={`pixel-btn pixel-btn-sm flex-1 sm:flex-none ${active ? 'pixel-btn-gold' : ''}`}
                        style={
                          !active
                            ? { background: 'var(--bg-light)', borderColor: 'var(--bg-lighter)', color: 'var(--text-secondary)' }
                            : undefined
                        }
                      >
                        {tab === 'anunciar' ? <><i className="bi bi-plus-lg" aria-hidden /> {t('market:listModal.tabList')}</> : <><i className="bi bi-clipboard-fill" aria-hidden /> {t('market:listModal.tabMine')}</>}
                        {count > 0 && (
                          <span className="ml-1 opacity-80">({count})</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="touch-scroll min-h-0 flex-1 overflow-y-auto px-4 pb-4 sm:px-5">
                {listTab === 'meus' && (
                  <div className="space-y-3">
                    {myListingsLoading ? (
                      <p className="retro-text text-center py-10" style={{ color: 'var(--text-muted)' }}>
                        {t('market:listModal.loading')}
                      </p>
                    ) : myListings.length === 0 ? (
                      <div className="pixel-box-light text-center py-12 px-4" style={{ borderColor: 'var(--bg-lighter)' }}>
                        <div className="text-5xl mb-3"><i className="bi bi-clipboard-fill" aria-hidden /></div>
                        <p className="pixel-text text-sm mb-2" style={{ color: 'var(--text-primary)' }}>
                          {t('market:listModal.emptyMine')}
                        </p>
                        <p className="retro-text text-base" style={{ color: 'var(--text-muted)' }}>
                          {t('market:listModal.emptyMineHint')}
                        </p>
                      </div>
                    ) : (
                      myListings.map((listing) => {
                        const config = getRarityConfig(listing.rarity);
                        const isEditing = editingListing?.id === listing.id;
                        return (
                          <div
                            key={listing.id}
                            className="pixel-card-fluid p-4 sm:p-5"
                            style={{
                              borderColor: config.color,
                              borderWidth: 4,
                              background: `linear-gradient(160deg, ${config.color}18 0%, var(--bg-light) 50%)`,
                              boxShadow: `0 0 0 2px ${config.color}33`,
                            }}
                          >
                            <div className="flex flex-col sm:flex-row gap-5 sm:gap-6">
                              <div className="flex flex-col items-center sm:items-start gap-2 shrink-0">
                                <ListModalPlayerArt
                                  imageUrl={listing.imageUrl}
                                  position={listing.position}
                                  rarity={listing.rarity}
                                  name={listing.name}
                                  seed={listing.basePlayerId || listing.tokenId || listing.id}
                                  accent={config.color}
                                  size="lg"
                                />
                                <span
                                  className="pixel-badge text-xs px-2 py-1"
                                  style={{ color: config.color, borderColor: config.color }}
                                >
                                  {config.label}
                                </span>
                              </div>

                              <div className="flex-1 flex flex-col justify-between gap-4 min-w-0">
                                <div className="text-center sm:text-left">
                                  <p
                                    className="retro-text text-xl sm:text-2xl truncate"
                                    style={{ color: 'var(--text-primary)' }}
                                  >
                                    {listing.name ?? listing.position}
                                  </p>
                                  <p
                                    className="retro-text text-lg sm:text-xl mt-1"
                                    style={{ color: config.color }}
                                  >
                                    {listing.position} · {listing.overwall.toLocaleString('pt-BR')} OW
                                  </p>
                                  <div className="mt-2 max-w-xs mx-auto sm:mx-0">
                                    <PlayerCareerLife
                                      compact
                                      player={{
                                        kind: 'base',
                                        age: listing.age,
                                        costBasisUsdc: listing.costBasisUsdc,
                                        roiPct: listing.roiPct,
                                      }}
                                    />
                                  </div>
                                  <p className="retro-text text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                                    #{displayId(listing)}
                                  </p>
                                </div>

                                {isEditing ? (
                                  <div
                                    className="flex flex-col sm:flex-row sm:items-end gap-3 pt-4 border-t-4"
                                    style={{ borderColor: 'var(--bg-lighter)' }}
                                  >
                                    <div className="flex-1">
                                      <label
                                        className="retro-text text-xs uppercase tracking-wide block mb-1"
                                        style={{ color: 'var(--text-muted)' }}
                                      >
                                        {t('market:listModal.priceLabel')}
                                      </label>
                                      <div className="relative max-w-xs">
                                        <input
                                          type="number"
                                          min="0.01"
                                          step="0.01"
                                          value={editPrice}
                                          onChange={(e) => setEditPrice(e.target.value)}
                                          className="pixel-input w-full text-right pr-14 py-2 text-xl"
                                          autoFocus
                                        />
                                        <span
                                          className="absolute right-3 top-1/2 -translate-y-1/2 retro-text text-base pointer-events-none font-bold"
                                          style={{ color: 'var(--gold)' }}
                                        >
                                          GMT
                                        </span>
                                      </div>
                                    </div>
                                    <div className="flex gap-2">
                                      <button
                                        type="button"
                                        disabled={updatePrice.isPending}
                                        onClick={() => void handleEditPrice()}
                                        className="pixel-btn pixel-btn-green pixel-btn-md flex-1 sm:flex-none"
                                      >
                                        {t('market:listModal.save')}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setEditingListing(null)}
                                        className="pixel-btn pixel-btn-md flex-1 sm:flex-none"
                                        style={{ background: 'var(--bg-light)', borderColor: 'var(--bg-lighter)' }}
                                      >
                                        {t('market:listModal.cancel')}
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <div
                                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-4 border-t-4"
                                    style={{ borderColor: 'var(--bg-lighter)' }}
                                  >
                                    <div className="text-center sm:text-left">
                                      <p
                                        className="retro-text text-xs uppercase tracking-wide"
                                        style={{ color: 'var(--text-muted)' }}
                                      >
                                        {t('market:modal.price')}
                                      </p>
                                      <p className="pixel-text text-3xl sm:text-4xl leading-none" style={{ color: 'var(--gold)' }}>
                                        {listing.price.toLocaleString('pt-BR')}{' '}
                                        <span className="text-lg sm:text-xl opacity-90">GMT</span>
                                      </p>
                                    </div>
                                    <div className="flex gap-2">
                                      <motion.button
                                        type="button"
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        onClick={() => openEditPrice(listing.id, listing.price)}
                                        className="pixel-btn pixel-btn-md flex-1 sm:flex-none"
                                        style={{ background: 'rgba(255,215,0,0.12)', borderColor: 'var(--gold)', color: 'var(--gold)' }}
                                      >
                                        <i className="bi bi-pencil-fill" aria-hidden /> {t('market:listModal.edit')}
                                      </motion.button>
                                      <motion.button
                                        type="button"
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        disabled={cancelListing.isPending}
                                        onClick={() => void handleCancel(listing.id)}
                                        className="pixel-btn pixel-btn-md flex-1 sm:flex-none"
                                        style={{ background: 'rgba(239,68,68,0.12)', borderColor: 'var(--red)', color: '#fca5a5' }}
                                      >
                                        <i className="bi bi-trash-fill" aria-hidden /> {t('market:listModal.delist')}
                                      </motion.button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}

                {listTab === 'anunciar' && (
                  <>
                    {listablePlayers.length === 0 ? (
                      <div className="pixel-box-light text-center py-12 px-4" style={{ borderColor: 'var(--bg-lighter)' }}>
                        <div className="text-5xl mb-3"><i className="bi bi-shield-fill" aria-hidden /></div>
                        <p className="retro-text text-base" style={{ color: 'var(--text-secondary)' }}>
                          {ownedBase.length === 0 ? t('inventory:empty') : t('market:listModal.allListed')}
                        </p>
                      </div>
                    ) : (
                      <>
                        <p className="retro-text text-sm sm:text-base mb-3 px-1" style={{ color: 'var(--text-secondary)' }}>
                          {t('market:listModal.selectHint')}
                        </p>

                        <div className="space-y-4">
                          {(['legendary', 'epic', 'super-rare', 'rare', 'uncommon'] as const).map((rk) => {
                            const group = listablePlayers.filter((p) => p.rarity === rk);
                            if (group.length === 0) return null;
                            const accent = rarityColor(rk);
                            const cfg = rarityConfig[rk]!;

                            return (
                              <section
                                key={rk}
                                className="pixel-box-light overflow-hidden"
                                style={{ borderColor: accent }}
                              >
                                <header
                                  className="flex items-center justify-between px-3 py-2 border-b-2"
                                  style={{ borderColor: `${accent}55`, background: `${accent}14` }}
                                >
                                  <span className="pixel-text text-xs sm:text-sm" style={{ color: accent }}>
                                    <i className="bi bi-star-fill" aria-hidden /> {cfg.label}
                                  </span>
                                  <span className="pixel-badge pixel-badge--muted text-[10px]">
                                    {group.length}
                                  </span>
                                </header>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3">
                                  {group.map((p) => {
                                    const id = p.kind === 'nft' ? `nft:${p.tokenId}` : p.id;
                                    const selected = selectedIds.has(id);
                                    const price = priceMap[id] ?? '';
                                    const numericPrice = Number(price);
                                    const net =
                                      numericPrice > 0 ? numericPrice * (1 - feeBps / 10000) : 0;

                                    return (
                                      <div
                                        key={id}
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => toggleSelect(id)}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            toggleSelect(id);
                                          }
                                        }}
                                        className="pixel-card p-3 sm:p-4 cursor-pointer transition-all"
                                        style={{
                                          borderColor: selected ? accent : 'var(--bg-lighter)',
                                          borderWidth: 4,
                                          background: selected
                                            ? `linear-gradient(160deg, ${accent}20 0%, var(--bg-light) 70%)`
                                            : 'var(--bg-light)',
                                          boxShadow: selected ? `0 0 0 2px ${accent}55` : undefined,
                                        }}
                                      >
                                        <div className="flex gap-3 sm:gap-4">
                                          <div className="relative shrink-0">
                                            <ListModalPlayerArt
                                              imageUrl={p.imageUrl}
                                              position={p.position}
                                              rarity={p.rarity}
                                              name={p.name}
                                              seed={p.kind === 'nft' ? p.tokenId : p.id}
                                              accent={accent}
                                              size="md"
                                            />
                                            <div
                                              className="absolute -top-1 -left-1 h-7 w-7 flex items-center justify-center border-2 font-bold text-sm"
                                              style={{
                                                borderColor: selected ? accent : 'var(--bg-lighter)',
                                                background: selected ? accent : 'var(--bg-dark)',
                                                color: selected ? 'var(--bg-dark)' : 'transparent',
                                              }}
                                              aria-hidden
                                            >
                                              {selected ? <i className="bi bi-check-lg" aria-hidden /> : ''}
                                            </div>
                                          </div>

                                          <div className="min-w-0 flex-1 flex flex-col justify-center">
                                            <div className="flex items-center gap-2 min-w-0">
                                              <p
                                                className="retro-text text-lg sm:text-xl truncate"
                                                style={{ color: 'var(--text-primary)' }}
                                              >
                                                {p.name?.trim() || p.position}
                                              </p>
                                              <PlayerAgeBadge player={p} />
                                            </div>
                                            <p className="retro-text text-base sm:text-lg mt-0.5" style={{ color: accent }}>
                                              {p.position} · {p.overwall.toLocaleString('pt-BR')} OW
                                            </p>
                                            <div className="mt-1.5">
                                              <PlayerCareerLife compact player={p} />
                                            </div>
                                          </div>
                                        </div>

                                        <div className="mt-3 pt-3 border-t-2" style={{ borderColor: 'var(--bg-lighter)' }} onClick={(e) => e.stopPropagation()}>
                                          <label
                                            className="retro-text text-xs uppercase tracking-wide block mb-1.5"
                                            style={{ color: 'var(--text-muted)' }}
                                          >
                                            {t('market:listModal.priceLabel')}
                                          </label>
                                          <div className="relative">
                                            <input
                                              type="number"
                                              min={1}
                                              step={1}
                                              placeholder="0"
                                              value={price}
                                              onChange={(e) =>
                                                setPriceMap((prev) => ({ ...prev, [id]: e.target.value }))
                                              }
                                              onFocus={() => {
                                                if (!selected) toggleSelect(id);
                                              }}
                                              className="pixel-input w-full text-right pr-14 py-2 text-xl"
                                            />
                                            <span
                                              className="absolute right-3 top-1/2 -translate-y-1/2 retro-text text-base pointer-events-none font-bold"
                                              style={{ color: 'var(--gold)' }}
                                            >
                                              GMT
                                            </span>
                                          </div>
                                          {selected && numericPrice > 0 && (
                                            <p className="retro-text text-sm mt-2 text-right" style={{ color: 'var(--green)' }}>
                                              {t('market:listModal.youReceive')}:{' '}
                                              <strong>
                                                {net.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} GMT
                                              </strong>
                                            </p>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </section>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>

              {listTab === 'anunciar' && listablePlayers.length > 0 && (
                <form
                  onSubmit={(e) => void handleList(e)}
                  className="shrink-0 space-y-3 border-t-4 px-4 py-4 sm:px-5"
                  style={{
                    borderColor: 'var(--bg-lighter)',
                    background: 'var(--bg-dark)',
                    paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
                  }}
                >
                  {pricedSelectedCount === 0 ? (
                    <div className="pixel-box-light py-3 px-4 text-center" style={{ borderColor: 'var(--bg-lighter)' }}>
                      <p className="retro-text text-sm" style={{ color: 'var(--text-muted)' }}>
                        {t('market:listModal.selectHint')}
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                      {[
                        { label: t('market:listModal.summary.players'), value: String(pricedSelectedCount), color: 'var(--text-primary)', icon: 'bi-person-fill' },
                        { label: t('market:listModal.summary.gross'), value: listGrossTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 }), color: 'var(--gold)', icon: 'bi-cash-stack' },
                        { label: t('market:listModal.summary.fee'), value: `-${listFeeTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, color: 'var(--red)', icon: 'bi-graph-down-arrow' },
                        { label: t('market:listModal.summary.net'), value: listNetTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 }), color: 'var(--green)', icon: 'bi-check-circle-fill' },
                      ].map((stat) => (
                        <div
                          key={stat.label}
                          className="pixel-box-light p-2 sm:p-3 text-center"
                          style={{ borderColor: 'var(--bg-lighter)' }}
                        >
                          <p className="retro-text text-[10px] sm:text-xs uppercase tracking-wide mb-1" style={{ color: 'var(--text-muted)' }}>
                            <i className={`bi ${stat.icon}`} aria-hidden /> {stat.label}
                          </p>
                          <p className="pixel-text text-sm sm:text-lg truncate" style={{ color: stat.color }}>
                            {stat.value}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  <motion.button
                    type="submit"
                    className="pixel-btn pixel-btn-gold pixel-btn-md w-full"
                    whileHover={{ scale: pricedSelectedCount > 0 ? 1.02 : 1 }}
                    whileTap={{ scale: pricedSelectedCount > 0 ? 0.98 : 1 }}
                    disabled={listItemsBulk.isPending || pricedSelectedCount === 0}
                  >
                    {listItemsBulk.isPending
                      ? t('market:listModal.submitting')
                      : pricedSelectedCount > 0
                        ? t('market:listModal.submitCount', { count: pricedSelectedCount })
                        : t('market:listModal.submit')}
                  </motion.button>
                </form>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>,
      document.body,
      )}

      {typeof document !== 'undefined' && createPortal(
      <AnimatePresence>
        {selectedListing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mobile-sheet flex items-center justify-center overflow-y-auto bg-black/80 p-4"
            onClick={() => setSelectedListing(null)}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="pixel-card max-w-md w-full"
              style={{ borderColor: getRarityConfig(selectedListing.rarity).color }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <div
                  className="pixel-badge"
                  style={{
                    color: getRarityConfig(selectedListing.rarity).color,
                    borderColor: getRarityConfig(selectedListing.rarity).color,
                  }}
                >
                  {getRarityConfig(selectedListing.rarity).label}
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedListing(null)}
                  className="pixel-btn pixel-btn-sm"
                  style={{ background: 'var(--bg-light)', borderColor: 'var(--bg-lighter)' }}
                >
                  <i className="bi bi-x-lg" aria-hidden />
                </button>
              </div>

              <div className="text-center mb-6">
                <div
                  className="relative w-32 h-32 mx-auto pixel-box flex items-center justify-center mb-4 overflow-hidden"
                  style={{ borderColor: getRarityConfig(selectedListing.rarity).color }}
                >
                  {selectedListing.imageUrl ? (
                    <img
                      src={resolveUploadUrl(selectedListing.imageUrl)}
                      alt={selectedListing.name?.trim() || selectedListing.position}
                      className="w-full h-full object-contain"
                      style={{ imageRendering: 'pixelated' }}
                      draggable={false}
                    />
                  ) : (
                    <PlayerPixelPortrait
                      rarity={selectedListing.rarity}
                      position={selectedListing.position}
                      name={selectedListing.name}
                      overwall={selectedListing.overwall}
                      seed={selectedListing.basePlayerId || selectedListing.tokenId || selectedListing.id}
                      className="h-full w-full object-contain"
                    />
                  )}
                  <PlayerAgeBadge
                    player={{
                      kind: 'base',
                      age: selectedListing.age,
                      costBasisUsdc: selectedListing.costBasisUsdc,
                    }}
                    className="absolute left-1 bottom-1"
                  />
                </div>
                <div
                  className="player-overwall text-4xl"
                  style={{ color: getRarityConfig(selectedListing.rarity).color }}
                >
                  {selectedListing.overwall.toLocaleString()}
                </div>
                <div className="player-position text-lg mb-3">{selectedListing.position}</div>
                {selectedListing.stock != null && (
                  <p className="pixel-text text-lg text-center mb-3" style={{ color: getRarityConfig(selectedListing.rarity).color }}>
                    {t('market:stock', { qty: selectedListing.stock.toLocaleString('pt-BR') })}
                  </p>
                )}
                <PlayerCareerLife
                  player={{
                    kind: 'base',
                    age: selectedListing.age,
                    costBasisUsdc: selectedListing.costBasisUsdc,
                    roiPct: selectedListing.roiPct,
                  }}
                />
                {(selectedListing.age != null || (selectedListing.costBasisUsdc ?? 0) > 0) && (
                  <p
                    className="mt-3 text-sm leading-snug rounded-lg px-3 py-2"
                    style={{
                      fontFamily: 'var(--font-sans)',
                      color: '#e2e8f0',
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.12)',
                    }}
                  >
                    {t('market:modal.careerHint', {
                      defaultValue:
                        'Idade = carreira do vendedor agora. Depois da compra, a carreira reinicia no preço que você pagar.',
                    })}
                  </p>
                )}
              </div>

              <div className="space-y-3 mb-6">
                <div className="pixel-box-light p-3 flex justify-between">
                  <span className="retro-text text-sm" style={{ color: 'var(--text-muted)' }}>
                    {t('market:modal.seller')}
                  </span>
                  <span className="retro-text text-sm">{selectedListing.seller}</span>
                </div>
              </div>

              <div className="pixel-box p-4 text-center mb-4" style={{ borderColor: 'var(--gold)' }}>
                <div className="pixel-text text-sm mb-1" style={{ color: 'var(--text-muted)' }}>
                  {t('market:modal.price')}
                </div>
                <div className="pixel-text text-3xl" style={{ color: 'var(--gold)' }}>
                  {selectedListing.price} GMT
                </div>
              </div>

              {(selectedListing.basePlayerId || selectedListing.tokenId || (selectedListing.stock ?? 0) > 0) && (
                <motion.button
                  className="pixel-btn pixel-btn-gold pixel-btn-lg w-full"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  disabled={buyListing.isPending}
                  onClick={() => requestSpend({
                    channel: 'p2p',
                    id: selectedListing.id,
                    name: selectedListing.name?.trim() || selectedListing.position,
                    amountGmt: selectedListing.price,
                  })}
                >
                  <i className="bi bi-cash-stack" aria-hidden /> {t('market:modal.buyNow')}
                </motion.button>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>,
      document.body,
      )}

      {spendTarget && (
        <SpendConfirmDialog
          mode="confirm"
          channel={spendTarget.channel}
          itemName={spendTarget.name}
          amountGmt={spendTarget.amountGmt}
          balanceGmt={club?.gmtBalance ?? null}
          pending={spendPending}
          error={spendError}
          onCancel={closeSpend}
          onConfirm={() => void confirmSpend()}
        />
      )}
      {spendReceipt && (
        <SpendConfirmDialog
          mode="receipt"
          channel={spendReceipt.channel}
          itemName={spendReceipt.name}
          amountGmt={spendReceipt.amountGmt}
          balanceAfter={spendReceipt.balanceAfter}
          onCancel={() => setSpendReceipt(null)}
          onConfirm={() => setSpendReceipt(null)}
        />
      )}
    </PageContentShell>
  );
}

type SpendRequest = {
  channel: SpendChannel;
  id: string;
  name: string;
  amountGmt: number;
  shopKind?: 'gear' | 'item';
};

type SpendReceipt = {
  channel: SpendChannel;
  name: string;
  amountGmt: number;
  balanceAfter: number | null;
};

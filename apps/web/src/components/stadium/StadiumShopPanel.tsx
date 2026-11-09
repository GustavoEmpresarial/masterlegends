import { GearSprite } from '../gear/GearSprite';
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { GearCatalogItemDTO, StadiumShopItemDTO } from '@mll/shared';
import { SpendConfirmDialog } from '../economy/SpendConfirmDialog';
import {
  useBuyGear,
  useBuyStadiumShopItem,
  useClub,
  useStadiumShop,
} from '../../hooks/useApi';
import { translateError } from '../../lib/apiError';
import { resolveUploadUrl } from '../../lib/resolveUploadUrl';

type ShopTab = 'gear' | 'stamina' | 'affiliate';

type PendingSpend = {
  kind: 'gear' | 'item';
  id: string;
  name: string;
  amountGmt: number;
};

const RARITY_LABEL = ['Comum', 'Incomum', 'Raro', 'S.Raro', 'Épico', 'Lendário'];

const SLOT_LABEL: Record<string, string> = {
  boots: 'Chuteiras',
  gloves: 'Luvas',
  shinguards: 'Caneleiras',
};

function safeImageSrc(url: string | null | undefined): string | null {
  if (!url) return null;
  const resolved = resolveUploadUrl(url);
  return resolved || null;
}

function pickDefaultTab(gear: number, stamina: number, affiliate: number): ShopTab {
  if (gear > 0) return 'gear';
  if (stamina > 0) return 'stamina';
  if (affiliate > 0) return 'affiliate';
  return 'gear';
}

export function StadiumShopPanel({ compact: _compact = false }: { compact?: boolean }) {
  const { t } = useTranslation(['club', 'common']);
  const { data: shop, isLoading: shopLoading } = useStadiumShop();
  const { data: club } = useClub();
  const buyItem = useBuyStadiumShopItem();
  const buyGear = useBuyGear();

  const staminaItems = useMemo(
    () => (shop?.items ?? []).filter((i) => i.effectType !== 'affiliate_link'),
    [shop?.items],
  );
  const affiliateItems = useMemo(
    () => (shop?.items ?? []).filter((i) => i.effectType === 'affiliate_link'),
    [shop?.items],
  );
  const gearItems = shop?.gear ?? [];

  const [tab, setTab] = useState<ShopTab>('gear');
  const [tabReady, setTabReady] = useState(false);
  const [buyMsg, setBuyMsg] = useState('');
  const [buyErr, setBuyErr] = useState('');
  const [gearBought, setGearBought] = useState(false);
  const [pending, setPending] = useState<PendingSpend | null>(null);
  const [spendError, setSpendError] = useState('');
  const [receipt, setReceipt] = useState<(PendingSpend & { balanceAfter: number | null }) | null>(null);

  useEffect(() => {
    if (shopLoading || tabReady) return;
    setTab(pickDefaultTab(gearItems.length, staminaItems.length, affiliateItems.length));
    setTabReady(true);
  }, [shopLoading, tabReady, gearItems.length, staminaItems.length, affiliateItems.length]);

  function askToBuy(next: PendingSpend) {
    setBuyMsg('');
    setBuyErr('');
    setSpendError('');
    setReceipt(null);
    setPending(next);
  }

  function gearName(item: GearCatalogItemDTO) {
    return t(`club:${item.nameKey}`, { defaultValue: item.nameKey || item.slug });
  }

  function itemName(item: StadiumShopItemDTO) {
    return t(`club:${item.nameKey}`, { defaultValue: item.nameKey || item.slug });
  }

  const spendPending = pending?.kind === 'gear' ? buyGear.isPending : buyItem.isPending;

  async function confirmSpend() {
    if (!pending || spendPending) return;
    const target = pending;
    const before = club?.gmtBalance ?? null;
    setSpendError('');
    try {
      if (target.kind === 'gear') {
        const result = await buyGear.mutateAsync({ catalogItemId: target.id });
        setGearBought(true);
        setBuyMsg(t('club:shop.gearBought'));
        setReceipt({
          ...target,
          balanceAfter: result.gmtBalance ?? (before != null ? before - target.amountGmt : null),
        });
      } else {
        const result = await buyItem.mutateAsync({ itemId: target.id });
        setGearBought(false);
        setBuyMsg(t('club:shop.sentToWarehouse', { defaultValue: 'Comprado! Retire no Almoxarifado.' }));
        setReceipt({
          ...target,
          balanceAfter: result.gmtBalance ?? (before != null ? before - target.amountGmt : null),
        });
      }
      setPending(null);
    } catch (err: unknown) {
      setSpendError(translateError(err, 'INSUFFICIENT_USDC'));
    }
  }

  function closeSpend() {
    if (spendPending) return;
    setPending(null);
    setSpendError('');
  }

  const tabs: { key: ShopTab; label: string; count: number; accent: string; icon: string }[] = [
    {
      key: 'gear',
      label: t('club:shop.gearSection'),
      count: gearItems.length,
      accent: 'var(--green)',
      icon: 'bi-bag-fill',
    },
    {
      key: 'stamina',
      label: t('club:shop.staminaSection'),
      count: staminaItems.length,
      accent: 'var(--gold)',
      icon: 'bi-lightning-charge-fill',
    },
    {
      key: 'affiliate',
      label: t('club:shop.affiliateSection'),
      count: affiliateItems.length,
      accent: 'var(--orange)',
      icon: 'bi-bag-fill',
    },
  ];

  return (
    <section className="w-full min-w-0 space-y-5">
      {/* Count chips */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {tabs.map((chip) => (
          <button
            key={chip.key}
            type="button"
            onClick={() => setTab(chip.key)}
            className="game-shop-shortcut flex items-center gap-3 px-4 py-3 text-left transition-transform hover:scale-[1.01]"
            style={{
              '--surface-accent': chip.accent,
              borderRadius: 6,
              border: `2px solid ${tab === chip.key ? chip.accent : 'rgba(255,255,255,0.12)'}`,
              background: 'var(--game-panel)',
              minHeight: 64,
            } as CSSProperties}
          >
            <i className={`bi ${chip.icon} text-2xl`} aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-label truncate" style={{ color: '#fff' }}>
                {chip.label}
              </p>
              <p className="pixel-text" style={{ fontSize: '1.5rem', color: chip.accent, lineHeight: 1.1 }}>
                {chip.count}
              </p>
            </div>
          </button>
        ))}
      </div>

      {/* Tabs */}
      <div
        className="game-shop-tabs flex flex-wrap gap-1 p-1"
        style={{
          background: '#20222b',
          borderRadius: 6,
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        {tabs.map((item) => {
          const active = tab === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              aria-pressed={active}
              className="game-shop-tab flex-1 min-w-[8rem] px-3 py-3 text-label"
              style={{
                '--surface-accent': item.accent,
                borderRadius: 5,
                minHeight: 48,
                background: active ? 'var(--game-panel)' : 'transparent',
                color: active ? item.accent : '#ffffff',
                border: active ? `1px solid ${item.accent}` : '1px solid transparent',
              } as CSSProperties}
            >
              <i className={`bi ${item.icon}`} aria-hidden /> {item.label} ({item.count})
            </button>
          );
        })}
      </div>

      {shopLoading && (
        <p className="text-body text-center py-10" style={{ color: '#ffffff' }}>
          {t('common:labels.status.loading')}
        </p>
      )}

      {buyErr && (
        <p
          className="text-body text-center px-4 py-3"
          style={{
            color: '#fca5a5',
            background: 'rgba(248,113,113,0.12)',
            border: '1px solid rgba(248,113,113,0.35)',
            borderRadius: 10,
          }}
        >
          {buyErr}
        </p>
      )}
      {buyMsg && (
        <p
          className="text-body text-center px-4 py-3"
          style={{
            color: '#86efac',
            background: 'rgba(74,222,128,0.12)',
            border: '1px solid rgba(74,222,128,0.35)',
            borderRadius: 10,
          }}
        >
          {buyMsg}{' '}
          {gearBought && (
            <Link to="/club/inventory" className="underline font-bold" style={{ color: 'var(--gold)' }}>
              {t('club:shop.goElenco')}
            </Link>
          )}
          {!gearBought && buyMsg && (
            <Link to="/club/warehouse" className="underline font-bold" style={{ color: 'var(--gold)' }}>
              {t('club:shop.goWarehouse', { defaultValue: 'Ver Almoxarifado' })}
            </Link>
          )}
        </p>
      )}

      {!shopLoading && tab === 'gear' && (
        <ProductGrid
          emptyIcon="bi-bag-fill"
          emptyText={t('club:shop.emptyGear')}
          items={gearItems.map((item) => (
            <ProductCard
              key={item.id}
              accent="var(--green)"
              animated
              imageUrl={item.imageUrl}
              placeholder="bi-bag-fill"
              title={t(`club:${item.nameKey}`, { defaultValue: item.nameKey || item.slug })}
              meta={`${RARITY_LABEL[item.rarity] ?? item.rarity} · ${SLOT_LABEL[item.slot] ?? item.slot} · ${t('club:gear.bonus', { ow: item.owBonus, unit: '' })}`}
              priceLabel={`${item.priceGmt} ${t('club:shop.currencyGmt')}`}
              cta={
                pending?.id === item.id && buyGear.isPending
                  ? t('common:labels.status.loading')
                  : t('club:shop.buyGear')
              }
              selected={pending?.id === item.id}
              ctaDisabled={buyGear.isPending}
              onCta={() =>
                askToBuy({
                  kind: 'gear',
                  id: item.id,
                  name: gearName(item),
                  amountGmt: Number(item.priceGmt),
                })
              }
            />
          ))}
        />
      )}

      {!shopLoading && tab === 'stamina' && (
        <ProductGrid
          emptyIcon="bi-lightning-charge-fill"
          emptyText={t('club:shop.emptyStamina')}
          items={staminaItems.map((item) => (
            <ProductCard
              key={item.id}
              accent="var(--gold)"
              imageUrl={item.imageUrl}
              placeholder="bi-lightning-charge-fill"
              animated={Boolean(item.imageUrl)}
              title={t(`club:${item.nameKey}`, { defaultValue: item.nameKey || item.slug })}
              meta={
                item.effectType === 'stamina_full'
                  ? t('club:shop.effectFull')
                  : t('club:shop.effectFlat', { value: item.effectValue })
              }
              priceLabel={`${item.priceUsdc} ${t('club:shop.currencyGmt')}`}
              cta={
                pending?.id === item.id && buyItem.isPending
                  ? t('common:labels.status.loading')
                  : t('club:shop.buy')
              }
              selected={pending?.id === item.id}
              ctaDisabled={buyItem.isPending}
              onCta={() =>
                askToBuy({
                  kind: 'item',
                  id: item.id,
                  name: itemName(item),
                  amountGmt: Number(item.priceUsdc),
                })
              }
            />
          ))}
        />
      )}

      {!shopLoading && tab === 'affiliate' && (
        <ProductGrid
          emptyIcon="bi-bag-fill"
          emptyText={t('club:shop.emptyAffiliate')}
          items={affiliateItems.map((item) => (
            <ProductCard
              key={item.id}
              accent="var(--orange)"
              imageUrl={item.imageUrl}
              placeholder="bi-bag-fill"
              title={t(`club:${item.nameKey}`, { defaultValue: item.nameKey || item.slug })}
              meta={
                [
                  item.externalPlatform,
                  item.description,
                ]
                  .filter(Boolean)
                  .join(' · ') || t('club:shop.affiliateMeta')
              }
              priceLabel={
                item.priceUsdc > 0
                  ? `${item.priceUsdc} ${t('club:shop.currencyGmt')}`
                  : t('club:shop.affiliateFree')
              }
              cta={t('club:shop.openAffiliate')}
              ctaDisabled={!item.affiliateUrl}
              onCta={() => {
                if (item.affiliateUrl) {
                  window.open(item.affiliateUrl, '_blank', 'noopener,noreferrer');
                }
              }}
            />
          ))}
        />
      )}

      {pending && (
        <SpendConfirmDialog
          mode="confirm"
          channel="shop"
          itemName={pending.name}
          amountGmt={pending.amountGmt}
          balanceGmt={club?.gmtBalance ?? null}
          pending={spendPending}
          error={spendError}
          onCancel={closeSpend}
          onConfirm={() => void confirmSpend()}
        />
      )}
      {receipt && (
        <SpendConfirmDialog
          mode="receipt"
          channel="shop"
          itemName={receipt.name}
          amountGmt={receipt.amountGmt}
          balanceAfter={receipt.balanceAfter}
          onCancel={() => setReceipt(null)}
          onConfirm={() => setReceipt(null)}
        />
      )}
    </section>
  );
}

function ProductGrid({
  items,
  emptyIcon,
  emptyText,
}: {
  items: ReactNode[];
  emptyIcon: string;
  emptyText: string;
}) {
  if (items.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-3 py-16 px-4 text-center"
        style={{
          borderRadius: 14,
          border: '2px dashed rgba(255,255,255,0.15)',
          background: 'rgba(0,0,0,0.3)',
        }}
      >
        <span className="text-5xl opacity-70">{emptyIcon}</span>
        <p className="text-body" style={{ color: '#ffffff' }}>
          {emptyText}
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 grid-cols-2 md:grid-cols-3 xl:grid-cols-4 items-stretch">
      {items}
    </div>
  );
}

function ProductCard({
  accent,
  imageUrl,
  placeholder,
  animated = false,
  title,
  meta,
  priceLabel,
  cta,
  ctaDisabled,
  selected = false,
  onCta,
}: {
  accent: string;
  imageUrl: string | null;
  placeholder: string;
  animated?: boolean;
  title: string;
  meta: string;
  priceLabel: string;
  cta: string;
  ctaDisabled?: boolean;
  selected?: boolean;
  onCta: () => void;
}) {
  const resolved = safeImageSrc(imageUrl);
  const [imgFailed, setImgFailed] = useState(false);
  const src = resolved && !imgFailed ? resolved : null;

  useEffect(() => {
    setImgFailed(false);
  }, [resolved]);

  return (
    <article
      className="game-product-card flex flex-col overflow-hidden"
      style={{
        '--surface-accent': accent,
        borderRadius: 8,
        border: `2px solid color-mix(in srgb, ${accent} 43%, #343944)`,
        background: 'var(--game-panel)',
        boxShadow: 'var(--game-bevel)',
      } as CSSProperties}
    >
      <div
        className="relative flex h-28 items-center justify-center shrink-0 overflow-hidden"
        style={{
          background: `linear-gradient(180deg, color-mix(in srgb, ${accent} 13%, transparent) 0%, rgba(0,0,0,0.5) 100%)`,
          borderBottom: `1px solid color-mix(in srgb, ${accent} 20%, transparent)`,
        }}
      >
        {src && animated ? (
          <GearSprite
            src={src}
            className="h-full w-full"
            style={{ aspectRatio: 'auto', height: '100%' }}
            onError={() => setImgFailed(true)}
          />
        ) : src ? (
          <img
            src={src}
            alt=""
            className="h-full w-full object-cover"
            style={{ imageRendering: 'pixelated' }}
            onError={() => setImgFailed(true)}
          />
        ) : (
          <i className={`bi ${placeholder} text-5xl opacity-80`} aria-hidden />
        )}
      </div>

      <div className="flex flex-col gap-2 p-4 flex-1">
        <h3 className="pixel-text" style={{ fontSize: '1.25rem', color: accent, lineHeight: 1.2 }}>
          {title}
        </h3>
        <p className="text-label" style={{ color: '#ffffff' }}>
          {meta}
        </p>
        <p className="pixel-text mt-auto pt-2" style={{ fontSize: '1.75rem', color: '#fff' }}>
          {priceLabel}
        </p>
        <button
          type="button"
          disabled={ctaDisabled}
          aria-pressed={selected}
          onClick={onCta}
          className="game-action w-full text-label font-bold mt-1 active:scale-[0.98]"
          style={{
            minHeight: 48,
            borderRadius: 5,
            border: `2px solid ${selected ? '#fff' : accent}`,
            background: selected
              ? accent
              : `linear-gradient(180deg, color-mix(in srgb, ${accent} 27%, #252733), color-mix(in srgb, ${accent} 13%, #20222d))`,
            color: selected ? '#111' : '#fff',
            boxShadow: selected ? `0 0 0 3px ${accent}` : undefined,
            opacity: ctaDisabled ? 0.5 : 1,
          }}
        >
          {cta}
        </button>
      </div>
    </article>
  );
}

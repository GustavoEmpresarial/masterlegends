import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import type { WarehouseItemDTO } from '@mll/shared';
import { useWarehouse, useClaimWarehouseItem } from '../../../hooks/useApi';
import { resolveUploadUrl } from '../../../lib/resolveUploadUrl';
import { PageContentShell } from '../../../components/content';

const SOURCE_CONFIG: Record<string, { icon: string; label: string; color: string }> = {
  stadium_shop: { icon: 'bi-building', label: 'Lojinha', color: 'var(--gold)' },
  marketplace: { icon: 'bi-cart-fill', label: 'Mercado', color: 'var(--purple)' },
  quest_reward: { icon: 'bi-bullseye', label: 'Tarefa', color: 'var(--gold)' },
  checkin: { icon: 'bi-calendar-event-fill', label: 'Check-in', color: 'var(--green)' },
  offerwall: { icon: 'bi-gift-fill', label: 'Zerads', color: 'var(--cyan)' },
  admin: { icon: 'bi-gear-fill', label: 'Admin', color: 'var(--text-secondary)' },
};

const ITEM_TYPE_ICON: Record<string, string> = {
  player_card: 'bi-suit-club-fill',
  consumable: 'bi-eyedropper',
  stamina_boost: 'bi-lightning-charge-fill',
  gmt_pack: 'bi-cash-stack',
  scout_ticket: 'bi-ticket-perforated-fill',
  overwall_boost: 'bi-graph-up-arrow',
  temp_player: 'bi-hourglass-split',
};

type Filter = 'all' | 'pending' | 'claimed';

function sourceOf(source: string) {
  return SOURCE_CONFIG[source] ?? { icon: 'bi-box-seam-fill', label: source, color: 'var(--text-muted)' };
}

function WarehouseCard({
  item,
  onClaim,
  claiming,
}: {
  item: WarehouseItemDTO;
  onClaim: (id: string) => void;
  claiming: boolean;
}) {
  const src = sourceOf(item.source);
  const typeIcon = ITEM_TYPE_ICON[item.itemType] ?? 'bi-box-seam-fill';
  const expiresLabel = item.expiresAt
    ? Math.max(0, Math.ceil((Date.parse(item.expiresAt) - Date.now()) / 86400000))
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="pixel-box p-3 flex flex-col gap-2 relative"
      style={{ borderColor: item.claimed ? 'var(--text-muted)' : src.color }}
    >
      <span
        className="absolute top-2 left-2 pixel-badge z-10 flex items-center gap-0.5"
        style={{ borderColor: src.color, color: src.color, fontSize: '10px' }}
      >
        <i className={`bi ${src.icon}`} aria-hidden /> {src.label}
      </span>
      {item.quantity > 1 && (
        <span
          className="absolute top-2 right-2 pixel-badge z-10"
          style={{ borderColor: 'var(--gold)', color: 'var(--gold)', fontSize: '10px' }}
        >
          x{item.quantity}
        </span>
      )}

      <div
        className="flex items-center justify-center mt-6 mb-1"
        style={{ height: '72px' }}
      >
        {item.imageUrl ? (
          <img
            src={resolveUploadUrl(item.imageUrl)}
            alt={item.name}
            className="max-h-full max-w-full object-contain"
            style={{ imageRendering: 'pixelated' }}
          />
        ) : (
          <i className={`bi ${typeIcon}`} style={{ fontSize: '44px' }} aria-hidden />
        )}
      </div>

      <p className="retro-text text-center leading-tight" style={{ color: 'var(--text-primary)' }}>
        {item.name}
      </p>
      {item.description && (
        <p
          className="ui-label-sm text-center leading-tight"
          style={{ color: 'var(--text-muted)' }}
        >
          {item.description}
        </p>
      )}
      {expiresLabel !== null && (
        <p className="ui-label-sm text-center" style={{ color: 'var(--orange)' }}>
          Expira em {expiresLabel}d
        </p>
      )}

      {item.claimed ? (
        <span
          className="pixel-badge text-center"
          style={{ borderColor: 'var(--green)', color: 'var(--green)', fontSize: '10px' }}
        >
          <i className="bi bi-check-lg" aria-hidden /> Resgatado
        </span>
      ) : (
        <button
          type="button"
          onClick={() => onClaim(item.id)}
          disabled={claiming}
          className="pixel-btn pixel-btn-gold pixel-btn-sm w-full"
        >
          {claiming ? '...' : <><i className="bi bi-download" aria-hidden /> Resgatar</>}
        </button>
      )}
    </motion.div>
  );
}

export function WarehousePage() {
  const { data, isLoading } = useWarehouse();
  const claim = useClaimWarehouseItem();
  const [filter, setFilter] = useState<Filter>('all');
  const [error, setError] = useState<string | null>(null);

  const items = data?.items ?? [];

  const filtered = useMemo(() => {
    if (filter === 'pending') return items.filter((i) => !i.claimed);
    if (filter === 'claimed') return items.filter((i) => i.claimed);
    return items;
  }, [items, filter]);

  const handleClaim = (id: string) => {
    setError(null);
    claim.mutate(id, {
      onError: (err: unknown) => {
        const msg =
          err && typeof err === 'object' && 'message' in err
            ? String((err as { message: unknown }).message)
            : 'Falha ao resgatar item';
        setError(msg);
      },
    });
  };

  if (isLoading) {
    return (
      <div className="pixel-card text-center py-16">
        <p className="retro-text text-xl" style={{ color: 'var(--text-muted)' }}>
          Carregando...
        </p>
      </div>
    );
  }

  return (
    <PageContentShell>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="pixel-text text-xl sm:text-2xl md:text-3xl" style={{ color: 'var(--purple)' }}>
          <i className="bi bi-box-seam-fill" aria-hidden /> Almoxarifado
        </h1>
        <p className="retro-text text-lg mt-1" style={{ color: 'var(--text-secondary)' }}>
          Itens comprados na Lojinha do estádio ficam aqui até você resgatar.
        </p>
      </motion.div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 w-full min-w-0 max-w-xl">
        <div className="pixel-box p-4 text-center" style={{ borderColor: 'var(--purple)' }}>
          <p className="ui-label-sm" style={{ color: 'var(--text-muted)' }}>
            Total
          </p>
          <p className="retro-text text-2xl" style={{ color: 'var(--purple)' }}>
            {data?.total ?? 0}
          </p>
        </div>
        <div className="pixel-box p-4 text-center" style={{ borderColor: 'var(--gold)' }}>
          <p className="ui-label-sm" style={{ color: 'var(--text-muted)' }}>
            A resgatar
          </p>
          <p className="retro-text text-2xl" style={{ color: 'var(--gold)' }}>
            {data?.pending ?? 0}
          </p>
        </div>
      </div>

      {error && (
        <div className="pixel-card" style={{ borderColor: 'var(--red)' }}>
          <p className="retro-text" style={{ color: 'var(--red)' }}>
            {error}
          </p>
        </div>
      )}

      {items.length > 0 && (
        <div className="pixel-card flex flex-wrap gap-2">
          {(
            [
              ['all', 'Todos'],
              ['pending', 'A resgatar'],
              ['claimed', 'Resgatados'],
            ] as [Filter, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`pixel-btn pixel-btn-sm ${filter === key ? 'pixel-btn-gold' : ''}`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="pixel-card text-center py-12">
          <p className="retro-text text-xl mb-4" style={{ color: 'var(--text-muted)' }}>
            {items.length === 0
              ? 'Seu almoxarifado está vazio.'
              : 'Nenhum item neste filtro.'}
          </p>
          <Link to="/club/shop" className="pixel-btn pixel-btn-gold pixel-btn-md">
            <i className="bi bi-building" aria-hidden /> Ir à Lojinha
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 w-full">
          {filtered.map((item) => (
            <WarehouseCard
              key={item.id}
              item={item}
              onClaim={handleClaim}
              claiming={claim.isPending && claim.variables === item.id}
            />
          ))}
        </div>
      )}
    </PageContentShell>
  );
}

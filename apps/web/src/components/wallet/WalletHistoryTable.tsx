import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { WalletTransactionItemDTO } from '@mll/shared';
import { getExplorerTxUrl } from '../../lib/web3/chains';
import { formatGmtAmount, formatWalletUsdcAmount } from '../../lib/formatUsdc';

interface WalletHistoryTableProps {
  items: WalletTransactionItemDTO[];
  ledgerStartedAt: string | null;
  isLoading?: boolean;
  gmtReceived?: number;
  gmtSpent?: number;
  filter?: HistoryFilter;
  onFilter?: (filter: HistoryFilter) => void;
}

type HistoryFilter = 'all' | 'gmt' | 'in' | 'out';

/** Moeda real da transação: meta.currency quando presente; mining_claim/coach_fee sem tag são legado (pré-01/08/2026, pagos em USDC); resto é GMT. */
function resolveCurrency(item: WalletTransactionItemDTO): string {
  const c = item.meta?.currency;
  if (typeof c === 'string' && c) return c.toUpperCase();
  if (item.source === 'usdc') return 'USDC';
  if (item.type === 'mining_claim' || item.type === 'coach_fee') return 'USDC';
  return 'GMT';
}

function movementOf(item: WalletTransactionItemDTO) {
  const movement = item.meta?.movement;
  if (typeof movement === 'string' && movement) return movement;
  return item.amount >= 0 ? 'credit' : 'debit';
}

function formatDate(value: string) {
  return new Date(value).toLocaleString(undefined, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function partyLabel(
  item: WalletTransactionItemDTO,
  side: 'origin' | 'destination',
  t: (key: string, options?: { defaultValue?: string }) => string,
) {
  const movement = movementOf(item);
  const explicit = item.meta?.[side];
  const incoming = movement === 'credit' || movement === 'release';
  const showOrigin = side === 'origin' && incoming;
  const showDestination = side === 'destination' && !incoming;
  const raw = typeof explicit === 'string' && explicit ? explicit : (showOrigin || showDestination ? item.type : '');
  if (!raw) return '—';
  const label = t(`wallet.history.types.${raw}`, { defaultValue: raw });
  if (side === 'destination' && typeof item.meta?.listingId === 'string') {
    const seller = typeof item.meta.sellerId === 'string' ? item.meta.sellerId.slice(0, 8) : '';
    const listing = item.meta.listingId.slice(0, 8);
    return seller ? `${label} · ${listing} · ${seller}` : `${label} · ${listing}`;
  }
  if (side === 'origin' && typeof item.meta?.listingId === 'string' && incoming) {
    return `${label} · ${item.meta.listingId.slice(0, 8)}`;
  }
  return label;
}

export function WalletHistoryTable({
  items,
  ledgerStartedAt,
  isLoading,
  gmtReceived = 0,
  gmtSpent = 0,
  filter = 'gmt',
  onFilter,
}: WalletHistoryTableProps) {
  const { t } = useTranslation('common');
  const [localFilter, setLocalFilter] = useState<HistoryFilter>(filter);
  const activeFilter = onFilter ? filter : localFilter;
  const setFilter = onFilter ?? setLocalFilter;
  const visible = items;
  const filters: HistoryFilter[] = ['gmt', 'in', 'out', 'all'];

  if (isLoading) {
    return (
      <p className="retro-text py-8 text-center text-base" style={{ color: 'var(--text-muted)' }}>
        {t('labels.status.loading')}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="pixel-box-light p-4" style={{ borderColor: 'var(--green)' }}>
          <p className="ui-label-sm" style={{ color: 'var(--text-muted)' }}>{t('wallet.history.received')}</p>
          <p className="pixel-text text-xl" style={{ color: 'var(--green)' }}>+{formatGmtAmount(gmtReceived)} GMT</p>
        </div>
        <div className="pixel-box-light p-4" style={{ borderColor: 'var(--red)' }}>
          <p className="ui-label-sm" style={{ color: 'var(--text-muted)' }}>{t('wallet.history.spent')}</p>
          <p className="pixel-text text-xl" style={{ color: 'var(--red)' }}>-{formatGmtAmount(gmtSpent)} GMT</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {filters.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={`pixel-btn pixel-btn-md ${activeFilter === key ? 'pixel-btn-blue' : ''}`}
            style={activeFilter === key ? undefined : { background: 'var(--bg-light)', color: 'var(--text-secondary)' }}
          >
            {t(`wallet.history.filter${key === 'gmt' ? 'Gmt' : key === 'in' ? 'In' : key === 'out' ? 'Out' : 'All'}`)}
          </button>
        ))}
      </div>

      {ledgerStartedAt && (
        <p className="retro-text text-sm" style={{ color: 'var(--text-muted)' }}>
          {t('wallet.history.since', { date: new Date(ledgerStartedAt).toLocaleDateString() })}
        </p>
      )}

      {visible.length === 0 ? (
        <div className="pixel-box-light py-12 text-center">
          <p className="retro-text text-base" style={{ color: 'var(--text-secondary)' }}>
            {t('wallet.history.empty')}
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {visible.map((item) => {
              const positive = item.amount >= 0;
              const typeKey = `wallet.history.types.${item.type}`;
              return (
                <div
                  key={`${item.source}-${item.id}-mobile`}
                  className="pixel-box-light p-4"
                  style={{ borderColor: 'var(--bg-lighter)' }}
                >
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <p className="retro-text text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {formatDate(item.createdAt)}
                    </p>
                    <p
                      className="retro-text text-base font-bold whitespace-nowrap"
                      style={{ color: positive ? 'var(--green)' : 'var(--red)' }}
                    >
                      {positive ? '+' : '-'}
                      {formatWalletUsdcAmount(item.type, item.amount, resolveCurrency(item))} {resolveCurrency(item)}
                    </p>
                  </div>
                  <p className="retro-text text-base" style={{ color: 'var(--text-primary)' }}>
                    {t(typeKey, { defaultValue: item.type })}
                  </p>
                  <p className="retro-text mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {t('wallet.history.origin')}: {partyLabel(item, 'origin', t)}
                  </p>
                  <p className="retro-text text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {t('wallet.history.destination')}: {partyLabel(item, 'destination', t)}
                  </p>
                  {item.balanceAfter != null && (
                    <p className="retro-text text-sm" style={{ color: 'var(--text-muted)' }}>
                      {t('wallet.history.balanceAfter')}: {formatWalletUsdcAmount(item.type, item.balanceAfter, resolveCurrency(item))}
                    </p>
                  )}
                  {item.txHash && (
                    <a
                      href={getExplorerTxUrl(item.txHash)}
                      target="_blank"
                      rel="noreferrer"
                      className="retro-text mt-2 inline-block text-sm underline break-all"
                      style={{ color: 'var(--blue)' }}
                    >
                      {item.txHash}
                    </a>
                  )}
                </div>
              );
            })}
          </div>

          <div className="hidden md:block pixel-table-wrap">
            <table className="w-full min-w-full border-collapse text-left">
              <thead>
                <tr className="border-b-2" style={{ borderColor: 'var(--bg-lighter)' }}>
                  <th className="ui-label py-3 pr-4">{t('wallet.history.date')}</th>
                  <th className="ui-label py-3 pr-4">{t('wallet.history.type')}</th>
                  <th className="ui-label py-3 pr-4">{t('wallet.history.origin')}</th>
                  <th className="ui-label py-3 pr-4">{t('wallet.history.destination')}</th>
                  <th className="ui-label py-3 pr-4">{t('wallet.history.amount')}</th>
                  <th className="ui-label py-3 pr-4">{t('wallet.history.balanceAfter')}</th>
                  <th className="ui-label py-3">{t('wallet.history.tx')}</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((item) => {
                  const positive = item.amount >= 0;
                  const typeKey = `wallet.history.types.${item.type}`;
                  return (
                    <tr
                      key={`${item.source}-${item.id}`}
                      className="border-b"
                      style={{ borderColor: 'var(--bg-dark)' }}
                    >
                      <td className="retro-text py-4 pr-4 text-sm whitespace-nowrap">
                        {formatDate(item.createdAt)}
                      </td>
                      <td className="retro-text py-4 pr-4 text-sm">
                        {t(typeKey, { defaultValue: item.type })}
                      </td>
                      <td className="retro-text py-4 pr-4 text-sm">
                        {partyLabel(item, 'origin', t)}
                      </td>
                      <td className="retro-text py-4 pr-4 text-sm">
                        {partyLabel(item, 'destination', t)}
                      </td>
                      <td
                        className="retro-text py-4 pr-4 text-base font-bold whitespace-nowrap"
                        style={{ color: positive ? 'var(--green)' : 'var(--red)' }}
                      >
                        {positive ? '+' : '-'}
                        {formatWalletUsdcAmount(item.type, item.amount, resolveCurrency(item))} {resolveCurrency(item)}
                      </td>
                      <td className="retro-text py-4 pr-4 text-sm whitespace-nowrap">
                        {item.balanceAfter != null ? formatWalletUsdcAmount(item.type, item.balanceAfter, resolveCurrency(item)) : '—'}
                      </td>
                      <td className="retro-text py-4 text-sm">
                        {item.txHash ? (
                          <a
                            href={getExplorerTxUrl(item.txHash)}
                            target="_blank"
                            rel="noreferrer"
                            className="underline break-all"
                            style={{ color: 'var(--blue)' }}
                          >
                            {item.txHash}
                          </a>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

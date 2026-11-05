import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { pvpTierRangeLabel, type PvpTier } from '@mll/shared';
import { apiClient } from '../../lib/api/client';

interface PvpListing {
  id: string;
  hostClubName: string;
  tierId: string;
  stakeGmt: number;
  hostOverwall: number;
  challengerClubName: string | null;
  challengerOverwall: number | null;
  result: string | null;
  winnerUserId: string | null;
  mine: boolean;
}

interface PvpBoard {
  overwall: number;
  tierId: string;
  gmt: number;
  tiers: PvpTier[];
  mine: PvpListing | null;
  open: PvpListing[];
  recent: PvpListing[];
}

function reasonOf(error: unknown): string | undefined {
  const data = (error as { response?: { data?: { error?: { code?: string; details?: { reason?: string } } } } })
    ?.response?.data;
  if (data?.error?.code === 'INSUFFICIENT_GMT') return 'not_enough';
  return data?.error?.details?.reason;
}

function ow(value: number): string {
  return value.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
}

export function PvPPage() {
  const { t } = useTranslation('pvp');
  const queryClient = useQueryClient();
  const [stake, setStake] = useState('10');
  const [notice, setNotice] = useState('');

  const board = useQuery({
    queryKey: ['pvp-board'],
    queryFn: async () => {
      const { data } = await apiClient.get<PvpBoard>('/api/pvp/board');
      return data;
    },
  });

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ['pvp-board'] });
    void queryClient.invalidateQueries({ queryKey: ['wallet'] });
    void queryClient.invalidateQueries({ queryKey: ['club'] });
  }

  function fail(error: unknown) {
    const reason = reasonOf(error);
    if (reason === 'already_listed') setNotice(t('alreadyListed'));
    else if (reason === 'tier_mismatch') setNotice(t('tierMismatch'));
    else if (reason === 'not_enough' || reason === 'amount below minimum') setNotice(t('notEnough'));
    else if ((error as { response?: { status?: number } })?.response?.status === 404) setNotice(t('needClub'));
    else setNotice(t('failed'));
  }

  const create = useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post('/api/pvp/listings', { stakeGmt: Number(stake) });
      return data;
    },
    onSuccess: () => {
      setNotice('');
      refresh();
    },
    onError: fail,
  });

  const cancel = useMutation({
    mutationFn: async (id: string) => apiClient.post(`/api/pvp/listings/${id}/cancel`),
    onSuccess: () => {
      setNotice('');
      refresh();
    },
    onError: fail,
  });

  const accept = useMutation({
    mutationFn: async (id: string) => apiClient.post(`/api/pvp/listings/${id}/accept`),
    onSuccess: () => {
      setNotice('');
      refresh();
    },
    onError: fail,
  });

  const data = board.data;
  const tier = data?.tiers.find((item) => item.id === data.tierId);

  return (
    <div className="page-content-shell w-full min-w-0 space-y-4">
      <div style={{ textAlign: 'center' }}>
        <h1 className="pixel-text" style={{ fontSize: 'clamp(18px,4vw,30px)', color: '#ff3d00' }}>
          PvP — ARENA
        </h1>
        <p className="pixel-text mt-2" style={{ color: '#ffd600', fontSize: 12, letterSpacing: '0.08em' }}>
          {t('subtitle')}
        </p>
        <p className="retro-text mx-auto mt-3 max-w-2xl text-sm" style={{ color: '#f2f2f2' }}>
          {t('rule')}
        </p>
      </div>

      {board.isError && (
        <p className="retro-text text-center text-sm" style={{ color: '#e8c56a' }}>{t('needClub')}</p>
      )}

      {data && tier && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label={t('yourPower')} value={`${ow(data.overwall)} OW`} />
            <Stat label={t('yourTier')} value={`${tier.label} · ${pvpTierRangeLabel(tier)}`} />
            <Stat label="GMT" value={data.gmt.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} />
          </div>

          <div className="pixel-card space-y-3 p-4">
            {data.mine ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="ui-label text-xs" style={{ color: 'var(--text-muted)' }}>{t('yourListing')}</p>
                  <p className="retro-text text-lg" style={{ color: '#fff' }}>
                    {ow(data.mine.hostOverwall)} OW · {data.mine.stakeGmt.toLocaleString('pt-BR')} GMT
                  </p>
                </div>
                <button
                  type="button"
                  className="pixel-btn pixel-btn-sm"
                  disabled={cancel.isPending}
                  onClick={() => cancel.mutate(data.mine!.id)}
                >
                  {t('cancel')}
                </button>
              </div>
            ) : (
              <form
                className="flex flex-wrap items-end gap-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  setNotice('');
                  create.mutate();
                }}
              >
                <label className="space-y-1">
                  <span className="ui-label text-xs" style={{ color: 'var(--text-muted)' }}>{t('stake')}</span>
                  <input
                    className="pixel-input"
                    inputMode="decimal"
                    value={stake}
                    onChange={(event) => setStake(event.target.value)}
                  />
                </label>
                <button type="submit" className="pixel-btn pixel-btn-green" disabled={create.isPending}>
                  {create.isPending ? t('listing') : t('list')}
                </button>
              </form>
            )}
            {notice && <p className="retro-text text-sm" style={{ color: '#e8c56a' }}>{notice}</p>}
          </div>

          <section className="space-y-2">
            <h2 className="ui-label text-xs" style={{ color: 'var(--text-muted)' }}>{t('openBoard')}</h2>
            {data.open.length === 0 ? (
              <p className="retro-text text-sm" style={{ color: '#f2f2f2' }}>{t('emptyBoard')}</p>
            ) : (
              data.open.map((listing) => (
                <article key={listing.id} className="pixel-card flex flex-wrap items-center justify-between gap-3 p-3">
                  <div>
                    <p className="retro-text text-base" style={{ color: '#fff' }}>{listing.hostClubName}</p>
                    <p className="retro-text text-sm" style={{ color: '#ffd600' }}>
                      {ow(listing.hostOverwall)} OW · {listing.stakeGmt.toLocaleString('pt-BR')} GMT
                    </p>
                  </div>
                  <button
                    type="button"
                    className="pixel-btn pixel-btn-red pixel-btn-sm"
                    disabled={accept.isPending}
                    onClick={() => {
                      setNotice('');
                      accept.mutate(listing.id);
                    }}
                  >
                    {accept.isPending ? t('fighting') : t('fight')}
                  </button>
                </article>
              ))
            )}
          </section>

          {data.recent.length > 0 && (
            <section className="space-y-2">
              <h2 className="ui-label text-xs" style={{ color: 'var(--text-muted)' }}>{t('recent')}</h2>
              {data.recent.map((listing) => (
                <p key={listing.id} className="retro-text text-sm" style={{ color: '#f2f2f2' }}>
                  {listing.hostClubName} {ow(listing.hostOverwall)} × {listing.challengerClubName ?? '—'} {listing.challengerOverwall == null ? '' : ow(listing.challengerOverwall)}
                  {' · '}
                  {resultLabel(t, listing)}
                </p>
              ))}
            </section>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="pixel-card p-3 text-center">
      <p className="ui-label text-xs" style={{ color: 'var(--text-muted)' }}>{label}</p>
      <p className="pixel-text mt-1 text-sm" style={{ color: '#ffd600' }}>{value}</p>
    </div>
  );
}

function resultLabel(t: (key: string) => string, listing: PvpListing): string {
  if (listing.result === 'draw') return t('draw');
  const hostWon = listing.result === 'host';
  const iWon = (hostWon && listing.mine) || (!hostWon && !listing.mine);
  return iWon ? t('won') : t('lost');
}

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { apiClient } from '../../../lib/api/client';
import { extractErrorCode } from '../../../lib/apiError';
import { resolveUploadUrl } from '../../../lib/resolveUploadUrl';
import { PageContentShell } from '../../../components/content';
import { useInventory } from '../../../hooks/useApi';
import type { InventoryPlayerDTO } from '@mll/shared';

const POSITIONS = ['GK', 'DEF', 'LAT', 'MID', 'FW'] as const;
const ACCENT = '#e8c56a';
/** Os cards com moldura (edge) são ~2:3. 3:4 cortava a faixa de baixo. */
const CARD_RATIO = '2 / 3';

type Position = (typeof POSITIONS)[number];

interface BonecoLook {
  playerId: string;
  playerKind: 'base' | 'nft';
  imageUrl: string;
  position: Position;
  kit: string;
  trim: string;
  pose: string;
  note: string;
  updatedAt: string;
}

function playerKey(player: { kind: string; id: string }): string {
  return `${player.kind}:${player.id}`;
}

function isPosition(value: string): value is Position {
  return (POSITIONS as readonly string[]).includes(value);
}

function reasonOf(error: unknown): string | undefined {
  const data = (error as { response?: { data?: { error?: { details?: { reason?: string } } } } })
    ?.response?.data;
  return data?.error?.details?.reason;
}

function BonecoCard({
  imageUrl,
  accent,
}: {
  imageUrl: string | null;
  accent: string;
}) {
  const { t } = useTranslation('common');

  return (
    <div
      className="mx-auto w-[min(100%,280px)] sm:w-full sm:max-w-[420px]"
      style={{ borderRadius: 6, background: '#0d0f1a' }}
    >
      {imageUrl ? (
        <img
          src={resolveUploadUrl(imageUrl)}
          alt={t('boneco.title')}
          className="block h-auto w-full"
          style={{ borderRadius: 6 }}
          draggable={false}
        />
      ) : (
    <div
      className="flex h-full w-full items-center justify-center px-4"
      style={{
        aspectRatio: CARD_RATIO,
        borderRadius: 6,
        border: `3px solid ${accent}`,
        background: 'linear-gradient(180deg, #1a1d2e 0%, #0d0f1a 100%)',
      }}
    >
      <p className="retro-text max-w-[16rem] text-center text-sm" style={{ color: '#fff', opacity: 0.7 }}>
        {t('boneco.empty')}
      </p>
    </div>
      )}
    </div>
  );
}

export function BonecoPage() {
  const { t } = useTranslation('common');
  const queryClient = useQueryClient();
  const [note, setNote] = useState('');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [notice, setNotice] = useState('');

  const inventory = useInventory();
  const players = inventory.data?.players ?? [];
  const looks = useQuery({
    queryKey: ['boneco'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ looks: BonecoLook[] }>('/api/boneco');
      return data.looks;
    },
  });

  function applyPlayer(player: InventoryPlayerDTO, saved: BonecoLook | undefined) {
    setSelectedKey(playerKey(player));
    setNote(saved?.note ?? '');
  }

  useEffect(() => {
    if (selectedKey || players.length === 0 || !looks.isFetched) return;
    const first = players[0];
    if (!first) return;
    const saved = (looks.data ?? []).find((look) => playerKey({ kind: look.playerKind, id: look.playerId }) === playerKey(first));
    applyPlayer(first, saved);
  }, [players, selectedKey, looks.data]);

  const selected = players.find((player) => playerKey(player) === selectedKey) ?? null;
  const selectedLook = (looks.data ?? []).find((look) => selected && playerKey({ kind: look.playerKind, id: look.playerId }) === playerKey(selected));

  const generate = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error('no_player');
      const { data } = await apiClient.post<{ look: BonecoLook }>('/api/boneco/generate', {
        playerId: selected.id,
        playerKind: selected.kind,
        position: isPosition(selected.position) ? selected.position : 'FW',
        note,
      });
      return data.look;
    },
    onSuccess: (next) => {
      queryClient.setQueryData<BonecoLook[]>(['boneco'], (current) => {
        const rest = (current ?? []).filter((look) => playerKey({ kind: look.playerKind, id: look.playerId }) !== playerKey({ kind: next.playerKind, id: next.playerId }));
        return [next, ...rest];
      });
      setNotice(t('boneco.saved'));
      void queryClient.invalidateQueries({ queryKey: ['wallet'] });
      void queryClient.invalidateQueries({ queryKey: ['club'] });
    },
    onError: (error: unknown) => {
      const reason = reasonOf(error);
      const code = extractErrorCode(error);
      if (code === 'INSUFFICIENT_USDC') setNotice(t('boneco.insufficient'));
      else if (reason === 'openrouter_not_configured') setNotice(t('boneco.missingKey'));
      else if (reason === 'player_not_owned') setNotice(t('boneco.notOwned'));
      else setNotice(t('boneco.failed'));
    },
  });

  const accent = ACCENT;
  const imageUrl = selectedLook?.imageUrl ?? selected?.imageUrl ?? null;

  return (
    <PageContentShell>
      <div className="min-w-0 max-w-full overflow-x-hidden">
      <div className="px-1 text-center">
        <h1
          className="break-words leading-tight"
          style={{
            color: accent,
            fontFamily: 'var(--font-pixel)',
            fontSize: 'clamp(1rem, 4.8vw, 2.25rem)',
          }}
        >
          {t('boneco.title')}
        </h1>
        <p className="retro-text mt-2 text-sm leading-snug sm:mt-3 sm:text-lg" style={{ color: '#f2f2f2' }}>
          {t('boneco.subtitle')}
        </p>
      </div>

      <div className="mt-4 grid min-w-0 max-w-full items-start gap-4 overflow-x-hidden sm:mt-6 sm:gap-6 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <div className="min-w-0 max-w-full">
          <BonecoCard imageUrl={imageUrl} accent={accent} />
        </div>

        <div className="pixel-card min-w-0 max-w-full space-y-4 overflow-hidden p-3 sm:space-y-5 sm:p-5">
          <fieldset className="min-w-0 max-w-full space-y-2">
            <legend className="ui-label text-xs" style={{ color: 'var(--text-muted)' }}>{t('boneco.pick')}</legend>
            {players.length === 0 ? (
              <p className="retro-text text-sm" style={{ color: '#f2f2f2' }}>{t('boneco.noPlayers')}</p>
            ) : (
              <div className="grid max-h-64 min-w-0 max-w-full grid-cols-4 gap-2 overflow-x-hidden overflow-y-auto pb-1 sm:max-h-72 sm:grid-cols-[repeat(auto-fill,minmax(4.75rem,1fr))]">
                {players.map((player) => {
                  const key = playerKey(player);
                  const active = key === selectedKey;
                  const thumb = (looks.data ?? []).find((look) => playerKey({ kind: look.playerKind, id: look.playerId }) === key)?.imageUrl
                    ?? player.imageUrl;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => applyPlayer(player, (looks.data ?? []).find((look) => playerKey({ kind: look.playerKind, id: look.playerId }) === key))}
                      className="flex min-w-0 w-full flex-col items-center gap-1 overflow-hidden p-1"
                      style={{
                        borderRadius: 4,
                        border: active ? `2px solid ${accent}` : '2px solid rgba(255,255,255,0.15)',
                        background: active ? `${accent}22` : 'transparent',
                      }}
                    >
                      <span className="block w-full overflow-hidden" style={{ aspectRatio: CARD_RATIO }}>
                      {thumb ? (
                        <img src={resolveUploadUrl(thumb)} alt="" className="block h-full w-full object-contain" />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center retro-text text-xs" style={{ color: '#fff' }}>{player.position}</span>
                      )}
                      </span>
                      <span className="retro-text w-full truncate text-center text-[10px]" style={{ color: '#fff' }}>
                        {player.name || player.position}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </fieldset>

          <fieldset className="min-w-0 max-w-full space-y-2">
            <legend className="ui-label text-xs" style={{ color: 'var(--text-muted)' }}>{t('boneco.note')}</legend>
            <textarea
              value={note}
              maxLength={400}
              rows={3}
              placeholder={t('boneco.notePlaceholder')}
              onChange={(event) => setNote(event.target.value)}
              className="retro-text box-border w-full max-w-full resize-none px-3 py-2 text-base sm:text-sm"
              style={{
                color: '#f2f2f2',
                background: '#0d0f1a',
                border: '2px solid rgba(255,255,255,0.2)',
                borderRadius: 4,
              }}
            />
          </fieldset>

          {notice && (
            <p className="retro-text text-sm" style={{ color: '#e8c56a' }}>{notice}</p>
          )}

          <p className="retro-text text-sm" style={{ color: accent }}>{t('boneco.cost')}</p>
          <button
            type="button"
            className="pixel-btn pixel-btn-green pixel-btn-md w-full sm:w-auto"
            disabled={generate.isPending || !selected}
            onClick={() => {
              setNotice('');
              generate.mutate();
            }}
          >
            {generate.isPending ? t('boneco.generating') : t('boneco.generate')}
          </button>
        </div>
      </div>
      </div>
    </PageContentShell>
  );
}

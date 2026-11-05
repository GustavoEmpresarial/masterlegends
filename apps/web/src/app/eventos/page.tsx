import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { apiClient } from '../../lib/api/client';
import { translateError } from '../../lib/apiError';
import { PageContentShell } from '../../components/content';

type Reward = {
  type: string;
  amount?: number;
  playerName?: string;
  overwall?: number;
  days?: number;
};

type Quest = {
  id: string;
  kind: string;
  campaignId: string | null;
  title: string;
  description: string;
  trigger: string;
  target: number;
  period: string;
  periodKey: string;
  rewards: Reward[];
  count: number;
  completed: boolean;
  claimed: boolean;
  claimedAt?: string | null;
  canClaim: boolean;
  sortOrder: number;
};

type Campaign = {
  id: string;
  slug: string;
  title: string;
  body: string;
  imageUrl: string | null;
  startsAt: string;
  endsAt: string;
  quests: Quest[];
};

type Badge = {
  id: string;
  code: string;
  title: string;
  iconUrl: string | null;
  unlocked: boolean;
};

type Board = {
  campaigns: Campaign[];
  tasks: Quest[];
  achievements: Quest[];
  eventTasks: Quest[];
  badges: Badge[];
};

type Tab = 'events' | 'tasks' | 'achievements' | 'history';

function formatRewards(rewards: Reward[] | null | undefined): string {
  if (!rewards?.length) return '';
  return rewards
    .map((r) => {
      const type = String(r.type ?? '').toLowerCase();
      if (type === 'overwall') {
        // Duração fixa no grant (EVENT_OVERWALL_DURATION_DAYS) — sempre inline como o 30d do temp_player
        return `${r.amount ?? 0} Overwall · poder temporário (7 dias)`;
      }
      if (type === 'gmt' || type === 'usdc' || type === 'usdt') {
        return `${r.amount ?? 0} ${type.toUpperCase()}`;
      }
      return '';
    })
    .filter(Boolean)
    .join(' · ');
}

function hasOverwallReward(rewards: Reward[] | null | undefined): boolean {
  return Boolean(rewards?.some((r) => String(r.type ?? '').toLowerCase() === 'overwall'));
}

function normalizeBoard(raw: unknown): Board {
  const d = (raw && typeof raw === 'object' ? raw : {}) as Partial<Board>;
  return {
    campaigns: Array.isArray(d.campaigns) ? d.campaigns : [],
    tasks: Array.isArray(d.tasks) ? d.tasks : [],
    achievements: Array.isArray(d.achievements) ? d.achievements : [],
    eventTasks: Array.isArray(d.eventTasks) ? d.eventTasks : [],
    badges: Array.isArray(d.badges) ? d.badges : [],
  };
}

function QuestCard({
  quest,
  onClaim,
  claiming,
  claimLabel,
  claimedLabel,
  progressLabel,
  overwallHint,
}: {
  quest: Quest;
  onClaim: (id: string) => void;
  claiming: boolean;
  claimLabel: string;
  claimedLabel: string;
  progressLabel: string;
  overwallHint: string;
}) {
  const showOwHint = hasOverwallReward(quest.rewards);
  const isClaimed = quest.claimed;
  const canClaim = quest.canClaim && !claiming;

  return (
    <div
      className="h-full min-w-0 rounded-xl p-4 sm:p-5 space-y-3"
      style={{
        background: 'rgba(22, 34, 48, 0.98)',
        border: '2px solid rgba(255,255,255,0.22)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.35)',
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base sm:text-lg font-bold text-white">{quest.title}</h3>
          <p className="mt-1 text-sm sm:text-base leading-relaxed" style={{ color: '#e8eef5' }}>
            {quest.description}
          </p>
        </div>
        <span
          className="shrink-0 rounded-md px-2 py-0.5 text-[10px] sm:text-xs uppercase tracking-wide font-semibold"
          style={{
            border: '1px solid rgba(255,255,255,0.35)',
            color: '#f1f5f9',
            background: 'rgba(255,255,255,0.12)',
          }}
        >
          {(quest.kind ?? 'quest').replace(/_/g, ' ')}
        </span>
      </div>
      <div className="space-y-1.5">
        <p className="text-sm sm:text-base font-bold" style={{ color: '#5dff9a' }}>
          {formatRewards(quest.rewards)}
        </p>
        {showOwHint && (
          <p
            className="rounded-md px-2.5 py-1.5 text-xs sm:text-sm font-semibold leading-snug"
            style={{
              color: '#fff7c2',
              background: 'rgba(245, 158, 11, 0.22)',
              border: '1px solid rgba(251, 191, 36, 0.55)',
            }}
          >
            {overwallHint}
          </p>
        )}
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex justify-between text-xs sm:text-sm" style={{ color: '#e2e8f0' }}>
            <span>{progressLabel}</span>
            <span className="font-bold text-white">
              {quest.count}/{quest.target}
            </span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full" style={{ background: 'rgba(255,255,255,0.18)' }}>
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.min(100, (quest.count / Math.max(1, quest.target)) * 100)}%`,
                background: '#3dff8a',
              }}
            />
          </div>
        </div>
        {quest.claimed && quest.claimedAt && (
          <p className="text-xs sm:text-sm font-semibold" style={{ color: '#cbd5e1' }}>
            Coletado em {new Date(quest.claimedAt).toLocaleString('pt-BR')}
          </p>
        )}
        <button
          type="button"
          disabled={!canClaim}
          onClick={() => onClaim(quest.id)}
          className="w-full sm:w-auto shrink-0 rounded-lg px-4 py-2.5 text-sm font-bold transition-opacity disabled:cursor-not-allowed"
          style={
            isClaimed
              ? {
                  background: '#475569',
                  color: '#f8fafc',
                  border: '1px solid #94a3b8',
                  opacity: 1,
                }
              : canClaim
                ? {
                    background: 'var(--green)',
                    color: '#06120a',
                    border: '1px solid #5dff9a',
                  }
                : {
                    background: '#1e293b',
                    color: '#cbd5e1',
                    border: '1px solid #64748b',
                    opacity: 0.85,
                  }
          }
        >
          {isClaimed ? claimedLabel : claimLabel}
        </button>
      </div>
    </div>
  );
}

export function EventosPage() {
  const { t } = useTranslation(['common', 'events']);
  const [tab, setTab] = useState<Tab>('events');
  const [error, setError] = useState('');
  const qc = useQueryClient();

  const board = useQuery({
    queryKey: ['events-board'],
    queryFn: async () => {
      const { data } = await apiClient.get<Board>('/api/events');
      return normalizeBoard(data);
    },
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });

  const claim = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post(`/api/events/quests/${id}/claim`);
      return data;
    },
    onSuccess: () => {
      setError('');
      void qc.invalidateQueries({ queryKey: ['events-board'] });
      void qc.invalidateQueries({ queryKey: ['club'] });
      void qc.invalidateQueries({ queryKey: ['wallet'] });
      void qc.invalidateQueries({ queryKey: ['inventory'] });
    },
    onError: (err) => setError(translateError(err, 'UNKNOWN')),
  });

  const tabs = useMemo(
    () =>
      [
        { id: 'events' as const, label: t('events:tabs.events', { defaultValue: 'Eventos' }) },
        { id: 'tasks' as const, label: t('events:tabs.tasks', { defaultValue: 'Tasks' }) },
        {
          id: 'achievements' as const,
          label: t('events:tabs.achievements', { defaultValue: 'Achievements' }),
        },
        {
          id: 'history' as const,
          label: t('events:tabs.history', { defaultValue: 'Histórico' }),
        },
      ] as const,
    [t],
  );

  const data = board.data;
  const overwallHint = t('events:reward.overwallHint', {
    days: 7,
    defaultValue:
      'Boost temporário: vale por 7 dias após o resgate e conta na disputa de mineração.',
  });

  const questGridClass =
    'grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4';

  return (
    <PageContentShell wide>
      <div className="w-full min-w-0 space-y-5 sm:space-y-6">
        <header>
          <h1 className="pixel-text text-2xl sm:text-3xl md:text-4xl" style={{ color: 'var(--green)' }}>
            {t('events:title', { defaultValue: 'Eventos' })}
          </h1>
          <p className="retro-text mt-1 text-base sm:text-lg" style={{ color: '#e8eef5' }}>
            {t('events:subtitle', {
              defaultValue: 'Campanhas, tasks diárias/semanais e achievements com recompensas.',
            })}
          </p>
        </header>

        <div className="flex gap-2 overflow-x-auto border-b border-white/20 pb-2 -mx-1 px-1">
          {tabs.map((tb) => {
            const active = tab === tb.id;
            return (
              <button
                key={tb.id}
                type="button"
                onClick={() => setTab(tb.id)}
                className="shrink-0 rounded-lg px-4 py-2 text-sm sm:text-base font-bold transition-colors"
                style={{
                  background: active ? 'var(--green)' : 'rgba(255,255,255,0.08)',
                  color: active ? '#06120a' : '#f1f5f9',
                  border: active ? '1px solid #5dff9a' : '1px solid rgba(255,255,255,0.28)',
                }}
              >
                {tb.label}
              </button>
            );
          })}
        </div>

        {error && (
          <p className="rounded-lg border border-red-500/50 bg-red-950/50 px-3 py-2 text-sm font-medium text-red-200">
            {error}
          </p>
        )}

        {board.isLoading && (
          <p className="font-medium" style={{ color: '#e2e8f0' }}>
            {t('common:loading', { defaultValue: 'Carregando…' })}
          </p>
        )}

        {tab === 'events' && data && (
          <div className="space-y-6">
            {data.campaigns.length === 0 && data.eventTasks.length === 0 && (
              <p className="font-medium" style={{ color: '#cbd5e1' }}>
                {t('events:empty.events', { defaultValue: 'Nenhum evento ativo no momento.' })}
              </p>
            )}
            {data.campaigns.map((c) => (
              <section
                key={c.id}
                className="space-y-4 rounded-2xl p-4 sm:p-5 lg:p-6"
                style={{
                  border: '2px solid rgba(255,255,255,0.18)',
                  background: 'rgba(14, 22, 32, 0.85)',
                }}
              >
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-start">
                  {c.imageUrl && (
                    <img
                      src={c.imageUrl}
                      alt=""
                      className="max-h-56 w-full rounded-xl object-cover lg:max-h-72"
                    />
                  )}
                  <div className={`min-w-0 space-y-2 ${c.imageUrl ? '' : 'lg:col-span-2'}`}>
                    <h2 className="text-xl sm:text-2xl font-bold text-white">{c.title}</h2>
                    <p className="text-sm sm:text-base whitespace-pre-wrap" style={{ color: '#e8eef5' }}>
                      {c.body}
                    </p>
                    <p className="text-xs sm:text-sm font-medium" style={{ color: '#cbd5e1' }}>
                      {new Date(c.startsAt).toLocaleString()} → {new Date(c.endsAt).toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className={questGridClass}>
                  {c.quests.filter((q) => q.kind !== 'achievement').map((q) => (
                    <QuestCard
                      key={q.id}
                      quest={q}
                      claiming={claim.isPending}
                      onClaim={(id) => claim.mutate(id)}
                      claimLabel={t('events:claim', { defaultValue: 'Resgatar' })}
                      claimedLabel={t('events:claimed', { defaultValue: 'Resgatado' })}
                      progressLabel={t('events:progress', { defaultValue: 'Progresso' })}
                      overwallHint={overwallHint}
                    />
                  ))}
                </div>
              </section>
            ))}
            {data.eventTasks.filter((q) => q.kind !== 'achievement').length > 0 && (
              <div className={questGridClass}>
                {data.eventTasks.filter((q) => q.kind !== 'achievement').map((q) => (
                  <QuestCard
                    key={q.id}
                    quest={q}
                    claiming={claim.isPending}
                    onClaim={(id) => claim.mutate(id)}
                    claimLabel={t('events:claim', { defaultValue: 'Resgatar' })}
                    claimedLabel={t('events:claimed', { defaultValue: 'Resgatado' })}
                    progressLabel={t('events:progress', { defaultValue: 'Progresso' })}
                    overwallHint={overwallHint}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'tasks' && data && (
          <div className={questGridClass}>
            {data.tasks.filter((q) => q.kind !== 'achievement').length === 0 && (
              <p className="font-medium md:col-span-2 xl:col-span-3 2xl:col-span-4" style={{ color: '#cbd5e1' }}>
                {t('events:empty.tasks', { defaultValue: 'Nenhuma task ativa.' })}
              </p>
            )}
            {data.tasks.filter((q) => q.kind !== 'achievement').map((q) => (
              <QuestCard
                key={q.id}
                quest={q}
                claiming={claim.isPending}
                onClaim={(id) => claim.mutate(id)}
                claimLabel={t('events:claim', { defaultValue: 'Resgatar' })}
                claimedLabel={t('events:claimed', { defaultValue: 'Resgatado' })}
                progressLabel={t('events:progress', { defaultValue: 'Progresso' })}
                overwallHint={overwallHint}
              />
            ))}
          </div>
        )}

        {tab === 'achievements' && data && (
          <div className="space-y-6">
            <div className={questGridClass}>
              {data.achievements.filter((q) => !q.claimed).length === 0 && (
                <p className="font-medium md:col-span-2 xl:col-span-3 2xl:col-span-4" style={{ color: '#cbd5e1' }}>
                  {t('events:empty.achievements', { defaultValue: 'Nenhum achievement ativo.' })}
                </p>
              )}
              {data.achievements.filter((q) => !q.claimed).map((q) => (
                <QuestCard
                  key={q.id}
                  quest={q}
                  claiming={claim.isPending}
                  onClaim={(id) => claim.mutate(id)}
                  claimLabel={t('events:claim', { defaultValue: 'Resgatar' })}
                  claimedLabel={t('events:claimed', { defaultValue: 'Resgatado' })}
                  progressLabel={t('events:progress', { defaultValue: 'Progresso' })}
                  overwallHint={overwallHint}
                />
              ))}
            </div>
            {data.badges.length > 0 && (
              <section>
                <h2 className="mb-3 text-lg sm:text-xl font-bold text-white">
                  {t('events:badges', { defaultValue: 'Badges' })}
                </h2>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                  {data.badges.map((b) => (
                    <div
                      key={b.id}
                      className="rounded-xl p-3 text-center"
                      style={{
                        opacity: b.unlocked ? 1 : 0.55,
                        border: '1px solid rgba(255,255,255,0.22)',
                        background: 'rgba(255,255,255,0.06)',
                      }}
                    >
                      {b.iconUrl ? (
                        <img src={b.iconUrl} alt="" className="mx-auto mb-2 h-12 w-12 object-contain" />
                      ) : (
                        <i className="bi bi-award text-3xl" style={{ color: '#fbbf24' }} />
                      )}
                      <p className="text-sm font-bold text-white">{b.title}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {tab === 'history' && data && (
          <div className="space-y-4">
            <p className="text-sm sm:text-base font-medium" style={{ color: '#e2e8f0' }}>
              Cada achievement só pode ser coletado uma vez na vida.
            </p>
            <div className={questGridClass}>
              {data.achievements.filter((q) => q.claimed).length === 0 && (
                <p className="font-medium md:col-span-2 xl:col-span-3 2xl:col-span-4" style={{ color: '#cbd5e1' }}>
                  {t('events:empty.history', { defaultValue: 'Nenhum achievement coletado ainda.' })}
                </p>
              )}
              {data.achievements
                .filter((q) => q.claimed)
                .map((q) => (
                  <QuestCard
                    key={q.id}
                    quest={q}
                    claiming={false}
                    onClaim={() => undefined}
                    claimLabel={t('events:claim', { defaultValue: 'Resgatar' })}
                    claimedLabel={t('events:claimed', { defaultValue: 'Resgatado' })}
                    progressLabel={t('events:progress', { defaultValue: 'Progresso' })}
                    overwallHint={overwallHint}
                  />
                ))}
            </div>
          </div>
        )}
      </div>
    </PageContentShell>
  );
}

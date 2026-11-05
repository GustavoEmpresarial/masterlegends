import { useCallback, useEffect, useState } from 'react';
import type { PassSeasonDTO } from '@mll/shared';
import { adminClient } from '../../../lib/api/adminClient';
import {
  AdminPageHeader,
  AdminButton,
  AdminBadge,
} from '../../../components/admin/AdminTable';
import { SeasonEditor } from '../../../components/admin/pass/SeasonEditor';
import { totalXpSpan } from '../../../components/admin/pass/passConstants';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function daysLeft(endsAt: string) {
  const diff = new Date(endsAt).getTime() - Date.now();
  return Math.ceil(diff / 86_400_000);
}

function SeasonCard({
  season,
  onEdit,
  onToggle,
  onRemove,
}: {
  season: PassSeasonDTO;
  onEdit: () => void;
  onToggle: () => void;
  onRemove: () => void;
}) {
  const days = daysLeft(season.endsAt);
  const isExpired = days < 0;
  const isRunning = season.active && !isExpired;
  const xpMax = totalXpSpan(season.levels);

  return (
    <div
      className={`admin-card overflow-hidden transition-colors ${
        isRunning ? 'border-emerald-500/20' : ''
      }`}
    >
      <div
        className={`h-1 w-full ${
          isRunning
            ? 'bg-gradient-to-r from-emerald-500 to-cyan-500'
            : isExpired
              ? 'bg-slate-700'
              : 'bg-slate-600'
        }`}
      />

      <div className="p-4 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-slate-100 text-sm">{season.name}</p>
              {isRunning && (
                <span className="flex items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  AO VIVO
                </span>
              )}
              {isExpired && <AdminBadge variant="default">Expirado</AdminBadge>}
              {!season.active && !isExpired && (
                <AdminBadge variant="default">Inativo</AdminBadge>
              )}
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {formatDate(season.startsAt)} → {formatDate(season.endsAt)}
              {!isExpired && (
                <span
                  className={`ml-2 font-medium ${days <= 7 ? 'text-red-400' : 'text-slate-400'}`}
                >
                  · {days}d restantes
                </span>
              )}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-xs font-semibold text-emerald-400">
              {season.premiumPriceUsdc} GMT
            </p>
            <p className="text-[10px] text-slate-600">premium</p>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'Níveis', value: season.levels.length, color: 'text-sky-400' },
            { label: 'Missões', value: season.missions.length, color: 'text-purple-400' },
            { label: 'Blocos', value: season.rewardBlocks.length, color: 'text-amber-400' },
            { label: 'XP máx', value: xpMax, color: 'text-emerald-400' },
          ].map(({ label, value, color }) => (
            <div
              key={label}
              className="rounded-lg bg-white/[0.02] border border-white/[0.04] p-2 text-center"
            >
              <p className={`text-base font-bold leading-tight ${color}`}>{value}</p>
              <p className="text-[9px] text-slate-600 uppercase tracking-wide">{label}</p>
            </div>
          ))}
        </div>

        <div className="flex gap-1.5 pt-1 border-t border-white/[0.04]">
          <AdminButton size="sm" variant="secondary" onClick={onEdit} className="flex-1">
            <i className="bi bi-pencil text-xs" /> Editar
          </AdminButton>
          <AdminButton
            size="sm"
            variant={season.active ? 'ghost' : 'secondary'}
            onClick={onToggle}
          >
            <i className={`bi ${season.active ? 'bi-pause-circle' : 'bi-play-circle'} text-xs`} />
            {season.active ? 'Desativar' : 'Ativar'}
          </AdminButton>
          <AdminButton size="sm" variant="danger" onClick={onRemove}>
            <i className="bi bi-trash text-xs" />
          </AdminButton>
        </div>
      </div>
    </div>
  );
}

type EditorMode =
  | { kind: 'create'; loadTemplate?: boolean }
  | { kind: 'edit'; season: PassSeasonDTO }
  | null;

export function AdminPassPage() {
  const [seasons, setSeasons] = useState<PassSeasonDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [editor, setEditor] = useState<EditorMode>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await adminClient.get<{ seasons: PassSeasonDTO[] }>('/pass/seasons');
      setSeasons(data.seasons);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleActive(season: PassSeasonDTO) {
    setError('');
    try {
      await adminClient.patch(`/pass/seasons/${season.id}`, { active: !season.active });
      setSuccess(season.active ? 'Temporada desativada' : 'Temporada ativada');
      await load();
    } catch (err) {
      const details = (err as { response?: { data?: { error?: { details?: { message?: string } } } } })
        .response?.data?.error?.details?.message;
      setError(details ?? 'Não foi possível alterar o status.');
    }
  }

  async function remove(id: number) {
    if (!window.confirm('Excluir esta temporada do passe?')) return;
    setError('');
    try {
      await adminClient.delete(`/pass/seasons/${id}`);
      setSuccess('Temporada excluída');
      if (editor?.kind === 'edit' && editor.season.id === id) setEditor(null);
      await load();
    } catch {
      setError('Não foi possível excluir.');
    }
  }

  const activeSeason = seasons.find((s) => s.active);
  const totalLevels = seasons.reduce((acc, s) => Math.max(acc, s.levels.length), 0);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Passe de Temporada"
        subtitle="CMS visual: temporadas, níveis, missões, blocos de recompensa e preview."
        actions={
          !editor ? (
            <AdminButton
              onClick={() => {
                setEditor({ kind: 'create' });
                setError('');
                setSuccess('');
              }}
            >
              <i className="bi bi-plus-circle text-xs" /> Nova temporada
            </AdminButton>
          ) : undefined
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            label: 'Temporadas',
            value: seasons.length,
            icon: 'bi-calendar3',
            accent: 'text-sky-400',
            bg: 'bg-sky-500/10 border-sky-500/20',
          },
          {
            label: 'Ativa agora',
            value: activeSeason?.name ?? '—',
            icon: 'bi-broadcast',
            accent: 'text-emerald-400',
            bg: 'bg-emerald-500/10 border-emerald-500/20',
          },
          {
            label: 'Max níveis',
            value: totalLevels || '—',
            icon: 'bi-layers',
            accent: 'text-purple-400',
            bg: 'bg-purple-500/10 border-purple-500/20',
          },
          {
            label: 'Dias restantes',
            value: activeSeason ? `${daysLeft(activeSeason.endsAt)}d` : '—',
            icon: 'bi-hourglass-split',
            accent: 'text-amber-400',
            bg: 'bg-amber-500/10 border-amber-500/20',
          },
        ].map(({ label, value, icon, accent, bg }) => (
          <div key={label} className="admin-card p-4">
            <div className="flex items-start justify-between gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                {label}
              </p>
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${bg}`}
              >
                <i className={`bi ${icon} text-xs ${accent}`} />
              </span>
            </div>
            <p className="mt-2 text-xl font-semibold text-white truncate">{value}</p>
          </div>
        ))}
      </div>

      {(success || error) && (
        <p
          className={`rounded-xl border px-4 py-2.5 text-sm ${
            error
              ? 'border-red-500/25 bg-red-500/10 text-red-300'
              : 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300'
          }`}
        >
          {error || success}
        </p>
      )}

      {editor && (
        <SeasonEditor
          season={editor.kind === 'edit' ? editor.season : null}
          seasons={seasons}
          autoLoadTemplate={editor.kind === 'create' ? Boolean(editor.loadTemplate) : false}
          onCancel={() => setEditor(null)}
          onSaved={() => {
            setSuccess(editor.kind === 'edit' ? 'Temporada atualizada' : 'Temporada criada');
            setEditor(null);
            void load();
          }}
        />
      )}

      {!editor && loading && (
        <div className="admin-card flex items-center justify-center py-16">
          <p className="text-sm text-slate-400">Carregando temporadas…</p>
        </div>
      )}

      {!editor && !loading && seasons.length === 0 && (
        <div className="admin-card flex flex-col items-center justify-center py-16 text-center">
          <i className="bi bi-calendar-x text-3xl text-slate-600 mb-3" />
          <p className="text-sm text-slate-500">Nenhuma temporada cadastrada.</p>
          <p className="text-xs text-slate-600 mt-1 mb-4">
            Sem temporada ativa, o passe não aparece no jogo.
          </p>
          <div className="flex flex-wrap gap-2 justify-center">
            <AdminButton
              onClick={() => {
                setEditor({ kind: 'create' });
                setError('');
                setSuccess('');
              }}
            >
              <i className="bi bi-plus-circle text-xs" /> Criar primeira temporada
            </AdminButton>
            <AdminButton
              variant="secondary"
              onClick={() => {
                setEditor({ kind: 'create', loadTemplate: true });
                setError('');
                setSuccess('');
              }}
            >
              <i className="bi bi-download text-xs" /> Carregar template e criar
            </AdminButton>
          </div>
        </div>
      )}

      {!editor && !loading && seasons.length > 0 && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {seasons.map((s) => (
              <SeasonCard
                key={s.id}
                season={s}
                onEdit={() => {
                  setEditor({ kind: 'edit', season: s });
                  setError('');
                  setSuccess('');
                }}
                onToggle={() => void toggleActive(s)}
                onRemove={() => void remove(s.id)}
              />
            ))}
            <button
              type="button"
              onClick={() => {
                setEditor({ kind: 'create' });
                setError('');
                setSuccess('');
              }}
              className="flex min-h-[200px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-white/[0.08] bg-white/[0.01] text-slate-500 transition-colors hover:border-white/[0.16] hover:text-slate-300"
            >
              <i className="bi bi-plus-circle text-2xl" />
              <span className="text-sm font-medium">Nova temporada</span>
            </button>
          </div>
          <p className="text-xs text-slate-600 text-center">
            {seasons.length} temporada{seasons.length !== 1 ? 's' : ''} ·{' '}
            {seasons.filter((s) => s.active).length} ativa
            {seasons.filter((s) => s.active).length !== 1 ? 's' : ''}
          </p>
        </>
      )}
    </div>
  );
}

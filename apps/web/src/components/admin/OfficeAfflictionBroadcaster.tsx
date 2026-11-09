import { useCallback, useEffect, useMemo, useState } from 'react';
import { adminClient } from '../../lib/api/adminClient';

interface ActiveAffliction {
  id: string;
  userId: string;
  targetKind: string;
  code: string;
  note: string | null;
  startedAt: string;
  expiresAt: string;
  createdBy: string | null;
}

type TargetKind = 'coach' | 'treasurer';
type Scope = 'all' | 'with_staff';

const COACH_PRESETS = [
  { code: 'dor_de_barriga', label: 'Dor de barriga', emoji: 'bi-emoji-frown', defaultDuration: 60 },
  { code: 'gripe', label: 'Gripe forte', emoji: 'bi-thermometer-half', defaultDuration: 60 * 6 },
  { code: 'indisposicao', label: 'Indisposição', emoji: 'bi-emoji-dizzy', defaultDuration: 30 },
  { code: 'lesao_profissional', label: 'Lesão profissional', emoji: 'bi-heart-pulse-fill', defaultDuration: 60 * 24 },
];

const TREASURER_PRESETS = [
  { code: 'dor_de_barriga', label: 'Dor de barriga', emoji: 'bi-emoji-frown', defaultDuration: 60 },
  { code: 'gripe', label: 'Gripe forte', emoji: 'bi-thermometer-half', defaultDuration: 60 * 6 },
  { code: 'indisposicao', label: 'Indisposição', emoji: 'bi-emoji-dizzy', defaultDuration: 30 },
  { code: 'auditoria_externa', label: 'Auditoria externa', emoji: 'bi-clipboard-fill', defaultDuration: 60 * 24 },
];

const DURATION_CHIPS = [15, 60, 60 * 6, 60 * 24, 60 * 24 * 3];

function formatDuration(min: number): string {
  if (min < 60) return `${min} min`;
  if (min < 60 * 24) {
    const h = min / 60;
    return Number.isInteger(h) ? `${h}h` : `${Math.round(h * 10) / 10}h`;
  }
  const d = min / (60 * 24);
  return Number.isInteger(d) ? `${d}d` : `${Math.round(d * 10) / 10}d`;
}

function timeLeft(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'expirado';
  return formatDuration(Math.round(ms / 60000));
}

function presetLabel(code: string, kind: TargetKind): string {
  const list = kind === 'coach' ? COACH_PRESETS : TREASURER_PRESETS;
  const p = list.find((x) => x.code === code);
  if (p) return `${p.emoji} ${p.label}`;
  return code;
}

export function OfficeAfflictionBroadcaster() {
  const [targetKind, setTargetKind] = useState<TargetKind>('coach');
  const [code, setCode] = useState('dor_de_barriga');
  const [customCode, setCustomCode] = useState('');
  const [useCustom, setUseCustom] = useState(false);
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [note, setNote] = useState('');
  const [scope, setScope] = useState<Scope>('with_staff');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const [active, setActive] = useState<ActiveAffliction[]>([]);

  const presets = targetKind === 'coach' ? COACH_PRESETS : TREASURER_PRESETS;
  const resolvedCode = useCustom ? customCode.trim() || 'evento_custom' : code;

  const load = useCallback(async () => {
    try {
      const { data } = await adminClient.get<{ items: ActiveAffliction[] }>('/afflictions/active');
      setActive(data.items);
    } catch {
      /* silent */
    }
  }, []);

  useEffect(() => {
    void load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [load]);

  function pickPreset(presetCode: string) {
    setUseCustom(false);
    setCode(presetCode);
    const p = presets.find((x) => x.code === presetCode);
    if (p) setDurationMinutes(p.defaultDuration);
  }

  async function submit() {
    setSubmitting(true);
    setError('');
    setFeedback('');
    try {
      const { data } = await adminClient.post<{ ok: boolean; applied: number }>(
        '/afflictions/broadcast',
        {
          targetKind,
          code: resolvedCode,
          durationMinutes,
          note: note || undefined,
          scope,
        },
      );
      setFeedback(`Evento aplicado a ${data.applied} usuário(s). Telegram notificado.`);
      setNote('');
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao aplicar evento');
    } finally {
      setSubmitting(false);
    }
  }

  async function cutEvent(mode: 'selection' | 'all_staff') {
    const staffLabel = targetKind === 'coach' ? 'Treinador' : 'Tesoureiro';
    const confirmMsg =
      mode === 'selection'
        ? `Cortar o evento "${resolvedCode}" de ${staffLabel} em TODOS os clubes afetados?`
        : 'Cortar TODOS os eventos ativos de Treinador e Tesoureiro?';
    if (!window.confirm(confirmMsg)) return;

    setSubmitting(true);
    setError('');
    setFeedback('');
    try {
      const payload =
        mode === 'selection'
          ? { targetKind, code: resolvedCode, notify: true }
          : { notify: true };
      const { data } = await adminClient.post<{
        ok: boolean;
        removed: number;
        usersNotified: number;
      }>('/afflictions/cut', payload);
      setFeedback(
        data.removed === 0
          ? 'Nenhum evento ativo para cortar.'
          : `Cortados ${data.removed} evento(s) · ${data.usersNotified} usuário(s) notificados no Telegram.`,
      );
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao cortar evento');
    } finally {
      setSubmitting(false);
    }
  }

  async function removeOne(id: string) {
    if (!window.confirm('Remover este evento agora?')) return;
    try {
      await adminClient.delete(`/afflictions/${id}`);
      await load();
    } catch {
      /* silent */
    }
  }

  async function removeAllForUser(userId: string) {
    const userEvents = visibleActive.filter((a) => a.userId === userId);
    if (!window.confirm(`Remover ${userEvents.length} evento(s) deste usuário?`)) return;
    try {
      await Promise.all(userEvents.map((a) => adminClient.delete(`/afflictions/${a.id}`)));
      await load();
    } catch {
      /* silent */
    }
  }

  const visibleActive = active.filter(
    (a) => a.targetKind === 'coach' || a.targetKind === 'treasurer',
  );

  const preview = useMemo(() => {
    const staff = targetKind === 'coach' ? 'Treinador' : 'Tesoureiro';
    const event = presetLabel(resolvedCode, targetKind);
    return {
      staff,
      event,
      duration: formatDuration(durationMinutes),
      scope:
        scope === 'with_staff'
          ? 'Só quem contratou o staff'
          : 'TODOS os clubes (cuidado)',
    };
  }, [targetKind, resolvedCode, durationMinutes, scope]);

  return (
    <section className="rounded-xl border border-amber-700/40 bg-gradient-to-b from-amber-950/40 to-slate-950/40 p-4 sm:p-5 space-y-5">
      <header className="space-y-1.5">
        <h2 className="text-lg sm:text-xl font-semibold text-amber-300 tracking-tight">
          <i className="bi bi-people-fill" aria-hidden /> Eventos do Escritório
        </h2>
        <p className="text-sm text-slate-400 leading-relaxed max-w-3xl">
          Indisposições e eventos catastróficos no Treinador / Tesoureiro. Enquanto ativos, o staff
          <strong className="text-slate-300"> não cumpre funções passivas</strong>. Cada aplicação dispara alerta no Telegram.
        </p>
      </header>

      {/* Target */}
      <div className="space-y-2">
        <label className="text-xs uppercase tracking-wide text-slate-500">Quem é atingido</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {([
            { k: 'coach' as const, label: 'Treinador', hint: 'Bloqueia recuperação passiva de stamina' },
            { k: 'treasurer' as const, label: 'Tesoureiro', hint: 'Suspende funções financeiras passivas' },
          ]).map((opt) => (
            <button
              key={opt.k}
              type="button"
              onClick={() => {
                setTargetKind(opt.k);
                setUseCustom(false);
                setCode('dor_de_barriga');
                setDurationMinutes(60);
              }}
              className={`rounded-lg border px-3 py-3 text-left transition ${
                targetKind === opt.k
                  ? 'border-amber-500 bg-amber-700/40 text-white'
                  : 'border-slate-700 bg-slate-900/80 text-slate-300 hover:border-slate-500'
              }`}
            >
              <div className="text-sm font-medium">{opt.label}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">{opt.hint}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Event presets */}
      <div className="space-y-2">
        <label className="text-xs uppercase tracking-wide text-slate-500">Tipo de evento</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2">
          {presets.map((p) => (
            <button
              key={p.code}
              type="button"
              onClick={() => pickPreset(p.code)}
              className={`rounded-lg border px-3 py-2.5 text-left text-sm transition ${
                !useCustom && code === p.code
                  ? 'border-amber-500 bg-amber-700/35 text-white'
                  : 'border-slate-700 bg-slate-900/80 text-slate-300 hover:border-slate-500'
              }`}
            >
              <span className="mr-1.5">{p.emoji}</span>
              {p.label}
              <div className="text-[10px] text-slate-500 mt-1">padrão {formatDuration(p.defaultDuration)}</div>
            </button>
          ))}
          <button
            type="button"
            onClick={() => setUseCustom(true)}
            className={`rounded-lg border px-3 py-2.5 text-left text-sm transition ${
              useCustom
                ? 'border-sky-500 bg-sky-900/40 text-white'
                : 'border-slate-700 bg-slate-900/80 text-slate-300 hover:border-slate-500'
            }`}
          >
            <i className="bi bi-gear-fill" aria-hidden /> Código customizado
            <div className="text-[10px] text-slate-500 mt-1">livre</div>
          </button>
        </div>
        {useCustom && (
          <input
            value={customCode}
            onChange={(e) => setCustomCode(e.target.value.trim())}
            placeholder="ex: greve_geral"
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
          />
        )}
      </div>

      {/* Duration + scope */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-xs uppercase tracking-wide text-slate-500">
            Duração · {formatDuration(durationMinutes)}
          </label>
          <input
            type="number"
            min={1}
            max={60 * 24 * 30}
            value={durationMinutes}
            onChange={(e) => setDurationMinutes(Number(e.target.value) || 1)}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
          />
          <div className="flex flex-wrap gap-1.5">
            {DURATION_CHIPS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setDurationMinutes(m)}
                className={`rounded-md px-2.5 py-1 text-xs border ${
                  durationMinutes === m
                    ? 'border-amber-500 bg-amber-800/50 text-amber-100'
                    : 'border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-500'
                }`}
              >
                {formatDuration(m)}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs uppercase tracking-wide text-slate-500">Alcance</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setScope('with_staff')}
              className={`rounded-lg border px-3 py-3 text-left text-sm ${
                scope === 'with_staff'
                  ? 'border-sky-500 bg-sky-900/40 text-white'
                  : 'border-slate-700 bg-slate-900/80 text-slate-300'
              }`}
            >
              Apenas quem contratou
              <div className="text-[11px] text-slate-500 mt-1">Recomendado</div>
            </button>
            <button
              type="button"
              onClick={() => setScope('all')}
              className={`rounded-lg border px-3 py-3 text-left text-sm ${
                scope === 'all'
                  ? 'border-red-500 bg-red-900/40 text-white'
                  : 'border-slate-700 bg-slate-900/80 text-slate-300'
              }`}
            >
              <i className="bi bi-skull" aria-hidden /> Todos os usuários
              <div className="text-[11px] text-slate-500 mt-1">Impacto máximo</div>
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-xs uppercase tracking-wide text-slate-500">
          Nota interna (aparece no Telegram)
        </label>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="ex: surto de virose no clube"
          maxLength={255}
          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
        />
      </div>

      {/* Live preview */}
      <div className="rounded-lg border border-slate-700 bg-slate-950/80 p-3 sm:p-4 space-y-2">
        <div className="text-xs uppercase tracking-wide text-slate-500">Prévia do alerta Telegram</div>
        <div className="font-mono text-xs sm:text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">
{`MLL · GENESIS DAO
━━━━━━━━━━━━━━━━━━━━
<i className="bi bi-exclamation-triangle-fill" aria-hidden /> EVENTO NO ESCRITÓRIO

${preview.staff} indisposto
${preview.event}

<i className="bi bi-stopwatch-fill" aria-hidden /> Duração: ${preview.duration}
<i className="bi bi-bullseye" aria-hidden /> Alcance: ${preview.scope}${note.trim() ? `\n<i className="bi bi-chat-fill" aria-hidden /> ${note.trim()}` : ''}`}
        </div>
      </div>

      {feedback && (
        <p className="rounded-lg border border-emerald-700/50 bg-emerald-950/40 px-3 py-2 text-sm text-emerald-300">
          <i className="bi bi-check-lg" aria-hidden /> {feedback}
        </p>
      )}
      {error && (
        <p className="rounded-lg border border-red-700/50 bg-red-950/40 px-3 py-2 text-sm text-red-300">
          <i className="bi bi-x-lg" aria-hidden /> {error}
        </p>
      )}

      <div className="flex flex-col sm:flex-row flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void submit()}
          disabled={submitting || (useCustom && !customCode.trim())}
          className="w-full sm:w-auto rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-40 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-amber-900/30"
        >
          {submitting ? 'Aplicando…' : <><i className="bi bi-bullseye" aria-hidden /> Aplicar evento + notificar Telegram</>}
        </button>
        <button
          type="button"
          onClick={() => void cutEvent('selection')}
          disabled={submitting || (useCustom && !customCode.trim())}
          className="w-full sm:w-auto rounded-lg border border-rose-500/60 bg-rose-950/50 hover:bg-rose-900/60 disabled:opacity-40 px-5 py-2.5 text-sm font-semibold text-rose-200"
        >
          <i className="bi bi-scissors" aria-hidden /> Cortar evento selecionado
        </button>
        <button
          type="button"
          onClick={() => void cutEvent('all_staff')}
          disabled={submitting}
          className="w-full sm:w-auto rounded-lg border border-slate-600 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 px-5 py-2.5 text-sm font-semibold text-slate-200"
        >
          <i className="bi bi-scissors" aria-hidden /> Cortar todos (treinador + tesoureiro)
        </button>
      </div>

      {/* Active table */}
      <div className="space-y-2 pt-2 border-t border-slate-800">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-medium text-slate-200">
            Eventos ativos
            <span className="ml-2 text-slate-500 font-normal">({visibleActive.length})</span>
          </h3>
          <button
            type="button"
            onClick={() => void load()}
            className="text-xs text-slate-400 hover:text-slate-200"
          >
            Atualizar
          </button>
        </div>

        {visibleActive.length === 0 ? (
          <p className="text-sm text-slate-500 py-4 text-center border border-dashed border-slate-800 rounded-lg">
            Nenhum evento ativo no momento.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-800">
            <table className="w-full text-xs min-w-[640px]">
              <thead className="bg-slate-900/80 text-slate-500">
                <tr>
                  <th className="text-left py-2 px-3 font-medium">Usuário</th>
                  <th className="text-left py-2 px-3 font-medium">Alvo</th>
                  <th className="text-left py-2 px-3 font-medium">Evento</th>
                  <th className="text-left py-2 px-3 font-medium">Restante</th>
                  <th className="text-left py-2 px-3 font-medium">Por</th>
                  <th className="text-right py-2 px-3 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {visibleActive.map((a) => (
                  <tr key={a.id} className="border-t border-slate-800/80 hover:bg-slate-900/40">
                    <td className="py-2 px-3 font-mono text-[11px] text-slate-400">
                      {a.userId.slice(0, 8)}…
                    </td>
                    <td className="py-2 px-3 text-slate-300 whitespace-nowrap">
                      {a.targetKind === 'coach' ? <><i className="bi bi-person-video3" aria-hidden /> <i className="bi bi-mortarboard-fill" aria-hidden /> Treinador</> : <><i className="bi bi-briefcase-fill" aria-hidden /> Tesoureiro</>}
                    </td>
                    <td className="py-2 px-3 text-slate-200">
                      {presetLabel(a.code, a.targetKind as TargetKind)}
                      <div className="text-[10px] text-slate-500 font-mono">{a.code}</div>
                    </td>
                    <td className="py-2 px-3 text-amber-300 font-medium whitespace-nowrap">
                      {timeLeft(a.expiresAt)}
                    </td>
                    <td className="py-2 px-3 text-slate-500 max-w-[140px] truncate">
                      {a.createdBy ?? '—'}
                    </td>
                    <td className="py-2 px-3 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => void removeOne(a.id)}
                        className="text-red-400 hover:text-red-300 mr-3"
                        title="Remover este evento"
                      >
                        Remover
                      </button>
                      <button
                        type="button"
                        onClick={() => void removeAllForUser(a.userId)}
                        className="text-orange-400 hover:text-orange-300"
                        title="Remover todos deste usuário"
                      >
                        Limpar user
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

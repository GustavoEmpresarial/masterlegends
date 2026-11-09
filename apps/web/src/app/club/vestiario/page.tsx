import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import type { InventoryPlayerDTO, LineupAssignment, LineupPlayerDTO } from '@mll/shared';
import { useClub, useDailyRest, useSaveLineup, useVestiario } from '../../../hooks/useApi';
import { useCtRealtime } from '../../../hooks/useCtRealtime';
import { translateError } from '../../../lib/apiError';
import { StadiumPlayerOverlay } from '../../../components/stadium/StadiumPlayerOverlay';
import { VestiarioSlotPicker } from '../../../components/stadium/VestiarioSlotPicker';
import { PlayerCardModal } from '../../../components/stadium/PlayerCardModal';
import { VestiarioRoster, type RosterEntry } from '../../../components/stadium/VestiarioRoster';
import { StadiumCanvas } from '../../../components/stadium/StadiumCanvas';
import { FreeFieldAssignDialog, FreeFieldNotice, formatFreeFieldRemain, freeFieldRemainMs } from '../../../components/stadium/FreeFieldNotice';
import { playerNickname } from '../../../lib/playerNickname';
import type { DragPlayerPayload } from '../../../lib/stadiumConstants';

function buildLocalAssignments(view: { assignments: Record<string, LineupAssignment> }) {
  return { ...view.assignments };
}

export function VestiarioPage() {
  const { t } = useTranslation(['club', 'common']);
  const { data: club, isLoading: clubLoading } = useClub();
  const { data: view, isLoading: viewLoading, isError, error, refetch } = useVestiario();
  const saveLineup = useSaveLineup();
  const dailyRest = useDailyRest();
  useCtRealtime();

  const [assignments, setAssignments] = useState<Record<string, LineupAssignment>>({});
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [pickerSlotId, setPickerSlotId] = useState<string | null>(null);
  const [saveMsg, setSaveMsg] = useState('');
  const [saveErr, setSaveErr] = useState('');
  const [dirty, setDirty] = useState(false);
  const [restMsg, setRestMsg] = useState('');
  const [restErr, setRestErr] = useState('');
  const [rosterPlayer, setRosterPlayer] = useState<LineupPlayerDTO | null>(null);
  const [freeAssign, setFreeAssign] = useState<{ slotId: string; player: InventoryPlayerDTO } | null>(null);

  useEffect(() => {
    if (view) setAssignments(buildLocalAssignments(view));
  }, [view]);

  const assignedKeys = useMemo(
    () => new Set(Object.values(assignments).map((a) => `${a.kind}:${a.playerId}`)),
    [assignments],
  );

  const playersByKey = useMemo(() => {
    if (!view) return new Map<string, InventoryPlayerDTO>();
    return new Map(
      [...view.bench, ...view.slots.map((s) => s.player).filter(Boolean)].map((p) => {
        if (!p) return null;
        const key = `${p.kind}:${p.id}`;
        return [key, { ...p, listed: 'listed' in p ? p.listed : false }] as const;
      }).filter(Boolean) as [string, InventoryPlayerDTO][],
    );
  }, [view]);

  const slotViews = useMemo(() => {
    if (!view) return [];
    return view.template.slots.map((slot) => {
      const a = assignments[slot.id];
      const player = a ? playersByKey.get(`${a.kind}:${a.playerId}`) : null;
      return { slot, player: player ?? null };
    });
  }, [view, assignments, playersByKey]);

  const benchPlayers = useMemo(() => {
    if (!view) return [];
    return Array.from(playersByKey.values())
      .filter((player) => !assignedKeys.has(`${player.kind}:${player.id}`))
      .sort((a, b) => {
        const stakeDiff = Number(Boolean(b.staked)) - Number(Boolean(a.staked));
        if (stakeDiff !== 0) return stakeDiff;
        const rank = (r: string | undefined) =>
          ({ legendary: 6, mythic: 6, epic: 5, 'super-rare': 4, rare: 3, uncommon: 2, common: 1 } as Record<string, number>)[
            r ?? 'common'
          ] ?? 0;
        const rarityDiff = rank(b.rarity) - rank(a.rarity);
        if (rarityDiff !== 0) return rarityDiff;
        return b.overwall - a.overwall;
      });
  }, [view, playersByKey, assignedKeys]);

  const selectedPlayer = useMemo(() => {
    if (!selectedSlotId) return null;
    return slotViews.find((s) => s.slot.id === selectedSlotId)?.player ?? null;
  }, [selectedSlotId, slotViews]);

  const pickerSlot = useMemo(() => {
    if (!pickerSlotId || !view) return null;
    return view.template.slots.find((s) => s.id === pickerSlotId) ?? null;
  }, [pickerSlotId, view]);

  const liveRosterPlayer = useMemo(() => {
    if (!rosterPlayer) return null;
    const live = playersByKey.get(`${rosterPlayer.kind}:${rosterPlayer.id}`);
    if (!live) return rosterPlayer;
    return toLineupPlayer({
      player: live,
      role: rosterPlayer.inLineup ? 'titular' : 'reserva',
      slotId: null,
    });
  }, [rosterPlayer, playersByKey]);

  const commitAssign = (slotId: string, payload: DragPlayerPayload) => {
    setAssignments((prev) => {
      const next = { ...prev };
      for (const [sid, a] of Object.entries(next)) {
        if (a.playerId === payload.playerId && a.kind === payload.kind) {
          delete next[sid];
        }
      }
      next[slotId] = payload;
      return next;
    });
    setDirty(true);
    setPickerSlotId(null);
  };

  const handleAssign = (slotId: string, payload: DragPlayerPayload) => {
    const slot = view?.template.slots.find((item) => item.id === slotId);
    if (slot?.role && slot.role !== 'DECOR' && payload.position && payload.position !== slot.role) return;
    const player = playersByKey.get(`${payload.kind}:${payload.playerId}`);
    if (player && !player.staked && player.freeField?.state !== 'playing') {
      if (player.freeField?.state === 'locked') {
        const time = formatFreeFieldRemain(freeFieldRemainMs(player.freeField.nextPlayAt));
        setSaveErr(t('club:freeField.locked', { time }));
        return;
      }
      setFreeAssign({ slotId, player });
      setPickerSlotId(null);
      return;
    }
    commitAssign(slotId, payload);
  };

  const handleOpenEmptySlot = (slotId: string) => {
    setSelectedSlotId(null);
    setPickerSlotId(slotId);
  };

  const handlePickPlayer = (player: InventoryPlayerDTO) => {
    if (!pickerSlotId) return;
    handleAssign(pickerSlotId, { playerId: player.id, kind: player.kind, position: player.position });
  };

  const handleRemove = (slotId: string) => {
    setAssignments((prev) => {
      const next = { ...prev };
      delete next[slotId];
      return next;
    });
    setDirty(true);
  };

  // Auto-save 500ms após a última mudança
  useEffect(() => {
    if (!dirty) return;
    const t = setTimeout(async () => {
      setSaveMsg('');
      setSaveErr('');
      try {
        await saveLineup.mutateAsync(assignments);
        setSaveMsg('Escalação salva');
        setTimeout(() => setSaveMsg(''), 2000);
      } catch (err: unknown) {
        setSaveErr(translateError(err, 'LINEUP_INVALID'));
      } finally {
        setDirty(false);
      }
    }, 500);
    return () => clearTimeout(t);
  }, [dirty, assignments]);

  const handleSave = async () => {
    setSaveMsg('');
    setSaveErr('');
    try {
      await saveLineup.mutateAsync(assignments);
      setSaveMsg(t('club:stadium.saved'));
    } catch (err: unknown) {
      setSaveErr(translateError(err, 'LINEUP_INVALID'));
    }
  };

  /** Escala automaticamente os jogadores de maior overwall em cada posição, sobrescrevendo a XI atual. */
  const autoFillStrongest = () => {
    if (!view) return;
    const pool = Array.from(playersByKey.values())
      .filter((p) => p.staked)
      .sort((a, b) => b.overwall - a.overwall);
    const byPosition = new Map<string, typeof pool>();
    for (const p of pool) {
      const arr = byPosition.get(p.position) ?? [];
      arr.push(p);
      byPosition.set(p.position, arr);
    }
    const cursor: Record<string, number> = {};
    const next: Record<string, LineupAssignment> = {};
    const used = new Set<string>();
    for (const slot of view.template.slots) {
      if (!slot.role || slot.role === 'DECOR') continue;
      const candidates = byPosition.get(slot.role) ?? [];
      let idx = cursor[slot.role] ?? 0;
      while (idx < candidates.length && used.has(`${candidates[idx].kind}:${candidates[idx].id}`)) {
        idx += 1;
      }
      cursor[slot.role] = idx + 1;
      const chosen = candidates[idx];
      if (chosen) {
        next[slot.id] = { playerId: chosen.id, kind: chosen.kind };
        used.add(`${chosen.kind}:${chosen.id}`);
      }
    }
    setAssignments(next);
    setDirty(true);
  };

  const handleRest = async () => {
    setRestMsg('');
    setRestErr('');
    try {
      const result = await dailyRest.mutateAsync();
      setRestMsg(t('club:vestiario.restDone', { count: result.restoredCount, points: 100 }));
      autoFillStrongest();
    } catch (err: unknown) {
      setRestErr(translateError(err, 'DAILY_REST_ALREADY_CLAIMED'));
    }
  };

  if (clubLoading || viewLoading) {
    return (
      <div className="pixel-card text-center py-16">
        <p className="retro-text text-xl" style={{ color: 'var(--text-muted)' }}>
          {t('common:labels.status.loading')}
        </p>
      </div>
    );
  }

  if (!club) {
    return (
      <div className="pixel-card text-center py-12">
        <p className="retro-text mb-4">{t('club:create.subtitle')}</p>
        <Link to="/club" className="pixel-btn pixel-btn-green pixel-btn-md">
          {t('club:create.title')}
        </Link>
      </div>
    );
  }

  if (isError || !view) {
    return (
      <div className="pixel-card text-center py-12 border-red">
        <p className="retro-text text-red mb-4">{translateError(error, 'STADIUM_NOT_AVAILABLE')}</p>
        <button type="button" onClick={() => void refetch()} className="pixel-btn pixel-btn-blue pixel-btn-md">
          {t('common:actions.retry', { defaultValue: 'TENTAR DE NOVO' })}
        </button>
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 space-y-6">
      <FreeFieldNotice
        players={slotViews.map((item) => item.player)}
        onExpire={() => {
          setAssignments((prev) => {
            const next = { ...prev };
            let changed = false;
            for (const [slotId, assignment] of Object.entries(next)) {
              const player = playersByKey.get(`${assignment.kind}:${assignment.playerId}`);
              if (player?.staked || player?.freeField?.state !== 'playing') continue;
              const ends = Date.parse(player.freeField.playEndsAt ?? '');
              if (!Number.isFinite(ends) || ends > Date.now() + 500) continue;
              delete next[slotId];
              changed = true;
            }
            if (changed) setDirty(true);
            return changed ? next : prev;
          });
          if (!dirty) void refetch();
        }}
      />
      <StadiumPlayerOverlay
        open={!!selectedPlayer}
        player={selectedPlayer}
        onClose={() => setSelectedSlotId(null)}
        onRemove={() => {
          if (selectedSlotId) handleRemove(selectedSlotId);
        }}
      />

      <VestiarioSlotPicker
        open={!!pickerSlotId}
        slotLabel={pickerSlot?.label}
        slotRole={pickerSlot?.role}
        players={benchPlayers}
        assignedKeys={assignedKeys}
        onSelect={handlePickPlayer}
        onClose={() => setPickerSlotId(null)}
      />

      <div className="stadium-stage">
        <StadiumCanvas
          imageUrl={view.template.imageUrl}
          backgroundType={view.template.backgroundType}
          aspectRatio="2 / 1"
          fill
          plantOnFloor
          slots={slotViews}
          onAssign={handleAssign}
          onSelectPlayer={(slotId) => {
            setPickerSlotId(null);
            setSelectedSlotId(slotId);
          }}
          onSelectEmptySlot={handleOpenEmptySlot}
          highlightSlotId={pickerSlotId}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="pixel-card flex flex-wrap items-center justify-between gap-4"
        style={{ borderColor: 'var(--blue)' }}
      >
        <div>
          <h1 className="pixel-text text-xl sm:text-2xl" style={{ color: 'var(--blue)' }}>
            <i className="bi bi-droplet-fill" aria-hidden /> {t('club:vestiario.title')}
          </h1>
          <p className="retro-text text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            {t('club:vestiario.subtitle')}
          </p>
          <p className="retro-text text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            {t('club:vestiario.ctHint', { rate: view.passiveRecoveryPerHour })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void handleRest()}
            disabled={dailyRest.isPending || !view.canClaimDailyRest}
            className="pixel-btn pixel-btn-blue pixel-btn-md disabled:opacity-50"
          >
            {dailyRest.isPending
              ? t('common:labels.status.loading')
              : view.canClaimDailyRest
                ? t('club:vestiario.rest')
                : t('club:vestiario.restUsed')}
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saveLineup.isPending}
            className="pixel-btn pixel-btn-green pixel-btn-md"
          >
            {saveLineup.isPending ? t('common:labels.status.loading') : t('club:stadium.save')}
          </button>
        </div>
      </motion.div>

      {restErr && <p className="retro-text text-red text-center">{restErr}</p>}
      {restMsg && <p className="retro-text text-center" style={{ color: 'var(--green)' }}>{restMsg}</p>}
      {saveErr && <p className="retro-text text-red text-center">{saveErr}</p>}
      {saveMsg && <p className="retro-text text-center" style={{ color: 'var(--green)' }}>{saveMsg}</p>}

      <VestiarioRoster
        entries={rosterEntries(slotViews, benchPlayers)}
        onOpen={(entry) => setRosterPlayer(toLineupPlayer(entry))}
      />
      <PlayerCardModal player={liveRosterPlayer} onClose={() => setRosterPlayer(null)} />
      {freeAssign ? (
        <FreeFieldAssignDialog
          playerName={playerNickname(freeAssign.player.name, freeAssign.player.id, freeAssign.player.position)}
          onCancel={() => setFreeAssign(null)}
          onConfirm={() => {
            commitAssign(freeAssign.slotId, {
              playerId: freeAssign.player.id,
              kind: freeAssign.player.kind,
              position: freeAssign.player.position,
            });
            setFreeAssign(null);
          }}
        />
      ) : null}
    </div>
  );
}

function rosterEntries(
  slots: Array<{ slot: { id: string }; player: InventoryPlayerDTO | null }>,
  bench: InventoryPlayerDTO[],
): RosterEntry[] {
  const starters = slots
    .filter((item) => item.player)
    .map((item) => ({ player: item.player as InventoryPlayerDTO, role: 'titular' as const, slotId: item.slot.id }));
  const reserves = bench.map((player) => ({ player, role: 'reserva' as const, slotId: null }));
  return [...starters, ...reserves];
}

function toLineupPlayer(entry: RosterEntry): LineupPlayerDTO {
  const player = entry.player;
  return {
    id: player.id,
    kind: player.kind,
    rarity: player.rarity,
    overwall: player.overwall,
    positionPower: player.positionPower,
    position: player.position,
    name: player.name ?? null,
    imageUrl: player.imageUrl ?? null,
    tokenId: player.tokenId,
    stamina: player.stamina,
    staminaMax: player.staminaMax,
    listed: player.listed,
    inLineup: entry.role === 'titular',
    age: player.age,
    retireAge: player.retireAge,
    roiPct: player.roiPct,
    costBasisUsdc: player.costBasisUsdc,
    lifetimeEarnedUsdc: player.lifetimeEarnedUsdc,
    createdAt: player.createdAt ?? null,
    staked: player.staked,
    stakeGmt: player.stakeGmt,
    stakedAt: player.stakedAt,
    freeField: player.freeField,
  };
}

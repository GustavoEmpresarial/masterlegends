import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  GEAR_SLOTS,
  GearSlot,
  type GearSlotType,
  type InventoryPlayerDTO,
  type UserGearDTO,
} from '@mll/shared';
import { useEquipGear, useGearBag, useUnequipGear } from '../../hooks/useApi';
import { translateError } from '../../lib/apiError';

export type DraftMap = Record<GearSlotType, string | null>;

export type SlotItem = {
  nameKey: string;
  rarity: number;
  owBonus: number;
  imageUrl: string | null;
};

export function loadoutFromPlayer(player: InventoryPlayerDTO): DraftMap {
  const next: DraftMap = {
    [GearSlot.BOOTS]: null,
    [GearSlot.GLOVES]: null,
    [GearSlot.SHINGUARDS]: null,
  };
  for (const g of player.equippedGear ?? []) {
    if (g.slot in next) next[g.slot as GearSlotType] = g.userGearId;
  }
  return next;
}

export function draftsEqual(a: DraftMap, b: DraftMap): boolean {
  return GEAR_SLOTS.every((slot) => a[slot] === b[slot]);
}

export function usePlayerGearDraft(player: InventoryPlayerDTO) {
  const { t } = useTranslation(['club']);
  const { data: bag, isLoading: bagLoading } = useGearBag();
  const equip = useEquipGear();
  const unequip = useUnequipGear();

  const [baseline, setBaseline] = useState(() => loadoutFromPlayer(player));
  const [draft, setDraft] = useState(() => loadoutFromPlayer(player));
  const [filter, setFilter] = useState<GearSlotType | 'all'>('all');
  const [dragOverSlot, setDragOverSlot] = useState<GearSlotType | null>(null);
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  const dirty = !draftsEqual(draft, baseline);
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;

  useEffect(() => {
    if (dirtyRef.current) return;
    const server = loadoutFromPlayer(player);
    setBaseline(server);
    setDraft(server);
  }, [player.id, player.kind, player.equippedGear]);

  const itemsById = useMemo(() => {
    const map = new Map<string, UserGearDTO>();
    for (const g of bag?.items ?? []) map.set(g.id, g);
    return map;
  }, [bag?.items]);

  const resolveSlotItem = useCallback(
    (slot: GearSlotType): SlotItem | null => {
      const id = draft[slot];
      if (!id) return null;
      const fromBag = itemsById.get(id);
      if (fromBag) {
        return {
          nameKey: fromBag.nameKey,
          rarity: fromBag.rarity,
          owBonus: fromBag.owBonus,
          imageUrl: fromBag.imageUrl,
        };
      }
      const fromPlayer = player.equippedGear?.find((g) => g.userGearId === id);
      if (fromPlayer) {
        return {
          nameKey: fromPlayer.nameKey,
          rarity: fromPlayer.rarity,
          owBonus: fromPlayer.owBonus,
          imageUrl: fromPlayer.imageUrl,
        };
      }
      return null;
    },
    [draft, itemsById, player.equippedGear],
  );

  const draftOw = useMemo(() => {
    let sum = 0;
    for (const slot of GEAR_SLOTS) {
      const item = resolveSlotItem(slot);
      if (item) sum += item.owBonus;
    }
    return sum;
  }, [resolveSlotItem]);

  const bagItems = useMemo(() => {
    const items = bag?.items ?? [];
    const filtered = filter === 'all' ? items : items.filter((g) => g.slot === filter);
    return [...filtered].sort((a, b) => b.owBonus - a.owBonus || b.rarity - a.rarity);
  }, [bag?.items, filter]);

  const equippedList = useMemo(() => {
    return GEAR_SLOTS.map((slot) => {
      const item = resolveSlotItem(slot);
      if (!item) return null;
      return { slot, item };
    }).filter(Boolean) as { slot: GearSlotType; item: SlotItem }[];
  }, [resolveSlotItem]);

  const assignToSlot = useCallback(
    (slot: GearSlotType, userGearId: string) => {
      const item = (bag?.items ?? []).find((g) => g.id === userGearId);
      if (!item || item.slot !== slot) {
        setErr(t('club:gear.slotMismatch'));
        return false;
      }
      setErr('');
      setDraft((prev) => {
        const next = { ...prev };
        for (const s of GEAR_SLOTS) {
          if (next[s] === userGearId) next[s] = null;
        }
        next[slot] = userGearId;
        return next;
      });
      return true;
    },
    [bag?.items, t],
  );

  /** One-click equip: put bag item into its matching slot. */
  const equipFromBag = useCallback(
    (g: UserGearDTO) => assignToSlot(g.slot, g.id),
    [assignToSlot],
  );

  const clearSlot = useCallback((slot: GearSlotType) => {
    setErr('');
    setDraft((prev) => ({ ...prev, [slot]: null }));
  }, []);

  const discard = useCallback(() => {
    setDraft({ ...baseline });
    setErr('');
  }, [baseline]);

  const save = useCallback(async () => {
    if (!dirty || saving) return;
    setSaving(true);
    setErr('');
    try {
      for (const slot of GEAR_SLOTS) {
        const from = baseline[slot];
        const to = draft[slot];
        if (from === to) continue;
        if (to) {
          await equip.mutateAsync({
            userGearId: to,
            playerId: player.id,
            kind: player.kind,
          });
        } else {
          await unequip.mutateAsync({
            playerId: player.id,
            kind: player.kind,
            slot,
          });
        }
      }
      const next = { ...draft };
      setBaseline(next);
      setDraft(next);
      setSavedFlash(true);
      window.setTimeout(() => setSavedFlash(false), 1600);
    } catch (e) {
      setErr(translateError(e, 'GEAR_NOT_FOUND'));
    } finally {
      setSaving(false);
    }
  }, [baseline, dirty, draft, equip, player.id, player.kind, saving, unequip]);

  const busy = saving || equip.isPending || unequip.isPending;

  return {
    bagLoading,
    bagItems,
    filter,
    setFilter,
    dragOverSlot,
    setDragOverSlot,
    draft,
    dirty,
    err,
    setErr,
    saving,
    savedFlash,
    busy,
    draftOw,
    baseOw: player.overwall,
    effectiveOw: player.overwall + draftOw,
    equippedList,
    resolveSlotItem,
    assignToSlot,
    equipFromBag,
    clearSlot,
    discard,
    save,
    itemsById,
  };
}

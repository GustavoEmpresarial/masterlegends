import { ROLE_EMOJI, ROLE_LABEL, ROLE_STYLE, ROLE_ORDER, slotRoleOf as roleOf } from './slotRolePresentation';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { StadiumSlot, StadiumSlotRole, StadiumTemplateDTO } from '@mll/shared';
import { STADIUM_SLOT_ROLES, defaultRivalSlots, isAwaySlot } from '@mll/shared';
import { AxiosError } from 'axios';
import { adminClient } from '../../lib/api/adminClient';
import { pointerToPct, resolveUploadUrl } from '../../lib/resolveUploadUrl';

const SNAP_PCT = 2;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function newSlotId(): string {
  return crypto.randomUUID();
}


interface MetaState {
  name: string;
  priceUsdc: string;
  active: boolean;
  isDefault: boolean;
  sortOrder: number;
  farmBonusPct: string;
  requireRareStarters: string;
  requireMinOverwall: string;
  requireOwnedTemplateId: string;
  requirementNote: string;
}

interface StadiumBuilderProps {
  initial?: StadiumTemplateDTO | null;
  /** Other stadiums for "must own previous" dropdown */
  stadiumOptions?: Array<{ id: string; name: string }>;
  onSaved: () => void;
  onCancel: () => void;
}

export function StadiumBuilder({ initial, stadiumOptions = [], onSaved, onCancel }: StadiumBuilderProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<{ slotId: string; pointerId: number; moved: boolean } | null>(null);

  const [meta, setMeta] = useState<MetaState>(() => ({
    name: initial?.name ?? '',
    priceUsdc: initial?.priceUsdc != null ? String(initial.priceUsdc) : '',
    active: initial?.active ?? false,
    isDefault: initial?.isDefault ?? false,
    sortOrder: initial?.sortOrder ?? 0,
    farmBonusPct: initial?.farmBonusPct != null ? String(initial.farmBonusPct) : '0.05',
    requireRareStarters:
      initial?.requireRareStarters != null ? String(initial.requireRareStarters) : '11',
    requireMinOverwall:
      initial?.requireMinOverwall != null ? String(initial.requireMinOverwall) : '0',
    requireOwnedTemplateId: initial?.requireOwnedTemplateId ?? '',
    requirementNote: initial?.requirementNote ?? '',
  }));
  const [slots, setSlots] = useState<StadiumSlot[]>(initial?.slots ?? []);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState(
    initial?.imageUrl ? resolveUploadUrl(initial.imageUrl) : '',
  );
  const [snapGrid, setSnapGrid] = useState(true);
  const [addMode, setAddMode] = useState(!(initial?.slots?.length ?? 0));
  const [editingSide, setEditingSide] = useState<'home' | 'away'>('home');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [savedOk, setSavedOk] = useState(false);

  useEffect(() => {
    setSlots((prev) => (prev.some(isAwaySlot) ? prev : [...prev, ...defaultRivalSlots()]));
  }, []);

  useEffect(() => {
    return () => {
      if (imagePreview.startsWith('blob:')) URL.revokeObjectURL(imagePreview);
    };
  }, [imagePreview]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedId(null);
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId && !isInput(e.target)) {
        e.preventDefault();
        setSlots((prev) => prev.filter((s) => s.id !== selectedId));
        setSelectedId(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId]);

  const selected = slots.find((s) => s.id === selectedId) ?? null;

  const updateSlot = useCallback((id: string, patch: Partial<StadiumSlot>) => {
    setSavedOk(false);
    setSlots((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }, []);

  const addSlotAt = useCallback(
    (xPct: number, yPct: number) => {
      const n = slots.length + 1;
      const slot: StadiumSlot = {
        id: newSlotId(),
        label: `Slot ${n}`,
        xPct,
        yPct,
        role: 'MID',
        zIndex: n,
      };
      setSavedOk(false);
      setSlots((prev) => [...prev, slot]);
      setSelectedId(slot.id);
    },
    [slots.length],
  );

  const removeSelected = useCallback(() => {
    if (!selectedId) return;
    setSavedOk(false);
    setSlots((prev) => prev.filter((s) => s.id !== selectedId));
    setSelectedId(null);
  }, [selectedId]);

  const placeRivals = useCallback(() => {
    setSavedOk(false);
    setEditingSide('away');
    setAddMode(false);
    setSlots((prev) => {
      const have = new Set(prev.filter(isAwaySlot).map((slot) => slot.id));
      const missing = defaultRivalSlots().filter((slot) => !have.has(slot.id));
      return missing.length ? [...prev, ...missing] : prev;
    });
  }, []);

  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (dragRef.current?.moved) return;
    if (editingSide === 'away' || !addMode) {
      setSelectedId(null);
      return;
    }
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const snap = snapGrid ? SNAP_PCT : undefined;
    const { xPct, yPct } = pointerToPct(e.clientX, e.clientY, rect, snap);
    addSlotAt(xPct, yPct);
  };

  const handleMarkerPointerDown = (e: React.PointerEvent, slotId: string) => {
    e.stopPropagation();
    e.preventDefault();
    setSelectedId(slotId);
    dragRef.current = { slotId, pointerId: e.pointerId, moved: false };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleMarkerPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    drag.moved = true;
    setSavedOk(false);
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const snap = snapGrid ? SNAP_PCT : undefined;
    const { xPct, yPct } = pointerToPct(e.clientX, e.clientY, rect, snap);
    updateSlot(drag.slotId, { xPct, yPct });
  };

  const handleMarkerPointerUp = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    dragRef.current = null;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
  };

  const applyImageFile = (file: File) => {
    if (file.size > MAX_IMAGE_BYTES) {
      setMessage(`Imagem muito grande (máx. ${MAX_IMAGE_BYTES / (1024 * 1024)} MB)`);
      return;
    }
    setMessage('');
    setSavedOk(false);
    if (imagePreview.startsWith('blob:')) URL.revokeObjectURL(imagePreview);
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    applyImageFile(file);
  };

  async function save() {
    setMessage('');
    if (!meta.name.trim()) {
      setMessage('Nome obrigatório');
      return;
    }
    if (!initial && !imageFile) {
      setMessage('Imagem obrigatória');
      return;
    }
    if (imageFile && imageFile.size > MAX_IMAGE_BYTES) {
      setMessage(`Imagem muito grande (máx. ${MAX_IMAGE_BYTES / (1024 * 1024)} MB)`);
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: meta.name.trim(),
        slots,
        active: meta.active,
        isDefault: meta.isDefault,
        sortOrder: meta.sortOrder,
        priceUsdc:
          meta.priceUsdc.trim() === '' ? null : Number.parseFloat(meta.priceUsdc.trim()),
        farmBonusPct:
          meta.farmBonusPct.trim() === '' ? undefined : Number.parseFloat(meta.farmBonusPct.trim()),
        requireRareStarters: Number.parseInt(meta.requireRareStarters.trim() || '0', 10) || 0,
        requireMinOverwall: Number.parseInt(meta.requireMinOverwall.trim() || '0', 10) || 0,
        requireOwnedTemplateId: meta.requireOwnedTemplateId.trim() || null,
        requirementNote: meta.requirementNote.trim() || null,
      };

      const appendReqFields = (fd: FormData) => {
        fd.set('requireRareStarters', String(payload.requireRareStarters));
        fd.set('requireMinOverwall', String(payload.requireMinOverwall));
        fd.set(
          'requireOwnedTemplateId',
          payload.requireOwnedTemplateId == null ? 'null' : payload.requireOwnedTemplateId,
        );
        fd.set(
          'requirementNote',
          payload.requirementNote == null ? 'null' : payload.requirementNote,
        );
      };

      if (initial) {
        if (imageFile) {
          const fd = new FormData();
          fd.set('name', payload.name);
          fd.set('slots', JSON.stringify(payload.slots));
          fd.set('active', String(payload.active));
          fd.set('isDefault', String(payload.isDefault));
          fd.set('sortOrder', String(payload.sortOrder));
          fd.set('priceUsdc', payload.priceUsdc === null ? 'null' : String(payload.priceUsdc));
          if (payload.farmBonusPct !== undefined) fd.set('farmBonusPct', String(payload.farmBonusPct));
          appendReqFields(fd);
          fd.set('image', imageFile);
          await adminClient.patch(`/stadiums/${initial.id}`, fd);
        } else {
          await adminClient.patch(`/stadiums/${initial.id}`, payload);
        }
        setMessage('Estádio salvo com sucesso');
        setSavedOk(true);
      } else {
        const fd = new FormData();
        fd.set('name', payload.name);
        fd.set('slots', JSON.stringify(payload.slots));
        fd.set('active', String(payload.active));
        fd.set('isDefault', String(payload.isDefault));
        fd.set('sortOrder', String(payload.sortOrder));
        fd.set('priceUsdc', payload.priceUsdc === null ? 'null' : String(payload.priceUsdc));
        if (payload.farmBonusPct !== undefined) fd.set('farmBonusPct', String(payload.farmBonusPct));
        appendReqFields(fd);
        fd.set('image', imageFile!);
        await adminClient.post('/stadiums', fd);
        setMessage('Estádio criado com sucesso');
        setSavedOk(true);
        onSaved();
      }
    } catch (err) {
      setSavedOk(false);
      const axiosErr = err as AxiosError<{ error?: { code?: string; details?: unknown } }>;
      const status = axiosErr.response?.status;
      const code = axiosErr.response?.data?.error?.code;
      const details = axiosErr.response?.data?.error?.details as
        | { reason?: string }
        | undefined;
      if (status === 401) {
        setMessage('Sessão expirada — faça login novamente');
      } else if (status === 413 || details?.reason === 'file_too_large') {
        setMessage(`Imagem muito grande (máx. ${MAX_IMAGE_BYTES / (1024 * 1024)} MB)`);
      } else if (details?.reason === 'unsupported_mime') {
        setMessage('Formato inválido — use PNG, JPEG ou WebP');
      } else if (code === 'VALIDATION_ERROR') {
        setMessage('Dados inválidos — verifique slots e campos');
      } else if (!axiosErr.response) {
        setMessage('Falha de rede — tente novamente');
      } else {
        setMessage(`Erro ao salvar (${status ?? 'desconhecido'})`);
      }
    } finally {
      setSubmitting(false);
    }
  }

  const homeSlots = slots.filter((slot) => !isAwaySlot(slot));
  const awaySlots = slots.filter(isAwaySlot);
  const slotsByRole = ROLE_ORDER.map((role) => ({
    role,
    items: homeSlots.filter((s) => roleOf(s) === role),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="space-y-5 pb-8">
      {/* Sticky header */}
      <div className="sticky top-0 z-30 -mx-4 px-4 py-3 bg-slate-950/95 backdrop-blur border-b border-slate-800">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-widest text-slate-500">Editor de estádio</p>
            <h2 className="text-lg font-semibold text-slate-100 truncate">
              {initial ? initial.name : 'Novo template'}
            </h2>
            <div className="mt-1 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-800 px-2 py-0.5 text-[11px] text-slate-300">
                <i className="bi bi-geo-alt" aria-hidden />
                {homeSlots.length} seu time
                {awaySlots.length > 0 ? ` · ${awaySlots.length} adversário` : ''}
              </span>
              {meta.isDefault && (
                <span className="rounded-full bg-amber-950/60 border border-amber-700/50 px-2 py-0.5 text-[11px] text-amber-300">
                  Padrão
                </span>
              )}
              {meta.active && (
                <span className="rounded-full bg-emerald-950/60 border border-emerald-700/50 px-2 py-0.5 text-[11px] text-emerald-300">
                  Ativo
                </span>
              )}
              {savedOk && (
                <span className="rounded-full bg-emerald-900/40 px-2 py-0.5 text-[11px] text-emerald-300">
                  <i className="bi bi-check2 mr-1" aria-hidden />
                  Salvo
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                if (savedOk) onSaved();
                else onCancel();
              }}
              className="rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800"
            >
              Voltar
            </button>
            <button
              type="button"
              onClick={() => void save()}
              disabled={submitting}
              className="rounded-lg bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 shadow-lg shadow-emerald-900/30"
            >
              {submitting ? (
                <>
                  <i className="bi bi-arrow-repeat animate-spin mr-1.5" aria-hidden />
                  Salvando…
                </>
              ) : (
                <>
                  <i className="bi bi-floppy mr-1.5" aria-hidden />
                  Salvar
                </>
              )}
            </button>
          </div>
        </div>
        {message && (
          <p
            className={`mt-2 text-sm ${
              message.toLowerCase().includes('erro') ||
              message.includes('expirada') ||
              message.includes('inválid')
                ? 'text-red-400'
                : 'text-emerald-400'
            }`}
          >
            {message}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-5">
        {/* Canvas column */}
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2 items-center rounded-lg border border-slate-800 bg-slate-900/40 p-2">
            <button
              type="button"
              onClick={() => {
                setEditingSide('home');
              }}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                editingSide === 'home'
                  ? 'bg-emerald-900/50 text-emerald-200 ring-1 ring-emerald-600/50'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <i className="bi bi-people-fill" aria-hidden />
              Seu time
            </button>
            <button
              type="button"
              onClick={() => {
                setEditingSide('away');
                setAddMode(false);
              }}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                editingSide === 'away'
                  ? 'bg-yellow-900/50 text-yellow-200 ring-1 ring-yellow-600/50'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <i className="bi bi-flag-fill" aria-hidden />
              Adversário
            </button>
            {editingSide === 'away' && (
              <button
                type="button"
                onClick={placeRivals}
                className="inline-flex items-center gap-1 rounded-md border border-yellow-800/70 px-2.5 py-1.5 text-xs text-yellow-200 hover:bg-yellow-950/40"
              >
                <i className="bi bi-plus-lg" aria-hidden />
                {awaySlots.length === 0 ? 'Colocar adversário' : 'Repor os que faltam'}
              </button>
            )}
            <button
              type="button"
              onClick={() => setAddMode((v) => !v)}
              disabled={editingSide === 'away'}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors disabled:opacity-40 ${
                addMode && editingSide === 'home'
                  ? 'bg-cyan-900/50 text-cyan-200 ring-1 ring-cyan-600/50'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <i className={`bi ${addMode && editingSide === 'home' ? 'bi-cursor-fill' : 'bi-cursor'}`} aria-hidden />
              {addMode && editingSide === 'home' ? 'Modo adicionar ON' : 'Modo adicionar'}
            </button>
            <button
              type="button"
              onClick={() => addSlotAt(50, 50)}
              disabled={editingSide === 'away'}
              className="inline-flex items-center gap-1 rounded-md border border-slate-700 px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-40"
            >
              <i className="bi bi-plus-lg" aria-hidden />
              Centro
            </button>
            <button
              type="button"
              onClick={removeSelected}
              disabled={!selectedId}
              className="inline-flex items-center gap-1 rounded-md border border-red-900/60 px-2.5 py-1.5 text-xs text-red-300 hover:bg-red-950/40 disabled:opacity-40"
            >
              <i className="bi bi-trash" aria-hidden />
              Remover
            </button>
            <label className="ml-auto inline-flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
              <input
                type="checkbox"
                checked={snapGrid}
                onChange={(e) => setSnapGrid(e.target.checked)}
                className="rounded border-slate-600"
              />
              <i className="bi bi-grid-3x3" aria-hidden />
              Snap {SNAP_PCT}%
            </label>
          </div>

          <p className="text-xs text-slate-500 leading-relaxed">
            Arraste os 11 do seu time e os 11 amarelos do adversário. Os dois ficam no chão, na marca.
            Salve para o estádio usar isso.{' '}
            <kbd className="rounded bg-slate-800 px-1">Del</kbd> remove ·{' '}
            <kbd className="rounded bg-slate-800 px-1">Esc</kbd> desmarca
          </p>

          <div
            ref={canvasRef}
            className={`relative w-full select-none overflow-hidden rounded-xl border-2 shadow-2xl shadow-black/40 ${
              addMode ? 'cursor-crosshair border-cyan-800/50' : 'cursor-default border-slate-700'
            }`}
            style={{ aspectRatio: '16 / 10' }}
            onClick={handleCanvasClick}
            role="presentation"
          >
            <div className="absolute inset-0 bg-[#0a1628]" />

            {snapGrid && (
              <div
                className="absolute inset-0 pointer-events-none opacity-[0.12]"
                style={{
                  backgroundImage: `
                    linear-gradient(to right, #34d399 1px, transparent 1px),
                    linear-gradient(to bottom, #34d399 1px, transparent 1px)
                  `,
                  backgroundSize: `${SNAP_PCT}% ${SNAP_PCT}%`,
                }}
              />
            )}

            {imagePreview ? (
              <img
                src={imagePreview}
                alt="Campo do estádio"
                className="absolute inset-0 h-full w-full object-contain pointer-events-none"
                draggable={false}
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-600">
                <i className="bi bi-image text-4xl opacity-40" aria-hidden />
                <p className="text-sm">Envie uma imagem de fundo</p>
              </div>
            )}

            {slots.map((slot, idx) => {
              const isSelected = slot.id === selectedId;
              const away = isAwaySlot(slot);
              const role = roleOf(slot);
              const style = away
                ? {
                    ring: 'ring-yellow-300/90',
                    bg: 'bg-yellow-400/25 border-yellow-300',
                    text: 'text-yellow-100',
                  }
                : ROLE_STYLE[role];
              const emoji = ROLE_EMOJI[role];
              return (
                <div
                  key={slot.id}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 touch-none ${
                    isSelected ? 'z-20' : 'z-10'
                  }`}
                  style={{
                    left: `${slot.xPct}%`,
                    top: `${slot.yPct}%`,
                    zIndex: slot.zIndex ?? idx + 1,
                  }}
                  onPointerDown={(e) => handleMarkerPointerDown(e, slot.id)}
                  onPointerMove={handleMarkerPointerMove}
                  onPointerUp={handleMarkerPointerUp}
                  onPointerCancel={handleMarkerPointerUp}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div
                    className={`flex flex-col items-center gap-0.5 transition-transform ${
                      isSelected ? 'scale-110' : 'hover:scale-105'
                    }`}
                  >
                    <span
                      className={`flex h-9 w-9 items-center justify-center rounded-full text-base shadow-lg border-2 ${style.bg} ${
                        isSelected ? `ring-2 ${style.ring}` : ''
                      }`}
                    >
                      <i className={`bi ${emoji}`} aria-hidden />
                    </span>
                    <span
                      className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md whitespace-nowrap backdrop-blur-sm border ${style.bg} ${style.text}`}
                    >
                      {slot.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Sidebar */}
        <aside className="space-y-4">
          <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Informações
            </h3>
            <label className="block">
              <span className="text-xs text-slate-500">Nome</span>
              <input
                value={meta.name}
                onChange={(e) => {
                  setSavedOk(false);
                  setMeta((m) => ({ ...m, name: e.target.value }));
                }}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
                maxLength={64}
              />
            </label>

            <div>
              <span className="text-xs text-slate-500">Imagem de fundo</span>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleImageChange}
                className="sr-only"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const file = e.dataTransfer.files?.[0];
                  if (file) applyImageFile(file);
                }}
                className="mt-1 w-full rounded-lg border border-dashed border-slate-600 bg-slate-950/50 p-3 text-left hover:border-emerald-700/60 hover:bg-slate-900 transition-colors"
              >
                {imagePreview ? (
                  <div className="flex items-center gap-3">
                    <img
                      src={imagePreview}
                      alt=""
                      className="h-14 w-20 rounded object-contain bg-black/30"
                    />
                    <div className="min-w-0 text-xs">
                      <p className="text-slate-300 truncate">
                        {imageFile?.name ?? 'Imagem atual'}
                      </p>
                      <p className="text-slate-500 mt-0.5">Clique ou arraste para trocar</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1 py-2 text-slate-500">
                    <i className="bi bi-cloud-upload text-xl" aria-hidden />
                    <span className="text-xs">PNG, JPEG ou WebP · máx. 5 MB</span>
                  </div>
                )}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="text-xs text-slate-500">Preço USDC</span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={meta.priceUsdc}
                  onChange={(e) => {
                    setSavedOk(false);
                    setMeta((m) => ({ ...m, priceUsdc: e.target.value }));
                  }}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm"
                  placeholder="Grátis"
                />
              </label>
              <label className="block">
                <span className="text-xs text-slate-500">Ordem</span>
                <input
                  type="number"
                  min={0}
                  value={meta.sortOrder}
                  onChange={(e) => {
                    setSavedOk(false);
                    setMeta((m) => ({ ...m, sortOrder: Number(e.target.value) || 0 }));
                  }}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm"
                />
              </label>
              <label className="block col-span-2">
                <span className="text-xs text-slate-500">
                  Bônus de receita do elenco (0–10 · ex: 0.05 = +5% sobre o overwall)
                </span>
                <input
                  type="number"
                  min={0}
                  max={10}
                  step="0.0001"
                  value={meta.farmBonusPct}
                  onChange={(e) => {
                    setSavedOk(false);
                    setMeta((m) => ({ ...m, farmBonusPct: e.target.value }));
                  }}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm"
                  placeholder="0.05"
                />
              </label>
            </div>

            <div className="rounded-xl border border-amber-500/30 bg-gradient-to-b from-amber-500/10 to-transparent p-3.5 space-y-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="text-[11px] font-semibold uppercase tracking-wider text-amber-300">
                    Requisitos para comprar
                  </h4>
                  <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
                    Gates do elenco, raridade e poder. Só valem em estádios <strong className="text-amber-200/90">pagos</strong>.
                  </p>
                </div>
                {meta.priceUsdc.trim() === '' || Number(meta.priceUsdc) <= 0 ? (
                  <span className="shrink-0 rounded-full border border-slate-600 bg-slate-900 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-400">
                    Grátis · gates off
                  </span>
                ) : (
                  <span className="shrink-0 rounded-full border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-200">
                    Pago · gates on
                  </span>
                )}
              </div>

              {/* ── Elenco / raridade ── */}
              <div className="rounded-lg border border-slate-700/80 bg-slate-950/60 p-3 space-y-2.5">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-sky-500/20 text-sky-300 text-xs">
                    <i className="bi bi-star-fill" aria-hidden />
                  </span>
                  <div>
                    <p className="text-xs font-semibold text-sky-200">Elenco · raridade</p>
                    <p className="text-[10px] text-slate-500">
                      Conta jogadores Rare, Super Rare, Épico, Lendário e Mítico no elenco (não só titulares).
                    </p>
                  </div>
                </div>
                <label className="block">
                  <span className="text-[11px] text-slate-400">
                    Mínimo de jogadores Rare+
                    <span className="ml-1 text-slate-600">(0 = desligado)</span>
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={50}
                    value={meta.requireRareStarters}
                    onChange={(e) => {
                      setSavedOk(false);
                      setMeta((m) => ({ ...m, requireRareStarters: e.target.value }));
                    }}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-2 text-sm text-white"
                  />
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { n: 0, label: 'Off' },
                    { n: 5, label: '5 Rare+' },
                    { n: 8, label: '8 Rare+' },
                    { n: 11, label: '11 Rare+' },
                    { n: 15, label: '15 Rare+' },
                  ].map((p) => {
                    const active = Number(meta.requireRareStarters) === p.n;
                    return (
                      <button
                        key={p.n}
                        type="button"
                        onClick={() => {
                          setSavedOk(false);
                          setMeta((m) => ({ ...m, requireRareStarters: String(p.n) }));
                        }}
                        className={`rounded-md border px-2 py-1 text-[11px] font-medium transition-colors ${
                          active
                            ? 'border-sky-400/60 bg-sky-500/20 text-sky-100'
                            : 'border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-500 hover:text-slate-200'
                        }`}
                      >
                        {p.label}
                      </button>
                    );
                  })}
                </div>
                <div className="flex flex-wrap gap-1 pt-0.5">
                  {[
                    { label: 'Comum', on: false },
                    { label: 'Rare', on: true },
                    { label: 'S.Rare', on: true },
                    { label: 'Épico', on: true },
                    { label: 'Lendário', on: true },
                    { label: 'Mítico', on: true },
                  ].map((r) => (
                    <span
                      key={r.label}
                      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                        r.on
                          ? 'bg-sky-500/15 text-sky-200 ring-1 ring-sky-500/30'
                          : 'bg-slate-800/80 text-slate-500 line-through decoration-slate-600'
                      }`}
                    >
                      {r.label}
                    </span>
                  ))}
                </div>
              </div>

              {/* ── Poder ── */}
              <div className="rounded-lg border border-slate-700/80 bg-slate-950/60 p-3 space-y-2.5">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-violet-500/20 text-violet-300 text-xs">
                    <i className="bi bi-lightning-charge-fill" aria-hidden />
                  </span>
                  <div>
                    <p className="text-xs font-semibold text-violet-200">Poder · Overwall</p>
                    <p className="text-[10px] text-slate-500">
                      OW total do clube (titulares + gear + farm do estádio + presença).
                    </p>
                  </div>
                </div>
                <label className="block">
                  <span className="text-[11px] text-slate-400">
                    Overwall mínimo
                    <span className="ml-1 text-slate-600">(0 = desligado)</span>
                  </span>
                  <input
                    type="number"
                    min={0}
                    step={100}
                    value={meta.requireMinOverwall}
                    onChange={(e) => {
                      setSavedOk(false);
                      setMeta((m) => ({ ...m, requireMinOverwall: e.target.value }));
                    }}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-2 text-sm text-white"
                  />
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {[0, 5000, 15000, 50000, 100000, 250000].map((n) => {
                    const active = Number(meta.requireMinOverwall) === n;
                    return (
                      <button
                        key={n}
                        type="button"
                        onClick={() => {
                          setSavedOk(false);
                          setMeta((m) => ({ ...m, requireMinOverwall: String(n) }));
                        }}
                        className={`rounded-md border px-2 py-1 text-[11px] font-medium transition-colors ${
                          active
                            ? 'border-violet-400/60 bg-violet-500/20 text-violet-100'
                            : 'border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-500 hover:text-slate-200'
                        }`}
                      >
                        {n === 0 ? 'Off' : n.toLocaleString('pt-BR')}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ── Progressão ── */}
              <div className="rounded-lg border border-slate-700/80 bg-slate-950/60 p-3 space-y-2.5">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-500/20 text-emerald-300 text-xs">
                    <i className="bi bi-building" aria-hidden />
                  </span>
                  <div>
                    <p className="text-xs font-semibold text-emerald-200">Progressão · campo anterior</p>
                    <p className="text-[10px] text-slate-500">
                      Exige licença assinada de outro estádio (cadeia de upgrades).
                    </p>
                  </div>
                </div>
                <label className="block">
                  <span className="text-[11px] text-slate-400">Precisa já ter licença de</span>
                  <select
                    value={meta.requireOwnedTemplateId}
                    onChange={(e) => {
                      setSavedOk(false);
                      setMeta((m) => ({ ...m, requireOwnedTemplateId: e.target.value }));
                    }}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-2 text-sm text-white"
                  >
                    <option value="">Nenhum (sem pré-requisito)</option>
                    {stadiumOptions
                      .filter((s) => s.id !== initial?.id)
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-[11px] text-slate-400">Nota para o jogador (opcional)</span>
                  <textarea
                    value={meta.requirementNote}
                    onChange={(e) => {
                      setSavedOk(false);
                      setMeta((m) => ({ ...m, requirementNote: e.target.value }));
                    }}
                    rows={2}
                    maxLength={280}
                    placeholder="Ex: Liberado após Campo da 4ª Divisão · time competitivo"
                    className="mt-1 w-full resize-y rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-2 text-sm text-white placeholder:text-slate-600"
                  />
                  <span className="mt-0.5 block text-right text-[10px] text-slate-600">
                    {meta.requirementNote.length}/280
                  </span>
                </label>
              </div>

              {/* ── Preview jogador ── */}
              <div className="rounded-lg border border-amber-500/20 bg-black/30 p-3">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-amber-300/80">
                  Como o jogador vê
                </p>
                {meta.priceUsdc.trim() === '' || Number(meta.priceUsdc) <= 0 ? (
                  <p className="text-[11px] text-slate-500">Estádio grátis — sem checklist de requisitos.</p>
                ) : (
                  <ul className="space-y-1.5 text-[12px] text-slate-200">
                    {Number(meta.requireRareStarters) > 0 ? (
                      <li className="flex gap-2">
                        <span className="text-sky-400"><i className="bi bi-star-fill" aria-hidden /></span>
                        <span>
                          {meta.requireRareStarters} jogadores <strong>Rare+</strong> no elenco
                        </span>
                      </li>
                    ) : (
                      <li className="text-slate-600">· Sem gate de raridade</li>
                    )}
                    {Number(meta.requireMinOverwall) > 0 ? (
                      <li className="flex gap-2">
                        <span className="text-violet-400"><i className="bi bi-lightning-charge-fill" aria-hidden /></span>
                        <span>
                          Overwall mínimo{' '}
                          <strong>{Number(meta.requireMinOverwall).toLocaleString('pt-BR')}</strong>
                        </span>
                      </li>
                    ) : (
                      <li className="text-slate-600">· Sem gate de overwall</li>
                    )}
                    {meta.requireOwnedTemplateId ? (
                      <li className="flex gap-2">
                        <span className="text-emerald-400"><i className="bi bi-building" aria-hidden /></span>
                        <span>
                          Licença prévia:{' '}
                          <strong>
                            {stadiumOptions.find((s) => s.id === meta.requireOwnedTemplateId)?.name ??
                              'campo selecionado'}
                          </strong>
                        </span>
                      </li>
                    ) : (
                      <li className="text-slate-600">· Sem pré-requisito de campo</li>
                    )}
                    {meta.requirementNote.trim() && (
                      <li className="flex gap-2 text-amber-200/90">
                        <span><i className="bi bi-chat-fill" aria-hidden /></span>
                        <span>{meta.requirementNote.trim()}</span>
                      </li>
                    )}
                  </ul>
                )}
              </div>

              {/* Presets rápidos de divisão */}
              <div>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Presets rápidos
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    {
                      id: 'open',
                      label: 'Aberto',
                      rare: 0,
                      ow: 0,
                      note: '',
                    },
                    {
                      id: 'd4',
                      label: '4ª Divisão',
                      rare: 5,
                      ow: 5000,
                      note: 'Entrada competitiva — Rare+ no elenco',
                    },
                    {
                      id: 'd3',
                      label: '3ª Divisão',
                      rare: 8,
                      ow: 15000,
                      note: 'Liberado para clubes com elenco Rare+ sólido',
                    },
                    {
                      id: 'd2',
                      label: '2ª Divisão',
                      rare: 11,
                      ow: 50000,
                      note: 'Exige time completo Rare+ e alto overwall',
                    },
                    {
                      id: 'd1',
                      label: '1ª Divisão',
                      rare: 15,
                      ow: 100000,
                      note: 'Elite da liga — só clubes top',
                    },
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setSavedOk(false);
                        setMeta((m) => ({
                          ...m,
                          requireRareStarters: String(p.rare),
                          requireMinOverwall: String(p.ow),
                          requirementNote: p.note,
                        }));
                      }}
                      className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-300 hover:border-amber-500/40 hover:text-amber-100"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-1">
              <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={meta.active}
                  onChange={(e) => {
                    setSavedOk(false);
                    setMeta((m) => ({ ...m, active: e.target.checked }));
                  }}
                  className="rounded border-slate-600"
                />
                Ativo (visível para venda)
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={meta.isDefault}
                  onChange={(e) => {
                    setSavedOk(false);
                    setMeta((m) => ({ ...m, isDefault: e.target.checked }));
                  }}
                  className="rounded border-slate-600"
                />
                Estádio padrão
              </label>
            </div>
          </section>

          {/* Selected slot */}
          {selected && (
            <section className="rounded-xl border border-emerald-800/40 bg-emerald-950/20 p-4 space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-emerald-400/80">
                Slot selecionado
              </h3>
              <input
                value={selected.label}
                onChange={(e) => updateSlot(selected.id, { label: e.target.value })}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                maxLength={32}
              />
              <select
                value={selected.role ?? 'MID'}
                disabled={isAwaySlot(selected)}
                onChange={(e) =>
                  updateSlot(selected.id, { role: e.target.value as StadiumSlotRole })
                }
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm disabled:opacity-50"
              >
                {STADIUM_SLOT_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL[r]} ({r})
                  </option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <label>
                  <span className="text-slate-500">X %</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={snapGrid ? SNAP_PCT : 0.1}
                    value={Math.round(selected.xPct * 10) / 10}
                    onChange={(e) =>
                      updateSlot(selected.id, { xPct: Number(e.target.value) })
                    }
                    className="mt-0.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5"
                  />
                </label>
                <label>
                  <span className="text-slate-500">Y %</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={snapGrid ? SNAP_PCT : 0.1}
                    value={Math.round(selected.yPct * 10) / 10}
                    onChange={(e) =>
                      updateSlot(selected.id, { yPct: Number(e.target.value) })
                    }
                    className="mt-0.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5"
                  />
                </label>
              </div>
            </section>
          )}

          {/* Slot list by role */}
          <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
              Elenco ({homeSlots.length})
            </h3>
            {homeSlots.length === 0 ? (
              <p className="text-xs text-slate-600">Nenhum slot — ative o modo adicionar.</p>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                {slotsByRole.map(({ role, items }) => (
                  <div key={role}>
                    <p
                      className={`text-[10px] uppercase tracking-wider mb-1 flex items-center gap-1.5 ${ROLE_STYLE[role].text}`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${ROLE_STYLE[role].dot}`} />
                      {ROLE_LABEL[role]}
                    </p>
                    <ul className="space-y-0.5">
                      {items.map((slot) => (
                        <li key={slot.id}>
                          <button
                            type="button"
                            onClick={() => setSelectedId(slot.id)}
                            className={`w-full text-left rounded-md px-2 py-1.5 text-xs transition-colors ${
                              slot.id === selectedId
                                ? `${ROLE_STYLE[role].bg} ${ROLE_STYLE[role].text}`
                                : 'text-slate-400 hover:bg-slate-800'
                            }`}
                          >
                            <span className="font-medium">{slot.label}</span>
                            <span className="text-slate-500 ml-1">
                              {slot.xPct.toFixed(0)}%, {slot.yPct.toFixed(0)}%
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-xl border border-yellow-900/40 bg-slate-900/50 p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-yellow-200/80">
                Adversário ({awaySlots.length})
              </h3>
              <button
                type="button"
                onClick={placeRivals}
                className="rounded-md border border-yellow-800/70 px-2 py-1 text-[11px] text-yellow-200 hover:bg-yellow-950/40"
              >
                {awaySlots.length === 0 ? 'Colocar' : 'Repor'}
              </button>
            </div>
            {awaySlots.length === 0 ? (
              <p className="text-xs text-slate-500">
                Ainda não está no campo. Colocar põe os 11 para você arrastar.
              </p>
            ) : (
              <ul className="space-y-0.5 max-h-48 overflow-y-auto pr-1">
                {awaySlots.map((slot) => (
                  <li key={slot.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingSide('away');
                        setAddMode(false);
                        setSelectedId(slot.id);
                      }}
                      className={`w-full text-left rounded-md px-2 py-1.5 text-xs transition-colors ${
                        slot.id === selectedId
                          ? 'bg-yellow-400/20 text-yellow-100'
                          : 'text-slate-400 hover:bg-slate-800'
                      }`}
                    >
                      <span className="font-medium">{slot.label}</span>
                      <span className="text-slate-500 ml-1">
                        {slot.xPct.toFixed(0)}%, {slot.yPct.toFixed(0)}%
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-xl border border-yellow-900/40 bg-slate-900/50 p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-yellow-200/80">
                Adversário ({awaySlots.length})
              </h3>
              <button
                type="button"
                onClick={placeRivals}
                className="rounded-md border border-yellow-800/70 px-2 py-1 text-[11px] text-yellow-200 hover:bg-yellow-950/40"
              >
                {awaySlots.length === 0 ? 'Colocar' : 'Repor'}
              </button>
            </div>
            {awaySlots.length === 0 ? (
              <p className="text-xs text-slate-500">
                Ainda não está no campo. Colocar põe os 11 para você arrastar.
              </p>
            ) : (
              <ul className="space-y-0.5 max-h-48 overflow-y-auto pr-1">
                {awaySlots.map((slot) => (
                  <li key={slot.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingSide('away');
                        setAddMode(false);
                        setSelectedId(slot.id);
                      }}
                      className={`w-full text-left rounded-md px-2 py-1.5 text-xs transition-colors ${
                        slot.id === selectedId
                          ? 'bg-yellow-400/20 text-yellow-100'
                          : 'text-slate-400 hover:bg-slate-800'
                      }`}
                    >
                      <span className="font-medium">{slot.label}</span>
                      <span className="text-slate-500 ml-1">
                        {slot.xPct.toFixed(0)}%, {slot.yPct.toFixed(0)}%
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}

function isInput(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

import { ROLE_EMOJI, ROLE_LABEL, ROLE_STYLE, ROLE_ORDER, slotRoleOf as roleOf } from './slotRolePresentation';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { StadiumSlot, StadiumSlotRole, VestiarioBackgroundType, VestiarioTemplateDTO } from '@mll/shared';
import { STADIUM_SLOT_ROLES, VESTIARIO_IMAGE_MAX_BYTES, VESTIARIO_VIDEO_MAX_BYTES } from '@mll/shared';
import { AxiosError } from 'axios';
import { adminClient } from '../../lib/api/adminClient';
import { pointerToPct, resolveUploadUrl } from '../../lib/resolveUploadUrl';
import { StadiumBackgroundMedia } from '../stadium/StadiumBackgroundMedia';

const SNAP_PCT = 2;
const MAX_IMAGE_BYTES = VESTIARIO_IMAGE_MAX_BYTES;
const MAX_VIDEO_BYTES = VESTIARIO_VIDEO_MAX_BYTES;

function newSlotId(): string {
  return crypto.randomUUID();
}


interface VestiarioBuilderProps {
  initial: VestiarioTemplateDTO | null; // null = create new
  onSaved: () => void;
  onCancel?: () => void;
}

export function VestiarioBuilder({ initial, onSaved, onCancel }: VestiarioBuilderProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<{ slotId: string; pointerId: number; moved: boolean } | null>(null);

  const isNew = initial === null;
  const [name, setName] = useState(initial?.name ?? 'Novo Vestiário');
  const [slots, setSlots] = useState<StadiumSlot[]>(initial?.slots ?? []);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreviewUrl, setMediaPreviewUrl] = useState(initial ? resolveUploadUrl(initial.imageUrl) : '');
  const [mediaAspect, setMediaAspect] = useState<{ url: string; ratio: number } | null>(null);
  const [mediaPreviewType, setMediaPreviewType] = useState<VestiarioBackgroundType>(initial?.backgroundType ?? 'image');
  const [snapGrid, setSnapGrid] = useState(true);
  const [addMode, setAddMode] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [savedOk, setSavedOk] = useState(false);

  useEffect(() => {
    if (!initial) return;
    setName(initial.name);
    setSlots(initial.slots);
    setMediaPreviewUrl(resolveUploadUrl(initial.imageUrl));
    setMediaPreviewType(initial.backgroundType);
    setMediaFile(null);
  }, [initial]);

  useEffect(() => {
    return () => {
      if (mediaPreviewUrl.startsWith('blob:')) URL.revokeObjectURL(mediaPreviewUrl);
    };
  }, [mediaPreviewUrl]);

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

  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (dragRef.current?.moved) return;
    if (!addMode) {
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

  const applyMediaFile = (file: File) => {
    const isVideo = file.type.startsWith('video/');
    const maxBytes = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
    if (file.size > maxBytes) {
      setMessage(
        isVideo
          ? `Vídeo muito grande (máx. ${MAX_VIDEO_BYTES / (1024 * 1024)} MB)`
          : `Imagem muito grande (máx. ${MAX_IMAGE_BYTES / (1024 * 1024)} MB)`,
      );
      return;
    }
    if (isVideo && !['video/mp4', 'video/webm'].includes(file.type)) {
      setMessage('Formato de vídeo inválido — use MP4 ou WebM');
      return;
    }
    setMessage('');
    setSavedOk(false);
    if (mediaPreviewUrl.startsWith('blob:')) URL.revokeObjectURL(mediaPreviewUrl);
    setMediaFile(file);
    setMediaPreviewType(isVideo ? 'video' : 'image');
    setMediaPreviewUrl(URL.createObjectURL(file));
  };

  const handleMediaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    applyMediaFile(file);
    e.target.value = '';
  };

  async function save() {
    setMessage('');
    if (isNew && !mediaFile) {
      setMessage('Selecione uma imagem ou vídeo de fundo para criar o vestiário');
      return;
    }
    if (mediaFile) {
      const isVideo = mediaFile.type.startsWith('video/');
      const maxBytes = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
      if (mediaFile.size > maxBytes) {
        setMessage(isVideo
          ? `Vídeo muito grande (máx. ${MAX_VIDEO_BYTES / (1024 * 1024)} MB)`
          : `Imagem muito grande (máx. ${MAX_IMAGE_BYTES / (1024 * 1024)} MB)`);
        return;
      }
    }

    setSubmitting(true);
    try {
      if (isNew) {
        const fd = new FormData();
        fd.set('name', name);
        fd.set('slots', JSON.stringify(slots));
        fd.set('image', mediaFile!);
        await adminClient.post('/vestiario-templates', fd);
      } else if (mediaFile) {
        const fd = new FormData();
        fd.set('name', name);
        fd.set('slots', JSON.stringify(slots));
        fd.set('image', mediaFile);
        await adminClient.patch(`/vestiario-templates/${initial!.id}`, fd);
      } else {
        await adminClient.patch(`/vestiario-templates/${initial!.id}`, { name, slots });
      }
      setMessage(isNew ? 'Vestiário criado com sucesso' : 'Vestiário salvo com sucesso');
      setSavedOk(true);
      onSaved();
    } catch (err) {
      setSavedOk(false);
      const axiosErr = err as AxiosError<{ error?: { code?: string; details?: unknown } }>;
      const status = axiosErr.response?.status;
      const details = axiosErr.response?.data?.error?.details as { reason?: string } | undefined;
      if (status === 401) {
        setMessage('Sessão expirada — faça login novamente');
      } else if (status === 413 || details?.reason === 'file_too_large') {
        setMessage('Arquivo muito grande (imagem 5 MB · vídeo 20 MB)');
      } else if (details?.reason === 'unsupported_mime') {
        setMessage('Formato inválido — use PNG, JPEG, WebP, MP4 ou WebM');
      } else if (!axiosErr.response) {
        setMessage('Falha de rede — tente novamente');
      } else {
        setMessage(`Erro ao salvar (${status ?? 'desconhecido'})`);
      }
    } finally {
      setSubmitting(false);
    }
  }

  const slotsByRole = ROLE_ORDER.map((role) => ({
    role,
    items: slots.filter((s) => roleOf(s) === role),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="space-y-4 pb-8">
      {/* ── Sticky header ── */}
      <div className="sticky top-0 z-30 -mx-4 px-4 py-3 bg-[#070e1a]/95 backdrop-blur border-b border-white/[0.06]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {onCancel && (
              <button type="button" onClick={onCancel} className="text-slate-500 hover:text-slate-300 transition-colors shrink-0">
                <i className="bi bi-arrow-left text-sm" />
              </button>
            )}
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-widest text-slate-500">{isNew ? 'Novo vestiário' : 'Editar vestiário'}</p>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={64}
                className="text-base font-semibold text-slate-100 bg-transparent border-none outline-none w-full truncate placeholder:text-slate-600"
                placeholder="Nome do vestiário"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            {message && (
              <p className={`text-xs max-w-xs ${savedOk ? 'text-emerald-400' : 'text-amber-300'}`}>
                {savedOk ? <><i className="bi bi-check-circle mr-1" />{message}</> : message}
              </p>
            )}
            <button
              type="button"
              onClick={() => void save()}
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 border border-emerald-500/50 disabled:opacity-50 px-4 py-2 text-sm font-medium transition-colors"
            >
              <i className={`bi ${submitting ? 'bi-hourglass-split' : 'bi-cloud-upload'}`} />
              {submitting ? 'Salvando…' : isNew ? 'Criar vestiário' : 'Salvar vestiário'}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_292px] gap-4">
        {/* ── Canvas column ── */}
        <div className="space-y-3">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setAddMode((v) => !v)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                addMode
                  ? 'border-cyan-500/40 bg-cyan-500/15 text-cyan-300'
                  : 'border-white/[0.08] bg-white/[0.04] text-slate-400 hover:text-slate-200'
              }`}
            >
              <i className={`bi ${addMode ? 'bi-cursor-fill' : 'bi-cursor'}`} aria-hidden />
              {addMode ? 'Modo adicionar ON' : 'Modo adicionar'}
            </button>
            <button
              type="button"
              onClick={removeSelected}
              disabled={!selectedId}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-300 hover:bg-red-500/15 disabled:opacity-30 transition-colors"
            >
              <i className="bi bi-trash" aria-hidden />
              Remover
            </button>
            <label className="ml-auto inline-flex items-center gap-2 text-xs text-slate-400 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={snapGrid}
                onChange={(e) => setSnapGrid(e.target.checked)}
                className="rounded border-white/20 accent-emerald-500"
              />
              Snap {SNAP_PCT}%
            </label>
          </div>

          {/* Canvas */}
          <div
            ref={canvasRef}
            className={`relative w-full select-none overflow-hidden rounded-xl shadow-2xl shadow-black/60 transition-colors ${
              addMode
                ? 'cursor-crosshair ring-2 ring-cyan-500/30 ring-offset-1 ring-offset-transparent'
                : 'cursor-default'
            } border border-white/[0.07]`}
            style={{ aspectRatio: mediaAspect?.url === mediaPreviewUrl ? mediaAspect.ratio : 2 }}
            onClick={handleCanvasClick}
            role="presentation"
          >
            <div className="absolute inset-0 bg-[#060d14]" />
            {mediaPreviewUrl ? (
              <StadiumBackgroundMedia
                url={mediaPreviewUrl}
                onAspectRatioChange={(ratio) => setMediaAspect({ url: mediaPreviewUrl, ratio })}
                backgroundType={mediaPreviewType}
                alt="Campo do vestiário"
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-600">
                <i className="bi bi-image text-5xl opacity-20" aria-hidden />
                <p className="text-sm opacity-50">Envie uma imagem ou vídeo de fundo</p>
              </div>
            )}
            {slots.map((slot, idx) => {
              const isSelected = slot.id === selectedId;
              const role = roleOf(slot);
              const style = ROLE_STYLE[role];
              return (
                <div
                  key={slot.id}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 touch-none select-none ${isSelected ? 'z-20' : 'z-10'}`}
                  style={{ left: `${slot.xPct}%`, top: `${slot.yPct}%`, zIndex: slot.zIndex ?? idx + 1 }}
                  onPointerDown={(e) => handleMarkerPointerDown(e, slot.id)}
                  onPointerMove={handleMarkerPointerMove}
                  onPointerUp={handleMarkerPointerUp}
                  onPointerCancel={handleMarkerPointerUp}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className={`flex flex-col items-center gap-0.5 transition-transform ${isSelected ? 'scale-115' : 'scale-100'}`}>
                    <span className={`flex h-9 w-9 items-center justify-center rounded-full text-base border-2 shadow-lg ${style.bg} ${isSelected ? `ring-2 ring-offset-1 ring-offset-transparent ${style.ring}` : ''}`}>
                      <i className={`bi ${ROLE_EMOJI[role]}`} aria-hidden />
                    </span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md shadow-sm ${style.bg} ${style.text}`}>
                      {slot.label}
                    </span>
                  </div>
                </div>
              );
            })}
            {/* Add mode hint */}
            {addMode && (
              <div className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2">
                <span className="rounded-full bg-cyan-500/20 border border-cyan-500/30 px-3 py-1 text-[10px] text-cyan-300 backdrop-blur-sm">
                  Clique no campo para adicionar um slot
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ── Sidebar ── */}
        <aside className="space-y-3">
          {/* Background upload */}
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">
            <div className="flex items-center gap-2 border-b border-white/[0.06] px-3 py-2.5">
              <i className="bi bi-image text-xs text-slate-400" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Fundo</h3>
            </div>
            <div className="p-3 space-y-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,video/mp4,video/webm"
                onChange={handleMediaChange}
                className="sr-only"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const file = e.dataTransfer.files?.[0];
                  if (file) applyMediaFile(file);
                }}
                className="w-full rounded-lg border border-dashed border-white/[0.10] bg-white/[0.02] p-3 text-left hover:border-white/20 hover:bg-white/[0.04] transition-colors"
              >
                {mediaPreviewUrl ? (
                  <div className="flex items-center gap-3">
                    {mediaPreviewType === 'video' ? (
                      <video src={mediaPreviewUrl} className="h-12 w-16 shrink-0 rounded-lg object-cover bg-black/30" muted loop autoPlay playsInline />
                    ) : (
                      <img src={mediaPreviewUrl} alt="" className="h-12 w-16 shrink-0 rounded-lg object-cover bg-black/30" />
                    )}
                    <div className="min-w-0">
                      <p className="text-xs text-slate-300 truncate">
                        {mediaFile?.name ?? (mediaPreviewType === 'video' ? 'Vídeo atual' : 'Imagem atual')}
                      </p>
                      <p className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1">
                        <i className="bi bi-arrow-repeat" /> Clique ou arraste para trocar
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1.5 py-3">
                    <i className="bi bi-cloud-upload text-xl text-slate-600" />
                    <p className="text-xs text-slate-500">PNG, JPEG, WebP ou MP4/WebM</p>
                  </div>
                )}
              </button>
              <p className="text-[10px] text-slate-600 leading-snug">
                Vídeos rodam em loop silencioso. Use clipes curtos e comprimidos.
              </p>
            </div>
          </div>

          {/* Selected slot editor */}
          {selected ? (
            <div className={`rounded-xl border overflow-hidden transition-colors ${ROLE_STYLE[roleOf(selected)].bg.replace('border-', 'border-').replace('/60', '/30')} border-opacity-40`}
              style={{ borderColor: roleOf(selected) === 'GK' ? 'rgba(251,191,36,0.25)' : roleOf(selected) === 'DEF' ? 'rgba(56,189,248,0.25)' : roleOf(selected) === 'MID' ? 'rgba(52,211,153,0.25)' : 'rgba(251,113,133,0.25)' }}
            >
              <div className="flex items-center gap-2 border-b border-white/[0.06] px-3 py-2.5">
                <i className={`bi ${ROLE_EMOJI[roleOf(selected)]} text-base`} aria-hidden />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Slot selecionado</h3>
                <button type="button" onClick={() => setSelectedId(null)} className="ml-auto text-slate-600 hover:text-slate-400">
                  <i className="bi bi-x" />
                </button>
              </div>
              <div className="p-3 space-y-2">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Label</p>
                  <input
                    value={selected.label}
                    onChange={(e) => updateSlot(selected.id, { label: e.target.value })}
                    className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-slate-100 focus:border-emerald-500/40 focus:outline-none"
                    maxLength={32}
                  />
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Função</p>
                  <select
                    value={selected.role ?? 'MID'}
                    onChange={(e) => updateSlot(selected.id, { role: e.target.value as StadiumSlotRole })}
                    className="w-full rounded-lg border border-white/[0.08] bg-[#0c1220] px-3 py-2 text-sm text-slate-200 focus:border-emerald-500/40 focus:outline-none"
                  >
                    {STADIUM_SLOT_ROLES.map((r) => (
                      <option key={r} value={r}>{ROLE_LABEL[r]} ({r})</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-600 border-t border-white/[0.04] pt-2 mt-1">
                  <span>X: {selected.xPct.toFixed(1)}% · Y: {selected.yPct.toFixed(1)}%</span>
                  <button
                    type="button"
                    onClick={removeSelected}
                    className="text-red-400 hover:text-red-300 flex items-center gap-1"
                  >
                    <i className="bi bi-trash text-[11px]" /> Remover
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-white/[0.05] bg-white/[0.01] px-3 py-4 text-center text-xs text-slate-600">
              <i className="bi bi-hand-index text-base block mb-1 opacity-40" />
              Clique em um slot no campo para editá-lo
            </div>
          )}

          {/* Slot list */}
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">
            <div className="flex items-center justify-between border-b border-white/[0.06] px-3 py-2.5">
              <div className="flex items-center gap-2">
                <i className="bi bi-grid-3x3 text-xs text-slate-400" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Posições</h3>
              </div>
              <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2 py-0.5 text-[10px] font-bold text-slate-400">
                {slots.length}
              </span>
            </div>
            <div className="p-2 space-y-2 max-h-72 overflow-y-auto">
              {slotsByRole.length === 0 ? (
                <p className="text-[11px] text-slate-600 text-center py-3">Nenhuma posição adicionada</p>
              ) : slotsByRole.map(({ role, items }) => {
                const rs = ROLE_STYLE[role];
                return (
                  <div key={role}>
                    <div className="flex items-center gap-1.5 px-1 mb-1">
                      <span className={`h-1 w-1 rounded-full ${rs.dot}`} />
                      <p className={`text-[10px] font-semibold uppercase tracking-wider ${rs.text}`}>
                        {ROLE_LABEL[role]} ({items.length})
                      </p>
                    </div>
                    <ul className="space-y-0.5">
                      {items.map((slot) => (
                        <li key={slot.id}>
                          <button
                            type="button"
                            onClick={() => setSelectedId(slot.id)}
                            className={`w-full text-left rounded-lg px-2.5 py-1.5 text-xs transition-colors flex items-center gap-2 ${
                              slot.id === selectedId
                                ? `${rs.bg} ${rs.text} font-semibold`
                                : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200'
                            }`}
                          >
                            <i className={`bi ${ROLE_EMOJI[role]} text-[11px]`} aria-hidden />
                            {slot.label}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>
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

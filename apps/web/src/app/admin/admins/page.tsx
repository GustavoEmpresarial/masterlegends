import { useEffect, useState } from 'react';
import { AdminPermission, type AdminListItemDTO, type AdminPermissionType } from '@mll/shared';
import { adminClient } from '../../../lib/api/adminClient';
import { AdminButton, AdminPageHeader } from '../../../components/admin/AdminTable';

const PERMISSION_LABELS: Record<AdminPermissionType, string> = {
  [AdminPermission.VIEW_USERS]: 'Ver usuários',
  [AdminPermission.MANAGE_USERS]: 'Gerenciar usuários',
  [AdminPermission.VIEW_REPORTS]: 'Ver relatórios',
  [AdminPermission.MANAGE_WITHDRAWALS]: 'Gerenciar saques',
  [AdminPermission.MANAGE_WALLET_CONFIG]: 'Configurar carteira',
  [AdminPermission.MANAGE_ANNOUNCEMENTS]: 'Gerenciar anúncios',
  [AdminPermission.MANAGE_SUPPORT]: 'Gerenciar suporte',
  [AdminPermission.MANAGE_ITEMS]: 'Gerenciar itens',
  [AdminPermission.MANAGE_STADIUMS]: 'Gerenciar estádios',
  [AdminPermission.MANAGE_PASS]: 'Gerenciar passe',
  [AdminPermission.MANAGE_EVENTS]: 'Gerenciar eventos',
  [AdminPermission.MANAGE_SOCIAL]: 'Gerenciar social',
  [AdminPermission.VIEW_REFERRALS]: 'Ver indicações',
  [AdminPermission.MANAGE_PLATFORM]: 'Gerenciar plataforma',
  [AdminPermission.VIEW_AUDIT]: 'Ver auditoria',
  [AdminPermission.VIEW_BULL_BOARD]: 'Ver fila de jobs',
};

const PERMISSION_ICONS: Record<AdminPermissionType, string> = {
  [AdminPermission.VIEW_USERS]: 'bi-people',
  [AdminPermission.MANAGE_USERS]: 'bi-person-gear',
  [AdminPermission.VIEW_REPORTS]: 'bi-bar-chart',
  [AdminPermission.MANAGE_WITHDRAWALS]: 'bi-cash-stack',
  [AdminPermission.MANAGE_WALLET_CONFIG]: 'bi-wallet2',
  [AdminPermission.MANAGE_ANNOUNCEMENTS]: 'bi-megaphone',
  [AdminPermission.MANAGE_SUPPORT]: 'bi-chat-dots',
  [AdminPermission.MANAGE_ITEMS]: 'bi-box-seam',
  [AdminPermission.MANAGE_STADIUMS]: 'bi-buildings',
  [AdminPermission.MANAGE_PASS]: 'bi-ticket-perforated',
  [AdminPermission.MANAGE_EVENTS]: 'bi-calendar-event',
  [AdminPermission.MANAGE_SOCIAL]: 'bi-share',
  [AdminPermission.VIEW_REFERRALS]: 'bi-diagram-3',
  [AdminPermission.MANAGE_PLATFORM]: 'bi-sliders',
  [AdminPermission.VIEW_AUDIT]: 'bi-shield-check',
  [AdminPermission.VIEW_BULL_BOARD]: 'bi-list-task',
};

const ALL_PERMISSIONS = Object.values(AdminPermission) as AdminPermissionType[];

function RoleBadge({ role }: { role: string }) {
  if (role === 'super') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-bold text-amber-300">
        <i className="bi bi-star-fill text-[8px]" /> SUPER
      </span>
    );
  }
  if (role === 'ops') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-blue-500/30 bg-blue-500/10 px-2.5 py-0.5 text-[10px] font-bold text-blue-300">
        <i className="bi bi-wrench text-[8px]" /> OPS
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[10px] font-bold text-slate-300">
      {role.toUpperCase()}
    </span>
  );
}

export function AdminAdminsPage() {
  const [admins, setAdmins] = useState<AdminListItemDTO[]>([]);
  const [selected, setSelected] = useState<AdminListItemDTO | null>(null);
  const [editPerms, setEditPerms] = useState<Set<AdminPermissionType>>(new Set());
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState<string | null>(null);

  useEffect(() => {
    void adminClient
      .get<AdminListItemDTO[]>('/admins')
      .then((r) => setAdmins(r.data))
      .finally(() => setLoading(false));
  }, []);

  function openEdit(admin: AdminListItemDTO) {
    setSelected(admin);
    const current = admin.permissionConfig?.permissions ?? [];
    setEditPerms(new Set(current));
    setSaveError('');
  }

  function closeEdit() {
    setSelected(null);
    setSaveError('');
  }

  function togglePerm(p: AdminPermissionType) {
    setEditPerms((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  }

  async function savePerms() {
    if (!selected) return;
    setSaving(true);
    setSaveError('');
    try {
      await adminClient.put(`/admins/${selected.id}/permissions`, {
        permissions: [...editPerms],
      });
      setAdmins((prev) =>
        prev.map((a) =>
          a.id === selected.id
            ? {
                ...a,
                permissionConfig: {
                  adminId: a.id,
                  permissions: [...editPerms],
                  updatedBy: null,
                  updatedAt: new Date().toISOString(),
                },
              }
            : a,
        ),
      );
      closeEdit();
    } catch {
      setSaveError('Erro ao salvar. Tente novamente.');
    } finally {
      setSaving(false);
    }
  }

  async function resetPerms(adminId: string) {
    setResetting(adminId);
    try {
      await adminClient.delete(`/admins/${adminId}/permissions`);
      setAdmins((prev) =>
        prev.map((a) => (a.id === adminId ? { ...a, permissionConfig: null } : a)),
      );
      if (selected?.id === adminId) closeEdit();
    } finally {
      setResetting(null);
    }
  }

  const supers = admins.filter((a) => a.role === 'super');
  const ops = admins.filter((a) => a.role !== 'super');

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-slate-500 py-10">
        <i className="bi bi-arrow-repeat animate-spin" />
        <span className="text-sm">Carregando admins…</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Admins"
        subtitle={`${admins.length} administradores · ${supers.length} super · ${ops.length} ops`}
      />

      {/* Super admins */}
      <div className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-400/60 px-1">
          Super Admins · Acesso Total
        </p>
        <div className="admin-card divide-y divide-white/[0.04] p-0 overflow-hidden">
          {supers.map((a) => (
            <div key={a.id} className="flex items-center gap-4 px-5 py-3.5">
              <div className="h-8 w-8 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                <i className="bi bi-star-fill text-xs text-amber-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-100 truncate">{a.login}</p>
                <p className="text-xs text-slate-500 truncate">{a.email}</p>
              </div>
              <RoleBadge role={a.role} />
              <span className="text-xs text-amber-400/60 hidden sm:inline">Acesso total</span>
              <div className="w-5 h-5 rounded-full bg-amber-400/10 flex items-center justify-center" title="Protegido">
                <i className="bi bi-lock-fill text-[9px] text-amber-400/50" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Ops admins */}
      {ops.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-blue-400/60 px-1">
            Ops Admins · Permissões Configuráveis
          </p>
          <div className="admin-card divide-y divide-white/[0.04] p-0 overflow-hidden">
            {ops.map((a) => {
              const configured = a.permissionConfig != null;
              const permCount = a.permissionConfig?.permissions.length ?? 0;
              return (
                <div key={a.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-white/[0.015] transition-colors">
                  <div className="h-8 w-8 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                    <i className="bi bi-person-fill text-xs text-blue-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-100 truncate">{a.login}</p>
                    <p className="text-xs text-slate-500 truncate">{a.email}</p>
                  </div>
                  <RoleBadge role={a.role} />
                  <div className="hidden sm:flex items-center gap-1.5 shrink-0">
                    {configured ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] text-emerald-400">
                        <i className="bi bi-check2-circle text-[9px]" />
                        {permCount} permissões
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-600">Padrão da role</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <AdminButton size="sm" onClick={() => openEdit(a)}>
                      <i className="bi bi-sliders text-xs" /> Editar
                    </AdminButton>
                    {configured && (
                      <AdminButton
                        size="sm"
                        variant="ghost"
                        onClick={() => void resetPerms(a.id)}
                        disabled={resetting === a.id}
                      >
                        {resetting === a.id
                          ? <i className="bi bi-arrow-repeat animate-spin text-xs" />
                          : <><i className="bi bi-arrow-counterclockwise text-xs" /> Reset</>
                        }
                      </AdminButton>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Edit modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-xl rounded-2xl border border-white/[0.08] bg-[#0a1020] shadow-2xl">
            {/* Modal header */}
            <div className="flex items-center gap-3 border-b border-white/[0.06] px-5 py-4">
              <div className="h-9 w-9 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                <i className="bi bi-person-fill text-sm text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{selected.login}</p>
                <p className="text-xs text-slate-400 truncate">{selected.email}</p>
              </div>
              <RoleBadge role={selected.role} />
              <button
                type="button"
                onClick={closeEdit}
                className="ml-2 text-slate-500 hover:text-white transition-colors"
              >
                <i className="bi bi-x-lg text-sm" />
              </button>
            </div>

            {/* Permission grid */}
            <div className="px-5 py-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs text-slate-500">
                  Permissões customizadas para este admin.{' '}
                  <span className="text-slate-400">Deixe vazio para usar o padrão da role <strong>{selected.role}</strong>.</span>
                </p>
                <div className="flex items-center gap-2 shrink-0 ml-3">
                  <button
                    type="button"
                    onClick={() => setEditPerms(new Set(ALL_PERMISSIONS))}
                    className="text-[10px] text-emerald-400 hover:text-emerald-300 transition-colors"
                  >
                    Marcar todos
                  </button>
                  <span className="text-slate-700">·</span>
                  <button
                    type="button"
                    onClick={() => setEditPerms(new Set())}
                    className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    Limpar
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-1 sm:grid-cols-2 max-h-[50vh] overflow-y-auto pr-1">
                {ALL_PERMISSIONS.map((p) => {
                  const checked = editPerms.has(p);
                  return (
                    <label
                      key={p}
                      className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2.5 transition-colors ${
                        checked
                          ? 'border-emerald-500/30 bg-emerald-500/[0.07]'
                          : 'border-white/[0.04] bg-white/[0.02] hover:bg-white/[0.04]'
                      }`}
                    >
                      <div className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                        checked
                          ? 'border-emerald-500 bg-emerald-500'
                          : 'border-white/20 bg-transparent'
                      }`}>
                        {checked && <i className="bi bi-check text-[10px] text-black font-bold" />}
                      </div>
                      <i className={`bi ${PERMISSION_ICONS[p]} text-xs ${checked ? 'text-emerald-400' : 'text-slate-500'} shrink-0`} />
                      <span className={`text-xs ${checked ? 'text-slate-100' : 'text-slate-400'}`}>
                        {PERMISSION_LABELS[p]}
                      </span>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => togglePerm(p)}
                        className="sr-only"
                      />
                    </label>
                  );
                })}
              </div>

              {saveError && (
                <p className="mt-3 flex items-center gap-1.5 text-xs text-red-400">
                  <i className="bi bi-exclamation-circle" /> {saveError}
                </p>
              )}
            </div>

            {/* Modal footer */}
            <div className="flex items-center justify-between border-t border-white/[0.06] px-5 py-3">
              <p className="text-[10px] text-slate-600">
                {editPerms.size} de {ALL_PERMISSIONS.length} permissões selecionadas
              </p>
              <div className="flex gap-2">
                <AdminButton variant="ghost" onClick={closeEdit}>
                  Cancelar
                </AdminButton>
                <AdminButton onClick={() => void savePerms()} disabled={saving}>
                  {saving ? (
                    <><i className="bi bi-arrow-repeat animate-spin text-xs" /> Salvando…</>
                  ) : (
                    <><i className="bi bi-check2 text-xs" /> Salvar permissões</>
                  )}
                </AdminButton>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useCallback, useEffect, useState } from 'react';
import type { WarehouseItemDTO, AdminWarehouseGrantInputDTO } from '@mll/shared';
import { WarehouseItemType } from '@mll/shared';
import { adminClient } from '../../../lib/api/adminClient';
import {
  AdminBadge,
  AdminButton,
  AdminModal,
  AdminPageHeader,
  AdminTable,
} from '../../../components/admin/AdminTable';
import { adminPt, formatAdminDate } from '../../../lib/admin/i18n';

const sourceLabel: Record<string, string> = {
  marketplace: 'Mercado',
  quest_reward: 'Task',
  checkin: 'Check-in',
  admin: 'Admin',
  offerwall: 'Offerwall',
};

const typeLabel: Record<string, string> = {
  player_card: 'Carta',
  temp_player: 'Jog. Temp.',
  stamina_boost: 'Stamina',
  gmt_pack: 'GMT Pack',
  scout_ticket: 'Scout Ticket',
  overwall_boost: 'Overwall Boost',
  consumable: 'Consumível',
};

const rarityNames = ['Comum', 'Raro', 'SR', 'Épico', 'Lendário'];

function shortId(id: string) {
  return id.slice(0, 8);
}

export function AdminWarehousePage() {
  const [userId, setUserId] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [items, setItems] = useState<WarehouseItemDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [grantModal, setGrantModal] = useState(false);
  const [grantForm, setGrantForm] = useState<AdminWarehouseGrantInputDTO>({
    userId: '',
    itemType: 'player_card',
    name: '',
    rarity: 0,
    quantity: 1,
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    if (!userId.trim()) return;
    setLoading(true);
    try {
      const { data } = await adminClient.get<WarehouseItemDTO[]>(
        `/warehouse/user/${userId.trim()}`,
      );
      setItems(data);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (userId.trim()) void load();
  }, [load, userId]);

  function applySearch() {
    setUserId(searchInput.trim());
  }

  async function handleGrant() {
    if (!grantForm.userId || !grantForm.name || !grantForm.itemType) return;
    setBusy(true);
    setMessage('');
    try {
      const { data } = await adminClient.post<WarehouseItemDTO>('/warehouse/grant', grantForm);
      setMessage(`Item "${data.name}" concedido ao usuário ${data.userId.slice(0, 8)}`);
      setGrantModal(false);
    } catch (err: unknown) {
      setMessage(`Erro: ${err instanceof Error ? err.message : 'unknown'}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(itemId: string) {
    if (!userId.trim() || !confirm('Remover este item do almoxarifado?')) return;
    try {
      await adminClient.delete(`/warehouse/${itemId}/user/${userId.trim()}`);
      await load();
    } catch (err: unknown) {
      alert(`Erro: ${err instanceof Error ? err.message : 'unknown'}`);
    }
  }

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Almoxarifado"
        subtitle="Itens pendentes de resgate por usuário"
        actions={
          <AdminButton size="sm" variant="secondary" onClick={() => setGrantModal(true)}>
            <i className="bi bi-plus-lg" /> Conceder Item
          </AdminButton>
        }
      />

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-[10px] text-slate-500 uppercase tracking-wide mb-1">
            ID do Usuário
          </label>
          <div className="flex gap-2">
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && applySearch()}
              placeholder="UUID do usuário..."
              className="flex-1 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:border-emerald-500/40 focus:outline-none"
            />
            <AdminButton size="sm" variant="primary" onClick={applySearch}>
              <i className="bi bi-search" />
            </AdminButton>
          </div>
        </div>
      </div>

      {message && (
        <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-300">
          {message}
        </div>
      )}

      <AdminTable
        loading={loading}
        rows={items}
        rowKey={(r) => r.id}
        columns={[
          {
            key: 'item',
            header: 'Item',
            render: (r) => (
              <div>
                <div className="text-sm text-slate-200 font-medium">{r.name || r.itemType}</div>
                <div className="text-[10px] text-slate-500">
                  {typeLabel[r.itemType] ?? r.itemType} · {shortId(r.id)}
                </div>
              </div>
            ),
          },
          {
            key: 'source',
            header: 'Origem',
            render: (r) => (
              <AdminBadge variant={r.source === 'marketplace' ? 'info' : r.source === 'admin' ? 'success' : 'default'}>
                {sourceLabel[r.source] ?? r.source}
              </AdminBadge>
            ),
          },
          {
            key: 'rarity',
            header: 'Raridade',
            render: (r) => (
              <span className={`text-xs ${
                r.rarity >= 4 ? 'text-amber-300' :
                r.rarity >= 3 ? 'text-purple-300' :
                r.rarity >= 2 ? 'text-blue-300' :
                r.rarity >= 1 ? 'text-emerald-300' : 'text-slate-400'
              }`}>
                {rarityNames[r.rarity] ?? `R${r.rarity}`}
              </span>
            ),
          },
          {
            key: 'qty',
            header: 'Qtd',
            render: (r) => (
              <span className="text-sm text-slate-300">{r.quantity}</span>
            ),
          },
          {
            key: 'status',
            header: 'Status',
            render: (r) => (
              <AdminBadge variant={r.claimed ? 'success' : 'warning'}>
                {r.claimed ? 'Resgatado' : 'Pendente'}
              </AdminBadge>
            ),
          },
          {
            key: 'date',
            header: 'Data',
            render: (r) => (
              <span className="text-xs text-slate-400">{formatAdminDate(r.createdAt)}</span>
            ),
          },
          {
            key: 'actions',
            header: adminPt.actions,
            render: (r) => (
              <AdminButton
                size="sm"
                variant="danger"
                onClick={() => handleDelete(r.id)}
              >
                <i className="bi bi-trash text-xs" />
              </AdminButton>
            ),
          },
        ]}
      />

      <AdminModal
        open={grantModal}
        title="Conceder Item ao Almoxarifado"
        onClose={() => setGrantModal(false)}
        footer={
          <>
            <AdminButton variant="ghost" onClick={() => setGrantModal(false)} disabled={busy}>
              Cancelar
            </AdminButton>
            <AdminButton variant="secondary" onClick={() => handleGrant()} disabled={busy}>
              {busy ? 'Concedendo...' : 'Conceder'}
            </AdminButton>
          </>
        }
      >
        <div className="space-y-4">
          <label className="block space-y-2">
            <span className="text-sm text-slate-300">ID do Usuário *</span>
            <input
              value={grantForm.userId}
              onChange={(e) => setGrantForm({ ...grantForm, userId: e.target.value })}
              placeholder="UUID"
              className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-slate-100"
            />
          </label>
          <label className="block space-y-2">
            <span className="text-sm text-slate-300">Tipo do Item *</span>
            <select
              value={grantForm.itemType}
              onChange={(e) => setGrantForm({ ...grantForm, itemType: e.target.value })}
              className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-slate-100"
            >
              {Object.entries(typeLabel).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <label className="block space-y-2">
            <span className="text-sm text-slate-300">Nome *</span>
            <input
              value={grantForm.name}
              onChange={(e) => setGrantForm({ ...grantForm, name: e.target.value })}
              placeholder="Nome do item"
              className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-slate-100"
            />
          </label>
          <label className="block space-y-2">
            <span className="text-sm text-slate-300">Descrição</span>
            <input
              value={grantForm.description ?? ''}
              onChange={(e) => setGrantForm({ ...grantForm, description: e.target.value })}
              placeholder="Opcional"
              className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-slate-100"
            />
          </label>
          <label className="block space-y-2">
            <span className="text-sm text-slate-300">Raridade (0-4)</span>
            <select
              value={grantForm.rarity ?? 0}
              onChange={(e) => setGrantForm({ ...grantForm, rarity: Number(e.target.value) })}
              className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-slate-100"
            >
              {rarityNames.map((name, i) => (
                <option key={i} value={i}>{name} ({i})</option>
              ))}
            </select>
          </label>
          <label className="block space-y-2">
            <span className="text-sm text-slate-300">Quantidade</span>
            <input
              type="number"
              min={1}
              value={grantForm.quantity ?? 1}
              onChange={(e) => setGrantForm({ ...grantForm, quantity: Number(e.target.value) })}
              className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-slate-100"
            />
          </label>
          <label className="block space-y-2">
            <span className="text-sm text-slate-300">URL da Imagem</span>
            <input
              value={grantForm.imageUrl ?? ''}
              onChange={(e) => setGrantForm({ ...grantForm, imageUrl: e.target.value })}
              placeholder="Opcional"
              className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-slate-100"
            />
          </label>
        </div>
      </AdminModal>
    </div>
  );
}

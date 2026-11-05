/** Conta desativada pelo admin — bloqueio longo distinto do lock por tentativas de login. */
export const ADMIN_DISABLE_LOCK_UNTIL = new Date('2099-01-01T00:00:00.000Z');

export function isAdminDisabled(lockedUntil: Date | null | undefined): boolean {
  return !!lockedUntil && lockedUntil.getTime() >= ADMIN_DISABLE_LOCK_UNTIL.getTime();
}

const RARITY_NAMES = ['Common', 'Uncommon', 'Rare', 'Super Rare', 'Epic', 'Legendary'] as const;
const POSITION_NAMES = ['GK', 'DEF', 'MID', 'FW', 'LAT'] as const;

export function rarityLabel(rarity: number): string {
  return RARITY_NAMES[rarity] ?? `R${rarity}`;
}

export function positionLabel(position: number): string {
  return POSITION_NAMES[position] ?? `P${position}`;
}

const MGT_TX_LABELS: Record<string, string> = {
  starter: 'Bônus inicial USDC',
  farm: 'Cota de patrocínio',
  scout: 'Scout de atleta',
  marketplace_buy: 'Compra no marketplace',
  marketplace_sell: 'Venda no marketplace',
  upgrade: 'Upgrade de edifício',
  pass_claim: 'Recompensa do passe',
  pass_premium: 'Compra do passe premium',
  referral: 'Comissão de indicação',
  admin_adjust: 'Ajuste manual (admin)',
  mining_claim: 'Cota de patrocínio',
  usdc_deposit: 'Depósito USDC',
  usdc_withdraw: 'Saque USDC',
  merge: 'Fusão de jogadores',
  office_hire: 'Contratação de staff',
  office_fee: 'Taxa de staff',
  coach_fee: 'Taxa do treinador',
  stadium_shop: 'Compra na lojinha',
  stadium_license: 'Licença de campo',
  gear_shop: 'Compra de equipamento',
  boneco: 'Personalização de jogador',
  swap_usdc_to_gmt: 'Swap USDC → GMT',
  swap_usdt_to_gmt: 'Swap USDT → GMT',
  swap_gmt_to_usdc: 'Swap GMT → USDC',
};

const WALLET_TX_LABELS: Record<string, string> = {
  usdc_deposit: 'Depósito USDC on-chain',
  usdc_withdraw: 'Saque USDC on-chain',
  mining_claim: 'Cota de patrocínio',
};

const AUDIT_LABELS: Record<string, string> = {
  login_success: 'Login realizado',
  login_failed: 'Tentativa de login falhou',
  account_locked: 'Conta bloqueada por tentativas',
  password_reset_requested: 'Pedido de reset de senha',
  password_reset_completed: 'Senha redefinida pelo usuário',
  email_verified: 'E-mail verificado',
  refresh_reuse_detected: 'Reuso de token de sessão detectado',
  logout: 'Logout',
  wallet_linked: 'Carteira conectada',
  wallet_unlinked: 'Carteira desconectada',
  user_banned: 'Conta banida (admin)',
  user_unbanned: 'Banimento removido (admin)',
  withdrawal_approved: 'Saque aprovado (admin)',
  withdrawal_rejected: 'Saque rejeitado (admin)',
  password_changed: 'Senha alterada',
  username_changed: 'Nick alterado',
  admin_password_reset: 'Senha redefinida pelo admin',
  user_deactivated: 'Conta desativada (admin)',
  user_reactivated: 'Conta reativada (admin)',
};

function formatMetaDetail(meta: unknown): string | null {
  if (!meta || typeof meta !== 'object') return null;
  const m = meta as Record<string, unknown>;
  const parts: string[] = [];
  if (m.building) parts.push(`Edifício: ${String(m.building)}`);
  if (m.newLevel != null) parts.push(`Nível ${String(m.newLevel)}`);
  if (m.quantity != null) parts.push(`Qtd: ${String(m.quantity)}`);
  if (m.level != null) parts.push(`Passe nível ${String(m.level)}`);
  if (m.sourceAmount != null) parts.push(`Base: ${String(m.sourceAmount)} USDC`);
  if (m.referredId) parts.push(`Indicado: ${String(m.referredId).slice(0, 8)}…`);
  if (m.reason) parts.push(`Motivo: ${String(m.reason)}`);
  if (m.adminLogin) parts.push(`Admin: ${String(m.adminLogin)}`);
  if (m.txHash) parts.push(`Tx: ${String(m.txHash).slice(0, 10)}…`);
  if (m.wallet) parts.push(`Carteira: ${String(m.wallet)}`);
  return parts.length > 0 ? parts.join(' · ') : null;
}

export function formatMgtActivity(row: {
  id: string;
  type: string;
  amount: { toString(): string };
  meta: unknown;
  createdAt: Date;
}) {
  const amount = Number(row.amount);
  const sign = amount >= 0 ? '+' : '';
  return {
    id: `mgt-${row.id}`,
    source: 'balance' as const,
    label: MGT_TX_LABELS[row.type] ?? `Saldo: ${row.type}`,
    txType: row.type,
    detail: formatMetaDetail(row.meta),
    amount,
    amountLabel: `${sign}${amount.toFixed(2)} USDC`,
    createdAt: row.createdAt.toISOString(),
  };
}

export function formatWalletActivity(row: {
  id: string;
  type: string;
  amount: { toString(): string };
  txHash: string;
  status: string;
  createdAt: Date;
}) {
  const amount = Number(row.amount);
  return {
    id: `wal-${row.id}`,
    source: 'wallet' as const,
    label: WALLET_TX_LABELS[row.type] ?? row.type,
    detail: `Tx ${row.txHash.slice(0, 10)}… · ${row.status}`,
    amount,
    amountLabel: `${amount >= 0 ? '+' : ''}${amount.toFixed(2)} USDC`,
    createdAt: row.createdAt.toISOString(),
  };
}

export function formatAuditActivity(row: {
  id: string;
  action: string;
  meta: unknown;
  createdAt: Date;
}) {
  return {
    id: `aud-${row.id}`,
    source: 'security' as const,
    label: AUDIT_LABELS[row.action] ?? row.action,
    detail: formatMetaDetail(row.meta),
    amount: null,
    amountLabel: null,
    createdAt: row.createdAt.toISOString(),
  };
}

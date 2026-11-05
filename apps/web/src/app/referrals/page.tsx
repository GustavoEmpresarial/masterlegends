import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../../hooks/useAuth';
import { apiClient } from '../../lib/api/client';
import { PageContentShell } from '../../components/content';
import { formatStableAmount } from '../../lib/formatUsdc';

interface ReferralDetail {
  referredId: string;
  username: string;
  joinedAt: string;
  referredAt: string;
  totalEarnedUsdc: number;
  depositCount: number;
  totalDepositedUsdc: number;
}

interface ReferralCommissionRow {
  id: string;
  createdAt: string;
  referredId: string;
  username: string | null;
  purchaseRef: string | null;
  grossAmount: number;
  commissionAmount: number;
  currency?: string;
  status: string;
  reason: string | null;
}

interface ReferralDetails {
  bonusPct: number;
  totalReferrals: number;
  totalEarnedUsdc: number;
  totalDepositedUsdc: number;
  referrals: ReferralDetail[];
  commissions: ReferralCommissionRow[];
}

const STATUS_LABEL: Record<string, string> = {
  credited: 'creditada',
  rejected: 'recusada',
  reversed: 'estornada',
};

export function ReferralsPage() {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);
  const [details, setDetails] = useState<ReferralDetails | null>(null);
  const [loading, setLoading] = useState(true);

  const referralCode = user?.referralCode ?? '--------';
  const referralLink = `${window.location.origin}/register?ref=${referralCode}`;

  useEffect(() => {
    apiClient.get<ReferralDetails>('/api/referrals/details')
      .then((r) => setDetails(r.data))
      .catch(() => setDetails({ bonusPct: 0.05, totalReferrals: 0, totalEarnedUsdc: 0, totalDepositedUsdc: 0, referrals: [], commissions: [] }))
      .finally(() => setLoading(false));
  }, []);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <PageContentShell>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
        <h1 className="pixel-text text-xl sm:text-2xl md:text-3xl" style={{ color: 'var(--pink)' }}>
          <i className="bi bi-people-fill" aria-hidden /> Indicações
        </h1>
        <p className="retro-text text-lg mt-2" style={{ color: 'var(--text-secondary)' }}>
          Indique amigos e ganhe {Math.round((details?.bonusPct ?? 0.05) * 1000) / 10}% de cada depósito USDC deles, pago em USDT sacável
        </p>
      </motion.div>

      {/* Como funciona */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="pixel-card p-6 sm:p-8"
        style={{ borderColor: 'var(--green)' }}
      >
        <h2 className="pixel-text text-xl mb-5" style={{ color: 'var(--green)' }}>
          <i className="bi bi-gift-fill" aria-hidden /> Como funciona sua recompensa
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="pixel-box p-6">
            <div className="text-3xl mb-3"><i className="bi bi-cash-stack" aria-hidden /></div>
            <p className="pixel-text text-base mb-2" style={{ color: 'var(--gold)' }}>{Math.round((details?.bonusPct ?? 0.05) * 1000) / 10}% de cada depósito</p>
            <p className="retro-text text-lg" style={{ color: 'var(--text-primary)' }}>
              A cada depósito USDC confirmado do indicado, você recebe essa porcentagem em USDT sacável na carteira.
            </p>
          </div>
          <div className="pixel-box p-6" style={{ borderColor: 'var(--purple)' }}>
            <div className="text-3xl mb-3"><i className="bi bi-shield-fill" aria-hidden /></div>
            <p className="pixel-text text-base mb-2" style={{ color: 'var(--purple)' }}>Jogador 100 Overall — 30 dias</p>
            <p className="retro-text text-lg" style={{ color: 'var(--text-primary)' }}>
              Você também recebe um jogador especial temporário com 100 de Overall, válido por 30 dias após escalar.
            </p>
          </div>
        </div>
      </motion.div>

      {/* Link */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="pixel-card p-6 sm:p-8"
        style={{ borderColor: 'var(--green)' }}
      >
        <h2 className="pixel-text text-xl mb-5" style={{ color: 'var(--green)' }}>
          <i className="bi bi-link-45deg" aria-hidden /> Seu link de indicação
        </h2>

        <div className="pixel-box p-5 mb-5">
          <div className="retro-text text-lg break-all" style={{ color: 'var(--text-primary)' }}>
            {referralLink}
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 pixel-box p-5">
            <div className="pixel-text text-sm mb-2" style={{ color: 'var(--text-muted)' }}>Código</div>
            <div className="pixel-text text-3xl" style={{ color: 'var(--gold)' }}>{referralCode}</div>
          </div>
          <motion.button
            onClick={() => handleCopy(referralLink)}
            className="pixel-btn pixel-btn-green pixel-btn-md flex items-center justify-center gap-2"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            {copied ? <><span><i className="bi bi-check-lg" aria-hidden /></span> Copiado!</> : <><span><i className="bi bi-clipboard-fill" aria-hidden /></span> Copiar link</>}
          </motion.button>
        </div>
      </motion.div>

      {/* Stats */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="grid grid-cols-3 gap-4"
      >
        {[
          { label: 'Indicados', value: loading ? '…' : (details?.totalReferrals ?? 0), icon: 'bi-people-fill', color: 'var(--blue)' },
          { label: 'Comissão ganha', value: loading ? '…' : `${(details?.totalEarnedUsdc ?? 0).toFixed(2)} USDT`, icon: 'bi-cash-stack', color: 'var(--gold)' },
          { label: 'Total depositado', value: loading ? '…' : `$${(details?.totalDepositedUsdc ?? 0).toFixed(2)}`, icon: 'bi-bar-chart-fill', color: 'var(--green)' },
        ].map((stat) => (
          <motion.div
            key={stat.label}
            className="pixel-box p-6 sm:p-8 text-center"
            style={{ borderColor: stat.color }}
            whileHover={{ scale: 1.05, y: -4 }}
          >
            <div className="text-4xl mb-3"><i className={`bi ${stat.icon}`} aria-hidden /></div>
            <div className="pixel-text text-2xl sm:text-3xl" style={{ color: stat.color }}>{stat.value}</div>
            <div className="retro-text text-base mt-2" style={{ color: 'var(--text-muted)' }}>{stat.label}</div>
          </motion.div>
        ))}
      </motion.div>

      {/* Histórico */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="pixel-card p-6 sm:p-8"
        style={{ borderColor: 'var(--blue)' }}
      >
        <h2 className="pixel-text text-xl mb-5" style={{ color: 'var(--blue)' }}>
          <i className="bi bi-clipboard-fill" aria-hidden /> Histórico de indicados
        </h2>

        {loading ? (
          <p className="retro-text text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>Carregando…</p>
        ) : !details?.referrals.length ? (
          <div className="pixel-box p-6 text-center">
            <p className="text-3xl mb-3"><i className="bi bi-person-fill" aria-hidden /></p>
            <p className="retro-text text-base" style={{ color: 'var(--text-primary)' }}>Você ainda não indicou ninguém.</p>
            <p className="retro-text text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Compartilhe seu link e comece a ganhar!</p>
          </div>
        ) : (
          <>
            {/* Mobile */}
            <div className="space-y-3 md:hidden">
              {details.referrals.map((r) => (
                <div key={r.referredId} className="pixel-box p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="pixel-text text-sm" style={{ color: 'var(--text-primary)' }}>@{r.username}</span>
                    <span className="retro-text text-xs" style={{ color: 'var(--text-muted)' }}>
                      {new Date(r.referredAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 border-t pt-3" style={{ borderColor: 'var(--bg-lighter)' }}>
                    <div className="text-center">
                      <p className="retro-text text-xs" style={{ color: 'var(--text-muted)' }}>Depósitos</p>
                      <p className="pixel-text text-sm" style={{ color: 'var(--text-primary)' }}>{r.depositCount}</p>
                    </div>
                    <div className="text-center">
                      <p className="retro-text text-xs" style={{ color: 'var(--text-muted)' }}>Depositado</p>
                      <p className="pixel-text text-sm" style={{ color: 'var(--text-primary)' }}>${r.totalDepositedUsdc.toFixed(2)}</p>
                    </div>
                    <div className="text-center">
                      <p className="retro-text text-xs" style={{ color: 'var(--text-muted)' }}>Comissão</p>
                      <p className="pixel-text text-sm" style={{ color: 'var(--green)' }}>${r.totalEarnedUsdc.toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop */}
            <div className="hidden md:block pixel-table-wrap">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b-2" style={{ borderColor: 'var(--bg-lighter)' }}>
                    <th className="ui-label-sm py-3 pr-4" style={{ color: 'var(--text-secondary)' }}>Usuário</th>
                    <th className="ui-label-sm py-3 pr-4" style={{ color: 'var(--text-secondary)' }}>Entrou em</th>
                    <th className="ui-label-sm py-3 pr-4 text-right" style={{ color: 'var(--text-secondary)' }}>Depósitos</th>
                    <th className="ui-label-sm py-3 pr-4 text-right" style={{ color: 'var(--text-secondary)' }}>Total depositado</th>
                    <th className="ui-label-sm py-3 text-right" style={{ color: 'var(--text-secondary)' }}>Sua comissão</th>
                  </tr>
                </thead>
                <tbody>
                  {details.referrals.map((r) => (
                    <tr key={r.referredId} className="border-b" style={{ borderColor: 'var(--bg-dark)' }}>
                      <td className="pixel-text py-3 pr-4 text-sm" style={{ color: 'var(--text-primary)' }}>@{r.username}</td>
                      <td className="retro-text py-3 pr-4 text-sm" style={{ color: 'var(--text-primary)' }}>
                        {new Date(r.referredAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="retro-text py-3 pr-4 text-sm text-right" style={{ color: 'var(--text-primary)' }}>{r.depositCount}</td>
                      <td className="retro-text py-3 pr-4 text-sm text-right" style={{ color: 'var(--text-primary)' }}>${r.totalDepositedUsdc.toFixed(2)}</td>
                      <td className="retro-text py-3 text-sm text-right font-bold" style={{ color: 'var(--green)' }}>${r.totalEarnedUsdc.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2" style={{ borderColor: 'var(--bg-lighter)' }}>
                    <td colSpan={3} className="ui-label-sm py-3 pr-4" style={{ color: 'var(--text-muted)' }}>TOTAL</td>
                    <td className="pixel-text py-3 pr-4 text-sm text-right" style={{ color: 'var(--text-primary)' }}>${details.totalDepositedUsdc.toFixed(2)}</td>
                    <td className="pixel-text py-3 text-sm text-right" style={{ color: 'var(--green)' }}>${details.totalEarnedUsdc.toFixed(2)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="pixel-card p-6 sm:p-8"
        style={{ borderColor: 'var(--gold)' }}
      >
        <h2 className="pixel-text text-xl mb-5" style={{ color: 'var(--gold)' }}>
          <i className="bi bi-receipt" aria-hidden /> Histórico de comissões
        </h2>
        {loading ? (
          <p className="retro-text text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>Carregando…</p>
        ) : !details?.commissions.length ? (
          <p className="retro-text text-base text-center" style={{ color: 'var(--text-muted)' }}>Nenhuma comissão ainda.</p>
        ) : (
          <div className="pixel-table-wrap">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b-2" style={{ borderColor: 'var(--bg-lighter)' }}>
                  <th className="ui-label-sm py-3 pr-4">Data</th>
                  <th className="ui-label-sm py-3 pr-4">Indicado</th>
                  <th className="ui-label-sm py-3 pr-4 text-right">Depósito</th>
                  <th className="ui-label-sm py-3 pr-4 text-right">Comissão</th>
                  <th className="ui-label-sm py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {details.commissions.map((row) => (
                  <tr key={row.id} className="border-b" style={{ borderColor: 'var(--bg-dark)' }}>
                    <td className="retro-text py-3 pr-4 text-sm">
                      {new Date(row.createdAt).toLocaleString('pt-BR')}
                    </td>
                    <td className="pixel-text py-3 pr-4 text-sm">@{row.username ?? row.referredId.slice(0, 8)}</td>
                    <td className="retro-text py-3 pr-4 text-sm text-right">{formatStableAmount(row.grossAmount)} USDC</td>
                    <td className="retro-text py-3 pr-4 text-sm text-right" style={{ color: 'var(--green)' }}>
                      {formatStableAmount(row.commissionAmount)} {(row.currency ?? 'usdt').toUpperCase()}
                    </td>
                    <td className="retro-text py-3 text-sm">{STATUS_LABEL[row.status] ?? row.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>
    </PageContentShell>
  );
}

import { useEffect, useState, useCallback } from 'react';
import { fetchPublicJson } from '../../lib/api/publicFetch';
import { MarkdownBody, PageContentShell, PageHero } from '../../components/content';

const POLYGONSCAN_TX = 'https://polygonscan.com/tx/';
const DEFAULT_VAULT = '0x967659a8Fe5C15728eD900eF9a90c44bE20190f3';

interface TransparencySection {
  id: string;
  title: string;
  body: string;
  imageUrl: string | null;
  order: number;
  updatedAt: string;
}

interface Deposit {
  amountUsdc: number;
  txHash: string;
  blockNumber: number | null;
  confirmedAt: string;
}

interface DepositsPage {
  deposits: Deposit[];
  total: number;
  page: number;
  pages: number;
}

interface PublicStats {
  flow: {
    depositCount: number;
    totalDepositedUsdc: number;
    withdrawalCount: number;
    totalWithdrawnUsdc: number;
    referralCommissionCount: number;
    totalReferralCommissionsGmt: number;
    totalReferralCommissionsUsdc?: number;
  };
  vault: {
    address: string | null;
    usdcBalance: number | null;
    chainId: number;
    usdcToken: string | null;
  };
  allocation: Array<{ label: string; pct: number; color?: string }>;
  generatedAt: string;
}

interface FinancialRecord {
  id: string;
  type: 'receita' | 'despesa';
  label: string;
  description: string | null;
  amount: number;
  currency: string;
  recurring: boolean;
  recurringPeriod: string | null;
  source: string | null;
  referenceUrl: string | null;
  date: string;
}

interface FinancialSummary {
  totalReceita: number;
  totalDespesa: number;
  lucroLiquido: number;
  total: number;
}

function fmtCurrency(amount: number, currency: string) {
  const c = currency.toUpperCase();
  if (c === 'USDC' || c === 'USD') return fmtUsdc(amount);
  if (c === 'BRL') return `R$ ${amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  return `${amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} ${c}`;
}

function FinancialRecordsPanel({
  records,
  summary,
}: {
  records: FinancialRecord[];
  summary: FinancialSummary;
}) {
  if (records.length === 0) return null;

  return (
    <div className="pixel-card pixel-card-fluid overflow-hidden p-0" style={{ borderColor: 'var(--gold)' }}>
      <div className="px-4 sm:px-6 py-4 border-b-4" style={{ borderColor: 'var(--bg-lighter)' }}>
        <h2 className="pixel-text text-sm sm:text-base" style={{ color: 'var(--gold)' }}>Relatório Financeiro</h2>
        <p className="retro-text text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          Lançamentos públicos registrados pela equipe MLL
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-px" style={{ background: 'var(--bg-lighter)' }}>
        {[
          { label: 'Receitas', value: summary.totalReceita, color: 'var(--green)' },
          { label: 'Despesas', value: summary.totalDespesa, color: 'var(--red)' },
          { label: 'Saldo', value: summary.lucroLiquido, color: 'var(--blue)' },
        ].map(({ label, value, color }) => (
          <div key={label} className="pixel-box-light px-4 py-3" style={{ borderColor: 'var(--bg-lighter)' }}>
            <p className="ui-label-sm" style={{ color: 'var(--text-muted)' }}>{label}</p>
            <p className="retro-text text-lg font-bold mt-1" style={{ color }}>{fmtUsdc(value)}</p>
          </div>
        ))}
      </div>

      <div className="divide-y" style={{ borderColor: 'var(--bg-lighter)' }}>
        {records.map((r) => (
          <div key={r.id} className="px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="min-w-0">
              <p className="retro-text text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{r.label}</p>
              {r.description && (
                <p className="retro-text text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{r.description}</p>
              )}
              <p className="retro-text text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                {new Date(r.date).toLocaleDateString('pt-BR')}
                {r.recurring ? ` · ${r.recurringPeriod === 'yearly' ? 'anual' : 'mensal'}` : ''}
                {r.source ? ` · ${r.source}` : ''}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p
                className="retro-text font-bold text-base"
                style={{ color: r.type === 'receita' ? 'var(--green)' : 'var(--red)' }}
              >
                {r.type === 'receita' ? '+' : '−'}{fmtCurrency(r.amount, r.currency)}
              </p>
              {r.referenceUrl && (
                <a
                  href={r.referenceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="retro-text text-xs"
                  style={{ color: 'var(--green)' }}
                >
                  comprovante ↗
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function fmtUsdc(val: number) {
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(2)}M`;
  if (val >= 1_000) return `$${(val / 1_000).toFixed(2)}K`;
  return `$${val.toFixed(2)}`;
}

interface Slice { label: string; pct: number; color: string }

function AllocationPanel({ slices }: { slices: Slice[] }) {
  if (slices.length === 0) return null;
  return (
    <div className="pixel-card pixel-card-fluid" style={{ borderTopColor: 'var(--purple)' }}>
      <h2 className="pixel-text text-sm sm:text-base mb-4" style={{ color: 'var(--purple)' }}>Alocação de Receitas</h2>
      <div className="space-y-3">
        {slices.map((s) => (
          <div key={s.label}>
            <div className="flex items-center justify-between gap-3 mb-1">
              <span className="retro-text text-sm min-w-0" style={{ color: 'var(--text-primary)' }}>{s.label}</span>
              <span className="retro-text text-sm font-bold shrink-0 tabular-nums" style={{ color: s.color }}>
                {s.pct.toFixed(1)}%
              </span>
            </div>
            <div className="h-2.5 w-full overflow-hidden" style={{ background: 'rgba(0,0,0,0.35)', borderRadius: 4 }}>
              <div style={{ width: `${Math.max(0, Math.min(100, s.pct))}%`, height: '100%', background: s.color }} />
            </div>
          </div>
        ))}
      </div>
      <p className="retro-text text-xs mt-4" style={{ color: 'var(--text-muted)' }}>
        Baseado nas taxas configuradas na plataforma.
      </p>
    </div>
  );
}

function StatTile({
  label,
  value,
  sub,
  color,
  icon,
}: {
  label: string;
  value: string;
  sub: string;
  color: string;
  icon: string;
}) {
  return (
    <div className="pixel-card pixel-card-fluid" style={{ borderTopColor: color }}>
      <div className="flex items-start justify-between gap-3">
        <p className="ui-label-sm" style={{ color: 'var(--text-muted)' }}>{label}</p>
        <i className={`bi ${icon} text-lg`} style={{ color }} aria-hidden />
      </div>
      <p className="pixel-text text-xl sm:text-2xl mt-2" style={{ color }}>{value}</p>
      <p className="retro-text text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>{sub}</p>
    </div>
  );
}

/* ── Vault card (on-chain via API) ─────────────────────────── */
function WalletCard({
  vault,
  ledgerDepositedUsdc,
}: {
  vault: PublicStats['vault'];
  ledgerDepositedUsdc?: number;
}) {
  const address = vault.address ?? DEFAULT_VAULT;
  const debankProfile = `https://debank.com/profile/${address}`;
  const scanUrl = `https://polygonscan.com/address/${address}#tokentxns`;
  const onChain = vault.usdcBalance;
  const [copied, setCopied] = useState(false);

  const copyAddress = () => {
    navigator.clipboard?.writeText(address).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    }).catch(() => null);
  };

  return (
    <div className="pixel-card pixel-card-fluid" style={{ borderTopColor: 'var(--green)' }}>
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: 'var(--green)' }} />
            <span className="ui-label-sm" style={{ color: 'var(--text-muted)' }}>
              Cofre oficial · Polygon {vault.chainId}
            </span>
          </div>
          <p className="ui-label-sm" style={{ color: 'var(--text-muted)' }}>Saldo USDC on-chain</p>
          <p className="pixel-text text-3xl sm:text-4xl mt-1" style={{ color: 'var(--green)' }}>
            {onChain != null ? fmtUsdc(onChain) : '—'}
          </p>
          <p className="retro-text text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            {onChain != null
              ? 'USDC nativo + USDC.e · via RPC Polygon'
              : 'Saldo on-chain indisponível no momento.'}
          </p>
          {ledgerDepositedUsdc != null && ledgerDepositedUsdc > 0 && (
            <p className="retro-text text-sm mt-3" style={{ color: 'var(--text-secondary)' }}>
              Creditado na plataforma: <strong style={{ color: 'var(--green)' }}>{fmtUsdc(ledgerDepositedUsdc)}</strong>
            </p>
          )}
        </div>

        <div className="flex flex-col gap-3 min-w-0 lg:w-[28rem] lg:max-w-full">
          <div
            className="flex items-center gap-2 min-w-0 px-3 py-2"
            style={{ background: 'rgba(0,0,0,0.35)', border: '2px solid var(--bg-lighter)', borderRadius: 10 }}
          >
            <span className="retro-text text-xs font-mono truncate flex-1" title={address} style={{ color: 'var(--text-secondary)' }}>
              {address}
            </span>
            <button
              type="button"
              onClick={copyAddress}
              className="retro-text text-xs font-bold shrink-0 px-2 py-1"
              style={{
                color: copied ? 'var(--gold)' : 'var(--green)',
                border: '2px solid currentColor',
                borderRadius: 8,
              }}
            >
              {copied ? 'Copiado' : 'Copiar'}
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href={debankProfile} target="_blank" rel="noreferrer" className="pixel-btn pixel-btn-green pixel-btn-sm">
              <i className="bi bi-bar-chart-fill" />
              DeBank
            </a>
            <a href={scanUrl} target="_blank" rel="noreferrer" className="pixel-btn pixel-btn-blue pixel-btn-sm">
              <i className="bi bi-box-arrow-up-right" />
              PolygonScan
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Deposits table ─────────────────────────────────────────── */
function DepositsTable({ vaultAddress }: { vaultAddress: string }) {
  const [data, setData] = useState<DepositsPage | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const load = useCallback((p: number) => {
    setLoading(true);
    fetchPublicJson<DepositsPage>(`/api/transparencia/deposits?page=${p}`)
      .then((d) => { setData(d); setPage(p); })
      .catch(() => null)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(1); }, [load]);

  return (
    <div className="pixel-card pixel-card-fluid overflow-hidden p-0" style={{ borderColor: 'var(--blue)' }}>
      <div
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 sm:px-6 py-4 border-b-4"
        style={{ borderColor: 'var(--bg-lighter)' }}
      >
        <div>
          <h2 className="pixel-text text-sm sm:text-base" style={{ color: 'var(--blue)' }}>Depósitos Confirmados</h2>
          {data && (
            <p className="retro-text text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              {data.total} transações on-chain
            </p>
          )}
        </div>
        <a
          href={`https://polygonscan.com/address/${vaultAddress}#tokentxns`}
          target="_blank"
          rel="noreferrer"
          className="retro-text text-sm"
          style={{ color: 'var(--green)' }}
        >
          <i className="bi bi-box-arrow-up-right" />
          Ver no PolygonScan
        </a>
      </div>

      {loading ? (
        <div className="divide-y divide-slate-700/50">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="px-6 sm:px-8 py-4 flex gap-4 items-center animate-pulse">
              <div className="h-4 w-24 bg-slate-700 rounded" />
              <div className="h-4 flex-1 bg-slate-700 rounded" />
              <div className="h-4 w-20 bg-slate-700 rounded" />
            </div>
          ))}
        </div>
      ) : !data || data.deposits.length === 0 ? (
        <div className="text-center py-8 retro-text" style={{ color: 'var(--text-muted)' }}>
          <i className="bi bi-inbox text-2xl block mb-2" />
          <p>Nenhum depósito registrado ainda.</p>
        </div>
      ) : (
        <>
          <div className="divide-y sm:hidden" style={{ borderColor: 'var(--bg-lighter)' }}>
            {data.deposits.map((d) => (
              <div key={d.txHash} className="px-4 py-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="retro-text text-lg font-bold" style={{ color: 'var(--green)' }}>
                    +{d.amountUsdc.toFixed(2)} USDC
                  </span>
                  <span className="retro-text text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {new Date(d.confirmedAt).toLocaleDateString('pt-BR')}
                  </span>
                </div>
                <a
                  href={`${POLYGONSCAN_TX}${d.txHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="retro-text text-xs font-mono break-all"
                  style={{ color: 'var(--green)' }}
                >
                  {d.txHash.slice(0, 14)}…{d.txHash.slice(-6)}
                </a>
                {d.blockNumber && (
                  <p className="retro-text text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                    Bloco #{d.blockNumber.toLocaleString()}
                  </p>
                )}
              </div>
            ))}
          </div>

          <div className="pixel-table-wrap hidden sm:block">
            <table className="w-full min-w-[640px]">
              <thead className="pixel-box-light" style={{ borderColor: 'var(--bg-lighter)' }}>
                <tr className="ui-label-sm" style={{ color: 'var(--text-muted)' }}>
                  <th className="text-left px-6 py-3">Data / Hora</th>
                  <th className="text-left px-4 py-3">Tx Hash</th>
                  <th className="text-left px-4 py-3">Bloco</th>
                  <th className="text-right px-6 py-3">Valor</th>
                </tr>
              </thead>
              <tbody>
                {data.deposits.map((d) => (
                  <tr key={d.txHash} style={{ borderTop: '2px solid var(--bg-lighter)' }}>
                    <td className="px-6 py-3 retro-text text-sm whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>
                      {new Date(d.confirmedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td className="px-4 py-3">
                      <a
                        href={`${POLYGONSCAN_TX}${d.txHash}`}
                        target="_blank"
                        rel="noreferrer"
                        className="retro-text text-xs font-mono"
                        style={{ color: 'var(--green)' }}
                      >
                        {d.txHash.slice(0, 16)}…{d.txHash.slice(-6)}
                      </a>
                    </td>
                    <td className="px-4 py-3 retro-text text-sm font-mono" style={{ color: 'var(--text-muted)' }}>
                      {d.blockNumber ? `#${d.blockNumber.toLocaleString()}` : '—'}
                    </td>
                    <td className="px-6 py-3 text-right retro-text font-bold whitespace-nowrap" style={{ color: 'var(--green)' }}>
                      +{d.amountUsdc.toFixed(2)} USDC
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {data.pages > 1 && (
            <div
              className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 sm:px-6 py-4 border-t-4"
              style={{ borderColor: 'var(--bg-lighter)' }}
            >
              <span className="retro-text text-sm" style={{ color: 'var(--text-secondary)' }}>
                Página {page} de {data.pages}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => load(page - 1)}
                  className="pixel-btn pixel-btn-sm disabled:opacity-30"
                  style={{ background: 'var(--bg-light)', color: 'var(--text-secondary)' }}
                >
                  ← Anterior
                </button>
                <button
                  type="button"
                  disabled={page >= data.pages}
                  onClick={() => load(page + 1)}
                  className="pixel-btn pixel-btn-sm disabled:opacity-30"
                  style={{ background: 'var(--bg-light)', color: 'var(--text-secondary)' }}
                >
                  Próxima →
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ReportList({ sections }: { sections: TransparencySection[] }) {
  const [openId, setOpenId] = useState<string | null>(sections[0]?.id ?? null);

  return (
    <div className="pixel-card-stack">
      <h2 className="pixel-text text-sm sm:text-base" style={{ color: 'var(--green)' }}>Relatórios & Comunicados</h2>
      {sections.map((section) => {
        const open = openId === section.id;
        const updated = new Date(section.updatedAt).toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        });
        return (
          <article key={section.id} className="pixel-card pixel-card-fluid overflow-hidden" style={{ borderTopColor: 'var(--green)', padding: 0 }}>
            <button
              type="button"
              className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left"
              aria-expanded={open}
              onClick={() => setOpenId(open ? null : section.id)}
            >
              <span className="min-w-0">
                <span className="pixel-text text-sm sm:text-base block" style={{ color: 'var(--text-primary)' }}>
                  {section.title}
                </span>
                <span className="retro-text text-xs mt-1 block" style={{ color: 'var(--text-muted)' }}>{updated}</span>
              </span>
              <i className={`bi ${open ? 'bi-chevron-up' : 'bi-chevron-down'} shrink-0`} style={{ color: 'var(--green)' }} aria-hidden />
            </button>
            {open && (
              <div className="transparency-md px-4 py-4 border-t-2" style={{ borderColor: 'var(--bg-lighter)' }}>
                {section.imageUrl && (
                  <img src={section.imageUrl} alt="" className="w-full max-h-56 object-cover mb-4" style={{ borderRadius: 8 }} />
                )}
                <MarkdownBody markdown={section.body} />
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}

/* ── Main page ──────────────────────────────────────────────── */
export function TransparencyPage() {
  const [sections, setSections] = useState<TransparencySection[]>([]);
  const [stats, setStats] = useState<PublicStats | null>(null);
  const [financialRecords, setFinancialRecords] = useState<FinancialRecord[]>([]);
  const [financialSummary, setFinancialSummary] = useState<FinancialSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchPublicJson<{ sections: TransparencySection[] }>('/api/transparencia'),
      fetchPublicJson<PublicStats>('/api/transparencia/stats').catch(() => null),
      fetchPublicJson<{ records: FinancialRecord[]; summary: FinancialSummary }>(
        '/api/transparencia/financial-records',
      ).catch(() => null),
    ]).then(([data, statsData, financialData]) => {
      if (cancelled) return;
      setSections(data.sections);
      if (statsData) setStats(statsData);
      if (financialData) {
        setFinancialRecords(financialData.records);
        setFinancialSummary(financialData.summary);
      }
    }).catch((err: unknown) => {
      if (!cancelled) setError(err instanceof Error ? err.message : 'Erro ao carregar');
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const vaultAddress = stats?.vault?.address ?? DEFAULT_VAULT;

  const allocationSlices: Slice[] = (stats?.allocation ?? []).map((s) => ({
    label: s.label,
    pct: s.pct,
    color: s.color ?? '#22c55e',
  }));

  return (
    <PageContentShell>
      <PageHero
        title="Portal de Transparência"
        titleColor="var(--green)"
        subtitle="Informações públicas sobre operações e finanças do Master Legends League — verificáveis on-chain."
      />

      {error && (
        <div className="pixel-card pixel-card-fluid p-4" style={{ borderColor: 'var(--red)' }}>
          <p className="retro-text text-sm" style={{ color: 'var(--red)' }}>{error}</p>
        </div>
      )}

      {/* Wallet card (DeBank) */}
      <WalletCard
        vault={stats?.vault ?? { address: DEFAULT_VAULT, usdcBalance: null, chainId: 137, usdcToken: null }}
        ledgerDepositedUsdc={stats?.flow?.totalDepositedUsdc}
      />

      {stats && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full min-w-0">
            <StatTile
              label="Depositado"
              value={fmtUsdc(stats.flow.totalDepositedUsdc)}
              sub={`${stats.flow.depositCount} depósitos confirmados`}
              color="#22c55e"
              icon="bi-arrow-down-circle-fill"
            />
            <StatTile
              label="Sacado"
              value={fmtUsdc(stats.flow.totalWithdrawnUsdc)}
              sub={stats.flow.totalDepositedUsdc > 0
                ? `${((stats.flow.totalWithdrawnUsdc / stats.flow.totalDepositedUsdc) * 100).toFixed(1)}% do depositado · ${stats.flow.withdrawalCount} saques`
                : `${stats.flow.withdrawalCount} saques processados`}
              color="#f87171"
              icon="bi-arrow-up-circle-fill"
            />
            <StatTile
              label="Indicações"
              value={`${(stats.flow.totalReferralCommissionsGmt ?? stats.flow.totalReferralCommissionsUsdc ?? 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} GMT`}
              sub={`${stats.flow.referralCommissionCount} comissões in-game`}
              color="#a78bfa"
              icon="bi-people-fill"
            />
          </div>
          <AllocationPanel slices={allocationSlices} />
        </>
      )}

      {/* Deposits table */}
      <DepositsTable vaultAddress={vaultAddress} />

      {financialSummary && financialRecords.length > 0 && (
        <FinancialRecordsPanel records={financialRecords} summary={financialSummary} />
      )}

      {/* CMS sections */}
      {loading && sections.length === 0 ? (
        <div className="pixel-card-stack">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="pixel-card pixel-card-fluid h-48 animate-pulse" style={{ background: 'var(--bg-light)' }} />
          ))}
        </div>
      ) : sections.length > 0 ? (
        <ReportList sections={sections} />
      ) : null}

      {stats && (
        <p className="text-center retro-text text-xs" style={{ color: 'var(--text-muted)' }}>
          Dados gerados em {new Date(stats.generatedAt).toLocaleString('pt-BR')}
        </p>
      )}
    </PageContentShell>
  );
}

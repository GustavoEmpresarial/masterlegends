import { motion } from 'framer-motion';
import { useOfferwallRewards, useZeradsPtcLink, useZeradsPtcStats } from '../../hooks/useApi';
import { PageContentShell } from '../../components/content';

function statCard(label: string, value: string, color: string) {
  return (
    <div className="pixel-card p-3 text-center">
      <p className="ui-label-sm" style={{ color: 'var(--text-muted)' }}>
        {label}
      </p>
      <p className="retro-text text-xl" style={{ color }}>
        {value}
      </p>
    </div>
  );
}

export function OfferwallPage() {
  const { data: link, isLoading: linkLoading } = useZeradsPtcLink();
  const { data: stats, isLoading: statsLoading } = useZeradsPtcStats();
  const { data: rewards } = useOfferwallRewards();

  return (
    <PageContentShell>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="pixel-text text-xl sm:text-2xl md:text-3xl" style={{ color: 'var(--cyan)' }}>
          <i className="bi bi-gift-fill" aria-hidden /> Zerads
        </h1>
        <p className="retro-text text-lg mt-1" style={{ color: 'var(--text-secondary)' }}>
          Clique nos anúncios PTC e ganhe Overwall temporário no seu clube.
        </p>
      </motion.div>

      <div className="pixel-card flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <p className="ui-label-sm" style={{ color: 'var(--text-muted)' }}>
            Overwall ativo (bônus PTC)
          </p>
          <p className="retro-text text-2xl" style={{ color: 'var(--green)' }}>
            {(stats?.activeOverwall ?? 0).toLocaleString('pt-BR')}
          </p>
        </div>
        {!linkLoading && link?.enabled && link.url ? (
          <a
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="pixel-btn pixel-btn-green pixel-btn-md"
          >
            <i className="bi bi-rocket-takeoff-fill" aria-hidden /> Clicar e ganhar
          </a>
        ) : (
          <span
            className="pixel-badge"
            style={{ borderColor: 'var(--text-muted)', color: 'var(--text-muted)' }}
          >
            Ofertas em breve
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {statCard('Overwall hoje', (stats?.todayOverwall ?? 0).toLocaleString('pt-BR'), 'var(--green)')}
        {statCard('Cliques hoje', String(stats?.todayClicks ?? 0), 'var(--cyan)')}
        {statCard(
          'Overwall total',
          (stats?.lifetimeOverwall ?? 0).toLocaleString('pt-BR'),
          'var(--gold)',
        )}
        {statCard('Cliques totais', String(stats?.lifetimeClicks ?? 0), 'var(--text-secondary)')}
      </div>

      <div>
        <h2 className="retro-text text-lg mb-2" style={{ color: 'var(--text-secondary)' }}>
          Últimos 14 dias
        </h2>
        {statsLoading ? (
          <div className="pixel-card text-center py-8">
            <p className="retro-text" style={{ color: 'var(--text-muted)' }}>
              Carregando...
            </p>
          </div>
        ) : (
          <div className="pixel-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ color: 'var(--text-muted)' }}>
                  <th className="text-left ui-label-sm py-1 pr-3">Dia</th>
                  <th className="text-right ui-label-sm py-1 pr-3">Overwall</th>
                  <th className="text-right ui-label-sm py-1 pr-3">ZER</th>
                  <th className="text-right ui-label-sm py-1">Cliques</th>
                </tr>
              </thead>
              <tbody>
                {(stats?.daily ?? []).map((d) => (
                  <tr key={d.day} style={{ color: 'var(--text-primary)' }}>
                    <td className="retro-text py-1 pr-3">
                      {new Date(`${d.day}T00:00:00Z`).toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                        timeZone: 'UTC',
                      })}
                    </td>
                    <td className="retro-text text-right py-1 pr-3" style={{ color: 'var(--green)' }}>
                      {d.overwall > 0 ? `+${d.overwall.toLocaleString('pt-BR')}` : '—'}
                    </td>
                    <td className="retro-text text-right py-1 pr-3" style={{ color: 'var(--text-muted)' }}>
                      {d.zer > 0 ? d.zer.toLocaleString('pt-BR') : '—'}
                    </td>
                    <td className="retro-text text-right py-1">{d.clicks || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {(rewards ?? []).length > 0 && (
        <div>
          <h2 className="retro-text text-lg mb-2" style={{ color: 'var(--text-secondary)' }}>
            Outras recompensas de ofertas
          </h2>
          <div className="flex flex-col gap-2">
            {(rewards ?? []).map((r) => (
              <div
                key={r.id}
                className="pixel-box p-3 flex items-center justify-between gap-3"
                style={{ borderColor: 'var(--green)' }}
              >
                <p className="retro-text" style={{ color: 'var(--text-primary)' }}>
                  +{r.amount} {r.currency}
                </p>
                <p className="ui-label-sm" style={{ color: 'var(--text-muted)' }}>
                  {new Date(r.createdAt).toLocaleString('pt-BR')}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </PageContentShell>
  );
}

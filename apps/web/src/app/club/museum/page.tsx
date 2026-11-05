import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { apiClient } from '../../../lib/api/client';
import { resolveUploadUrl } from '../../../lib/resolveUploadUrl';
import { PageContentShell } from '../../../components/content';

interface Trophy {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  wonAt: string;
  createdAt: string;
}

interface RetiredPlayer {
  id: string;
  name: string | null;
  rarity: string;
  overwall: number;
  position: string;
  imageUrl: string | null;
  source: string;
  fieldedAt: string | null;
  retiredAt: string;
  costBasisUsdc?: number;
  lifetimeEarnedUsdc?: number;
  age?: number;
  retireAge?: number;
  roiPct?: number;
  hasCareerCycle?: boolean;
}

interface ClubInfo {
  name: string;
  trophyRoomLvl: number;
  createdAt: string;
  lifetimeEarnedUsdc: string;
}

interface StadiumEvolution {
  id: string;
  name: string;
  imageUrl: string | null;
  sortOrder: number;
  farmBonusPct: number;
  isCurrent: boolean;
  priceUsdc?: number | null;
  isFree?: boolean;
  licenseStatus?: string | null;
}

interface MuseumData {
  trophies: Trophy[];
  retiredPlayers: RetiredPlayer[];
  clubInfo: ClubInfo | null;
  stadiums: StadiumEvolution[];
}

const RARITY_COLORS: Record<string, string> = {
  common: '#cccccc',
  rare: 'var(--blue)',
  'super-rare': 'var(--green)',
  epic: '#a855f7',
  legendary: 'var(--gold)',
};

const RARITY_LABELS: Record<string, string> = {
  common: 'Comum',
  rare: 'Raro',
  'super-rare': 'Super Raro',
  epic: 'Épico',
  legendary: 'Lendário',
};

export function MuseumPage() {
  const [data, setData] = useState<MuseumData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedStadium, setSelectedStadium] = useState<{ s: StadiumEvolution; unlocked: boolean } | null>(null);

  useEffect(() => {
    apiClient.get<MuseumData>('/api/club/museum')
      .then((res) => setData(res.data))
      .catch(() => setError('Não foi possível carregar o museu.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="py-16 text-center">
        <p className="retro-text text-lg" style={{ color: 'var(--text-muted)' }}>Carregando museu…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="py-16 text-center">
        <p className="retro-text text-lg" style={{ color: 'var(--orange)' }}>{error || 'Erro desconhecido'}</p>
      </div>
    );
  }

  const { trophies, retiredPlayers, clubInfo, stadiums } = data;

  const TOTAL_STADIUMS = 5;
  const paddedStadiums: (StadiumEvolution | null)[] = [
    ...stadiums,
    ...Array(Math.max(0, TOTAL_STADIUMS - stadiums.length)).fill(null),
  ];

  return (
    <PageContentShell className="space-y-10">

      {/* Header */}
      <div className="pixel-card pixel-card-fluid w-full min-w-0" style={{ borderColor: 'var(--green)' }}>
        <h1 className="pixel-text text-2xl sm:text-3xl md:text-4xl" style={{ color: 'var(--green)' }}>
          <i className="bi bi-bank" aria-hidden /> Museu do Clube
        </h1>
        {clubInfo && (
          <p className="retro-text text-base mt-2" style={{ color: '#cccccc' }}>
            {clubInfo.name} · Fundado em {new Date(clubInfo.createdAt).toLocaleDateString('pt-BR')}
          </p>
        )}
      </div>

      {/* Stadium Evolution */}
      <section>
        <h2 className="pixel-text text-xl sm:text-2xl mb-4" style={{ color: 'var(--blue)' }}><i className="bi bi-building" aria-hidden /> Evolução do Estádio</h2>
        <div className="flex gap-4 overflow-x-auto pb-4" style={{ scrollSnapType: 'x mandatory' }}>
          {paddedStadiums.map((s, i) => {
            const real = s !== null;
            const unlocked = real && (s.licenseStatus === 'signed' || s.isFree === true || s.isCurrent);
            const isCurrent = real && s.isCurrent;
            const img = real && s.imageUrl ? resolveUploadUrl(s.imageUrl) : null;
            return (
              <div
                key={real ? s.id : `placeholder-${i}`}
                className="relative flex-shrink-0 pixel-box-light flex flex-col overflow-hidden cursor-pointer transition-transform hover:scale-[1.02] active:scale-[0.98]"
                style={{
                  width: 'clamp(200px, 70vw, 280px)',
                  scrollSnapAlign: 'start',
                  borderWidth: 3,
                  borderColor: isCurrent ? 'var(--gold)' : unlocked ? 'var(--green)' : 'var(--border-muted)',
                  boxShadow: isCurrent ? '0 0 24px var(--gold)66' : undefined,
                }}
                onClick={() => real && setSelectedStadium({ s, unlocked })}
              >
                {/* Image */}
                <div
                  className="w-full flex items-center justify-center overflow-hidden"
                  style={{ height: 'clamp(140px, 40vw, 200px)', background: 'rgba(0,0,0,0.6)' }}
                >
                  {!real || !unlocked ? (
                    <div className="flex flex-col items-center gap-3">
                      <i className="bi bi-incognito" style={{ fontSize: 72, color: 'var(--text-muted)' }} />
                      <span className="retro-text text-sm" style={{ color: 'var(--text-muted)' }}>Desconhecido</span>
                    </div>
                  ) : img ? (
                    <img src={img} alt={s.name} className="w-full h-full object-cover" />
                  ) : (
                    <span style={{ fontSize: 72 }}><i className="bi bi-building" aria-hidden /></span>
                  )}
                </div>

                {/* ATUAL badge */}
                {isCurrent && (
                  <span
                    className="absolute top-3 left-3 retro-text px-3 py-1"
                    style={{ background: 'var(--gold)', color: '#000', fontWeight: 700, fontSize: 13 }}
                  >
                    ATUAL
                  </span>
                )}

                <div className="p-4 flex flex-col gap-2">
                  <p className="pixel-text text-base truncate" style={{ color: unlocked ? '#ffffff' : 'var(--text-muted)' }}>
                    {real && unlocked ? s.name : `Estádio ${i + 1}`}
                  </p>
                  <p className="retro-text text-sm" style={{ color: real && unlocked ? 'var(--green)' : 'var(--text-muted)' }}>
                    {real ? `+${Math.round(s.farmBonusPct * 100)}% farm` : 'Em breve'}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Trophies */}
      <section>
        <h2 className="pixel-text text-xl sm:text-2xl mb-4" style={{ color: 'var(--gold)' }}><i className="bi bi-trophy-fill" aria-hidden /> Troféus</h2>
        {trophies.length === 0 ? (
          <div className="pixel-card text-center py-10">
            <p className="retro-text text-base" style={{ color: 'var(--text-muted)' }}>
              Nenhum troféu ainda. Os títulos conquistados aparecerão aqui.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {trophies.map((trophy) => (
              <div key={trophy.id} className="pixel-card flex flex-col items-center gap-3 text-center" style={{ borderColor: 'var(--gold)' }}>
                {trophy.imageUrl ? (
                  <img src={trophy.imageUrl} alt={trophy.name} className="w-20 h-20 object-contain" />
                ) : (
                  <span style={{ fontSize: 56 }}><i className="bi bi-trophy-fill" aria-hidden /></span>
                )}
                <p className="pixel-text text-lg" style={{ color: 'var(--gold)' }}>{trophy.name}</p>
                {trophy.description && (
                  <p className="retro-text text-sm" style={{ color: 'var(--text-muted)' }}>{trophy.description}</p>
                )}
                <p className="retro-text text-sm" style={{ color: 'var(--text-muted)' }}>
                  {new Date(trophy.wonAt).toLocaleDateString('pt-BR')}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Retired Players */}
      <section>
        <h2 className="pixel-text text-xl sm:text-2xl mb-4" style={{ color: '#cccccc' }}><i className="bi bi-person-fill" aria-hidden /> Jogadores Aposentados</h2>
        {retiredPlayers.length === 0 ? (
          <div className="pixel-card text-center py-10">
            <p className="retro-text text-base" style={{ color: 'var(--text-muted)' }}>
              Nenhum jogador aposentado ainda.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {retiredPlayers.map((p) => (
              <div key={p.id} className="pixel-card flex items-center gap-4">
                {p.imageUrl ? (
                  <img src={p.imageUrl} alt={p.name ?? ''} className="w-16 h-16 object-cover rounded shrink-0" />
                ) : (
                  <span className="shrink-0" style={{ fontSize: 40 }}><i className="bi bi-shield-fill" aria-hidden /></span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="pixel-text text-lg truncate" style={{ color: RARITY_COLORS[p.rarity] ?? '#ffffff' }}>
                    {p.name ?? 'Jogador'}
                  </p>
                  <p className="retro-text text-base mt-1" style={{ color: 'var(--text-secondary)' }}>
                    {RARITY_LABELS[p.rarity] ?? p.rarity} · {p.position} · OVR {p.overwall}
                    {p.source === 'referral' && ' · Indicação'}
                  </p>
                  {p.hasCareerCycle ? (
                    <p className="retro-text text-base mt-1" style={{ color: 'var(--gold)' }}>
                      Aposentado aos {p.age ?? 40} ({p.roiPct ?? 200}% ROI)
                      {(p.costBasisUsdc ?? 0) > 0 &&
                        ` · ${(p.lifetimeEarnedUsdc ?? 0).toFixed(2)} / ${((p.costBasisUsdc ?? 0) * 2).toFixed(2)} USDC`}
                    </p>
                  ) : (
                    <p className="retro-text text-base mt-1" style={{ color: 'var(--text-secondary)' }}>
                      Aposentadoria por tempo (recompensa)
                    </p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="retro-text text-base" style={{ color: '#ffffff' }}>Aposentado</p>
                  <p className="retro-text text-base" style={{ color: 'var(--text-secondary)' }}>
                    {new Date(p.retiredAt).toLocaleDateString('pt-BR')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Club History */}
      {clubInfo && (
        <section>
          <h2 className="pixel-text text-xl sm:text-2xl mb-4" style={{ color: 'var(--blue)' }}><i className="bi bi-calendar-event-fill" aria-hidden /> História do Clube</h2>
          <div className="pixel-card space-y-4">
            {[
              { label: 'Clube fundado', value: new Date(clubInfo.createdAt).toLocaleDateString('pt-BR'), color: '#ffffff' },
              { label: 'Sala de troféus', value: `Nível ${clubInfo.trophyRoomLvl}`, color: 'var(--gold)' },
              { label: 'Total minerado', value: `${parseFloat(clubInfo.lifetimeEarnedUsdc).toFixed(6)} USDC`, color: 'var(--green)' },
              { label: 'Troféus conquistados', value: String(trophies.length), color: 'var(--gold)' },
              { label: 'Jogadores que passaram', value: String(retiredPlayers.length), color: '#ffffff' },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex items-center justify-between gap-4">
                <span className="retro-text text-base" style={{ color: '#cccccc' }}>{label}</span>
                <span className="pixel-text text-base" style={{ color }}>{value}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <Link to="/club" className="retro-text text-base block" style={{ color: 'var(--text-muted)' }}>
        ← Voltar ao clube
      </Link>

      {/* Stadium Modal */}
      <AnimatePresence>
        {selectedStadium && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 px-4 pb-4"
            style={{ background: 'rgba(0,0,0,0.85)', paddingTop: 'calc(env(safe-area-inset-top) + 72px)' }}
            onClick={() => setSelectedStadium(null)}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 240, damping: 22 }}
              className="relative w-full overflow-hidden flex flex-col"
              style={{
                maxWidth: '560px',
                maxHeight: '80vh',
                borderRadius: 4,
                border: `3px solid ${selectedStadium.s.isCurrent ? 'var(--gold)' : selectedStadium.unlocked ? 'var(--green)' : '#555'}`,
                background: 'linear-gradient(180deg, #1a1d2e 0%, #0d0f1a 100%)',
                boxShadow: selectedStadium.s.isCurrent ? '0 0 60px var(--gold)55' : '0 0 40px rgba(0,0,0,0.8)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Image — takes most of the space */}
              <div className="w-full flex-1 flex items-center justify-center overflow-hidden" style={{ minHeight: '38vh', background: 'rgba(0,0,0,0.6)' }}>
                {!selectedStadium.unlocked ? (
                  <div className="flex flex-col items-center gap-4">
                    <i className="bi bi-incognito" style={{ fontSize: 120, color: '#666' }} />
                    <span className="retro-text text-xl" style={{ color: '#888' }}>Estádio não desbloqueado</span>
                  </div>
                ) : selectedStadium.s.imageUrl ? (
                  <img src={resolveUploadUrl(selectedStadium.s.imageUrl)} alt={selectedStadium.s.name} className="w-full h-full object-cover" />
                ) : (
                  <span style={{ fontSize: 120 }}><i className="bi bi-building" aria-hidden /></span>
                )}
              </div>

              {/* Badges */}
              {selectedStadium.s.isCurrent && (
                <span className="absolute top-4 left-4 retro-text px-4 py-1.5" style={{ background: 'var(--gold)', color: '#000', fontWeight: 700, fontSize: 15 }}>
                  ATUAL
                </span>
              )}

              <button
                type="button"
                onClick={() => setSelectedStadium(null)}
                className="absolute top-4 right-4 w-11 h-11 flex items-center justify-center rounded-full text-white text-xl"
                style={{ background: 'rgba(0,0,0,0.75)', border: '1px solid #555' }}
              >
                <i className="bi bi-x-lg" aria-hidden />
              </button>

              {/* Info footer */}
              <div className="p-6 sm:p-8 space-y-4" style={{ borderTop: `1px solid ${selectedStadium.s.isCurrent ? 'var(--gold)40' : '#ffffff15'}` }}>
                <p className="pixel-text text-2xl sm:text-3xl" style={{ color: '#ffffff' }}>
                  {selectedStadium.unlocked ? selectedStadium.s.name : `Estádio ${paddedStadiums.indexOf(selectedStadium.s) + 1}`}
                </p>
                <div className="flex gap-6 flex-wrap">
                  <div>
                    <p className="retro-text text-sm" style={{ color: '#aaa' }}>Bônus de farm</p>
                    <p className="pixel-text text-2xl" style={{ color: 'var(--green)' }}>+{Math.round(selectedStadium.s.farmBonusPct * 100)}%</p>
                  </div>
                  <div>
                    <p className="retro-text text-sm" style={{ color: '#aaa' }}>Status</p>
                    <p className="pixel-text text-2xl" style={{ color: selectedStadium.s.isCurrent ? 'var(--gold)' : selectedStadium.unlocked ? 'var(--green)' : '#666' }}>
                      {selectedStadium.s.isCurrent ? 'Em uso' : selectedStadium.unlocked ? 'Licenciado' : 'Bloqueado'}
                    </p>
                  </div>
                  {!selectedStadium.s.isFree && selectedStadium.s.priceUsdc != null && selectedStadium.s.priceUsdc > 0 && (
                    <div>
                      <p className="retro-text text-sm" style={{ color: '#aaa' }}>Licença</p>
                      <p className="pixel-text text-2xl" style={{ color: 'var(--gold)' }}>
                        {selectedStadium.s.priceUsdc.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} GMT
                      </p>
                    </div>
                  )}
                </div>
                {!selectedStadium.unlocked && (
                  <Link
                    to="/club/escritorio"
                    className="pixel-btn pixel-btn-md inline-flex"
                    style={{ borderColor: 'var(--gold)', color: '#fff' }}
                  >
                    Assinar no Escritório →
                  </Link>
                )}
                {selectedStadium.unlocked && !selectedStadium.s.isCurrent && selectedStadium.s.licenseStatus === 'signed' && (
                  <Link
                    to="/club/escritorio"
                    className="pixel-btn pixel-btn-md inline-flex"
                    style={{ borderColor: 'var(--blue)', color: '#fff' }}
                  >
                    Ativar no Escritório →
                  </Link>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </PageContentShell>
  );
}

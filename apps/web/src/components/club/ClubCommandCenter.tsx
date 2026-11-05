import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { playerNickname } from '../../lib/playerNickname';
import { PixelCrest } from '../layout/PixelCrest';
import { usePassProgress, usePlayerProfile, useVestiario, type ClubData } from '../../hooks/useApi';
import './clubCardSkins.css';

const IDENTITY = [
  { name: 'Preto', color: '#111111' },
  { name: 'Ouro', color: '#f0c828' },
  { name: 'Creme', color: '#f7f4ea' },
] as const;

const POSITION_LABEL: Record<string, string> = {
  GK: 'Goleiro',
  DEF: 'Zagueiro',
  LAT: 'Lateral',
  MID: 'Meio-campista',
  FW: 'Atacante',
  GOL: 'Goleiro',
  ZAG: 'Zagueiro',
  MEI: 'Meio-campista',
  ATA: 'Atacante',
};

function positionLabel(position: string | null | undefined): string {
  const key = position?.trim() || '';
  if (!key) return '—';
  return POSITION_LABEL[key] ?? key;
}

function CommandLink({
  to,
  label,
  detail,
  color,
  icon,
}: {
  to: string;
  label: string;
  detail: string;
  color: string;
  icon: string;
}) {
  return (
    <Link
      to={to}
      className="club-command-tile flex min-h-16 items-center gap-3 px-4 py-3 text-white no-underline"
      style={{ '--card-accent': color } as CSSProperties}
    >
      <span className="club-command-icon" aria-hidden="true"><i className={`bi bi-${icon}`} /></span>
      <span className="club-command-copy">
        <span className="block text-base font-extrabold uppercase tracking-wide">{label}</span>
        <span className="block text-sm opacity-90">{detail}</span>
      </span>
      <i className={`club-command-watermark bi bi-${icon}`} aria-hidden="true" />
      <i className="club-command-arrow bi bi-chevron-right" aria-hidden="true" />
    </Link>
  );
}

export function ClubCommandCenter({ club }: { club: ClubData }) {
  const { data: profile } = usePlayerProfile();
  const { data: vestiario } = useVestiario();
  const { data: pass } = usePassProgress();

  const lineup = profile?.players.lineup ?? [];
  const bench = vestiario?.bench ?? [];
  const available = club.basePlayerCount + club.nftCount;
  const season = pass?.active
    ? (pass.seasonName ?? 'Temporada ativa')
    : 'Sem temporada';
  const xp = pass?.active ? pass.xp : 0;
  const trophies = profile?.gameplay.trophyCount ?? 0;
  const badges = profile?.gameplay.badgeCount ?? 0;
  const matches = profile?.gameplay.matches ?? [];

  return (
    <section className="space-y-4">
      <header className="pixel-card club-card-skin club-card-header flex flex-wrap items-center gap-4" style={{ '--card-accent': '#f0c828' } as CSSProperties}>
        <PixelCrest letter={club.name} size={88} />
        <div className="min-w-0 flex-1">
          <p className="score-label" style={{ color: '#f0c828' }}>Centro de comando</p>
          <h1 className="pixel-text mt-1 text-2xl text-white sm:text-3xl">{club.name}</h1>
          <p className="retro-text mt-2">
            Nível {club.stadiumLvl} · {xp} XP · OVERWALL do elenco {(club.squadOverwall ?? club.totalOverwall).toLocaleString('pt-BR')} · OVERWALL ativo {(club.activeOverwall ?? club.lineupOverwall ?? 0).toLocaleString('pt-BR')} · OVERWALL total {(club.collectionOverwall ?? club.totalOverwall).toLocaleString('pt-BR')}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="ui-label-sm">Identidade</span>
            {IDENTITY.map((swatch) => (
              <span key={swatch.name} className="inline-flex items-center gap-1 retro-text text-sm">
                <span
                  className="inline-block h-4 w-4 border border-white/40"
                  style={{ background: swatch.color }}
                  aria-hidden
                />
                {swatch.name}
              </span>
            ))}
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
        <CommandLink to="/club/stadium" label="Estádio" detail={`Nível ${club.stadiumLvl}`} color="#1d4ed8" icon="flag-fill" />
        <CommandLink to="/club/ct" label="Centro de treinamento" detail={`Nível ${club.ctLvl}`} color="#0e7490" icon="bullseye" />
        <CommandLink to="/club/vestiario" label="Vestiário" detail={`${lineup.length} no elenco`} color="#15803d" icon="door-open-fill" />
        <CommandLink to="/club/vestiario" label="Elenco" detail={lineup.length ? lineup.map((p) => playerNickname(p.name, p.id)).slice(0, 3).join(', ') : 'Ninguém escalado'} color="#6d28d9" icon="people-fill" />
        <CommandLink to="/club/vestiario" label="Banco de reservas" detail={`${bench.length} fora do onze`} color="#c2410c" icon="person-lines-fill" />
        <CommandLink to="/club/inventory" label="Jogadores disponíveis" detail={`${available} no clube`} color="#0f766e" icon="person-badge-fill" />
        <CommandLink to="/club/museum" label="Conquistas" detail={`${trophies} troféus · ${badges} badges`} color="#a16207" icon="trophy-fill" />
        <CommandLink to={pass?.active ? '/pass' : '/ranking'} label="Temporada" detail={season} color="#86198f" icon="stars" />
        <CommandLink to="/pvp" label="Histórico" detail={matches[0] ? `Último: vs ${matches[0].opponent}` : 'Sem partidas'} color="#b91c1c" icon="clock-history" />
      </div>

      {(lineup.length > 0 || bench.length > 0 || matches.length > 0) && (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          <article className="pixel-card club-card-skin" style={{ '--card-accent': '#6d28d9' } as CSSProperties}>
            <h2 className="ui-label-sm" style={{ color: '#c4b5fd' }}><i className="club-card-heading-icon bi bi-people-fill" aria-hidden="true" />Elenco</h2>
            <i className="club-card-emblem bi bi-people-fill" aria-hidden="true" />
            {lineup.length === 0 ? (
              <p className="retro-text mt-2" style={{ color: 'var(--text-muted)' }}>Nenhum titular.</p>
            ) : (
              <ul className="mt-2 space-y-1">
                {lineup.map((player) => (
                  <li key={player.id} className="retro-text flex justify-between gap-2">
                    <span>{playerNickname(player.name, player.id)}</span>
                    <span>{positionLabel(player.position)}</span>
                  </li>
                ))}
              </ul>
            )}
          </article>
          <article className="pixel-card club-card-skin" style={{ '--card-accent': '#c2410c' } as CSSProperties}>
            <h2 className="ui-label-sm" style={{ color: '#fdba74' }}><i className="club-card-heading-icon bi bi-person-lines-fill" aria-hidden="true" />Banco</h2>
            <i className="club-card-emblem bi bi-person-lines-fill" aria-hidden="true" />
            {bench.length === 0 ? (
              <p className="retro-text mt-2" style={{ color: 'var(--text-muted)' }}>Banco vazio.</p>
            ) : (
              <ul className="mt-2 space-y-1">
                {bench.slice(0, 8).map((player) => (
                  <li key={`${player.kind}-${player.id}`} className="retro-text flex justify-between gap-2">
                    <span>{playerNickname(player.name, player.id)}</span>
                    <span>{positionLabel(player.position)}</span>
                  </li>
                ))}
              </ul>
            )}
          </article>
          <article className="pixel-card club-card-skin" style={{ '--card-accent': '#b91c1c' } as CSSProperties}>
            <h2 className="ui-label-sm" style={{ color: '#fca5a5' }}><i className="club-card-heading-icon bi bi-clock-history" aria-hidden="true" />Histórico</h2>
            <i className="club-card-emblem bi bi-clock-history" aria-hidden="true" />
            {matches.length === 0 ? (
              <p className="retro-text mt-2" style={{ color: 'var(--text-muted)' }}>Sem partidas.</p>
            ) : (
              <ul className="mt-2 space-y-1">
                {matches.map((match) => (
                  <li key={match.id} className="retro-text">
                    vs {match.opponent}
                  </li>
                ))}
              </ul>
            )}
          </article>
        </div>
      )}
    </section>
  );
}

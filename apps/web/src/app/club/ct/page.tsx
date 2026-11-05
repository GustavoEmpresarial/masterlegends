import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import type { CtRecordDTO, InventoryPlayerDTO, LineupPlayerDTO } from '@mll/shared';
import { useClub, useCtView, useInventory, useUpgradeBuilding } from '../../../hooks/useApi';
import { useCtRealtime } from '../../../hooks/useCtRealtime';
import { resolveUploadUrl } from '../../../lib/resolveUploadUrl';
import { playerNickname } from '../../../lib/playerNickname';
import { POSITION_EMOJI } from '../../../lib/stadiumConstants';
import { PlayerAgeBadge } from '../../../components/players/PlayerAgeBadge';
import { PlayerCardModal } from '../../../components/stadium/PlayerCardModal';
import { rarityGlowCss } from '../../../components/stadium/stadiumBonecoTheme';
import { PageContentShell } from '../../../components/content';

const CT_ATTR: Record<string, string> = {
  goleiro: 'goleiro',
  defesa: 'defesa',
  velocidade: 'velocidade',
  passe: 'passe',
  finalizacao: 'finalização',
};

function describeCtRecord(record: CtRecordDTO): string {
  if (record.kind === 'training') {
    return `Treino — ${record.before ?? 0} stamina, CT nível ${record.after ?? 0}`;
  }
  if (record.kind === 'evolution') {
    const name = CT_ATTR[record.detail ?? ''] ?? record.detail ?? 'atributo';
    return `Evolução ${name} ${record.before ?? 0}→${record.after ?? 0}`;
  }
  return `Progressão do CT ${record.before ?? 0}→${record.after ?? 0}`;
}

export function CtPage() {
  const { t } = useTranslation(['club', 'common']);
  const { data: club, isLoading: clubLoading } = useClub();
  const { data: ct, isLoading: ctLoading } = useCtView();
  const { data: inventory, isLoading: invLoading } = useInventory();
  const upgrade = useUpgradeBuilding();
  useCtRealtime();

  const [selectedPlayer, setSelectedPlayer] = useState<LineupPlayerDTO | null>(null);

  const benchPlayers = useMemo(() => {
    const players = inventory?.players ?? [];
    return players.slice().sort((a, b) => {
      const staminaDiff = (a.stamina ?? 0) - (b.stamina ?? 0);
      if (staminaDiff !== 0) return staminaDiff;
      return (b.overwall ?? 0) - (a.overwall ?? 0);
    });
  }, [inventory]);

  function toLineupPlayer(p: InventoryPlayerDTO): LineupPlayerDTO {
    return {
      id: p.id,
      tokenId: p.tokenId,
      kind: p.kind,
      rarity: p.rarity,
      overwall: p.overwall,
      position: p.position,
      name: p.name ?? null,
      imageUrl: p.imageUrl ?? null,
      stamina: p.stamina ?? 100,
      staminaMax: p.staminaMax ?? 100,
      source: p.source ?? null,
      expiresAt: p.expiresAt ?? null,
      costBasisUsdc: p.costBasisUsdc,
      lifetimeEarnedUsdc: p.lifetimeEarnedUsdc,
      age: p.age,
      retireAge: p.retireAge,
      roiPct: p.roiPct,
      staked: p.staked,
      stakeGmt: p.stakeGmt,
    };
  }

  if (clubLoading || ctLoading) {
    return (
      <div className="pixel-card text-center py-16">
        <p className="retro-text text-xl" style={{ color: 'var(--text-muted)' }}>
          {t('common:labels.status.loading')}
        </p>
      </div>
    );
  }

  if (!club || !ct) {
    return (
      <div className="pixel-card text-center py-12">
        <p className="retro-text mb-4">{t('club:create.subtitle')}</p>
        <Link to="/club" className="pixel-btn pixel-btn-green pixel-btn-md">
          {t('club:create.title')}
        </Link>
      </div>
    );
  }

  return (
    <PageContentShell>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="pixel-card flex flex-wrap items-center justify-between gap-4"
        style={{ borderColor: 'var(--blue)' }}
      >
        <div>
          <h1 className="pixel-text text-xl sm:text-2xl" style={{ color: 'var(--blue)' }}>
            <i className="bi bi-lightning-charge-fill" aria-hidden /> {t('club:buildings.ct.name')}
          </h1>
          <p className="retro-text text-base mt-1" style={{ color: 'var(--text-secondary)' }}>
            {t('club:ct.subtitle')}
          </p>
          <p className="retro-text text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            {t('club:vestiario.ctHint', { rate: ct.passiveRecoveryPerHour })}
          </p>
        </div>
        <Link to="/club/vestiario" className="pixel-btn pixel-btn-md" style={{ borderColor: 'var(--blue)' }}>
          <i className="bi bi-droplet-fill" aria-hidden /> {t('club:vestiario.title')}
        </Link>
      </motion.div>

      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="pixel-card flex flex-wrap items-center justify-between gap-4"
        style={{ borderColor: 'var(--blue)' }}
      >
        <div className="min-w-0 flex-1 space-y-1">
          <h2 className="ui-label" style={{ color: 'var(--blue)' }}>
            <i className="bi bi-person-badge-fill" aria-hidden /> Treinador
          </h2>
          {ct.coachHired ? (
            ct.passiveRecoveryPerHour > 0 ? (
              <p className="retro-text text-sm" style={{ color: 'var(--text-secondary)' }}>
                Ativo · recupera{' '}
                <span style={{ color: 'var(--green)' }}>+{ct.passiveRecoveryPerHour}/h</span>{' '}
                fora da escalação.
              </p>
            ) : (
              <p className="retro-text text-sm" style={{ color: 'var(--text-secondary)' }}>
                Contratado, mas recuperação pausada (aflição). Veja o Escritório.
              </p>
            )
          ) : (
            <p className="retro-text text-sm" style={{ color: 'var(--text-secondary)' }}>
              Sem treinador — CT não recupera stamina passivamente. Contrate no Escritório.
            </p>
          )}
          <p className="retro-text text-xs" style={{ color: 'var(--text-muted)' }}>
            Descanso diário: +{ct.dailyRestStamina ?? 100} stamina
            {ct.canClaimDailyRest
              ? ' · disponível agora no vestiário'
              : ct.nextRestAvailableAt
                ? ` · próximo ${new Date(ct.nextRestAvailableAt).toLocaleString('pt-BR')}`
                : ''}
          </p>
        </div>
        {ct.coachHired ? (
          <div className="text-right shrink-0">
            <p className="retro-text text-[10px]" style={{ color: 'var(--text-muted)' }}>
              Passiva
            </p>
            <p
              className="pixel-text text-2xl"
              style={{ color: ct.passiveRecoveryPerHour > 0 ? 'var(--green)' : 'var(--text-muted)' }}
            >
              +{ct.passiveRecoveryPerHour}/h
            </p>
          </div>
        ) : (
          <Link to="/club/escritorio" className="pixel-btn pixel-btn-md shrink-0" style={{ borderColor: 'var(--blue)' }}>
            ESCRITÓRIO
          </Link>
        )}
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.18 }}
        className="pixel-card space-y-3"
        style={{ borderColor: 'var(--purple)' }}
      >
        <h2 className="ui-label" style={{ color: 'var(--purple)' }}>
          Evolução, bônus e progressão
        </h2>
        <p className="retro-text text-base" style={{ color: 'var(--text-secondary)' }}>
          Evolução de atributo sobe o posto em{' '}
          <span style={{ color: 'var(--gold)' }}>+{ct.evolutionStep ?? 1}</span>, sem passar do topo da faixa.
        </p>
        <p className="retro-text text-base" style={{ color: 'var(--text-secondary)' }}>
          Bônus do CT: <span style={{ color: 'var(--green)' }}>+{ct.recoveryBonus ?? 0}/h</span> na recuperação do treinador.
          Taxa atual: {ct.passiveRecoveryPerHour}/h.
        </p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="retro-text text-base" style={{ color: 'var(--text-secondary)' }}>
            Prédio nível {ct.ctLvl}/{ct.maxLevel}.
            {ct.upgradeCost != null ? ` Próximo nível: ${ct.upgradeCost} MGT.` : ' Nível máximo.'}
          </p>
          {ct.canUpgrade ? (
            <button
              type="button"
              className="pixel-btn pixel-btn-md"
              style={{ borderColor: 'var(--gold)' }}
              disabled={upgrade.isPending}
              onClick={() => upgrade.mutate('ct')}
            >
              {upgrade.isPending ? 'SUBINDO' : 'SUBIR CT'}
            </button>
          ) : null}
        </div>
        <div>
          <p className="ui-label-sm" style={{ color: 'var(--text-muted)' }}>Últimos registros</p>
          {(ct.records?.length ?? 0) === 0 ? (
            <p className="retro-text text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
              Nenhum treino, evolução ou progressão ainda.
            </p>
          ) : (
            <ul className="mt-2 space-y-1 retro-text text-sm" style={{ color: 'var(--text-secondary)' }}>
              {ct.records.map((record) => (
                <li key={record.id}>{describeCtRecord(record)}</li>
              ))}
            </ul>
          )}
        </div>
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="pixel-card space-y-3"
        style={{ borderColor: 'var(--gold)' }}
      >
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="ui-label" style={{ color: 'var(--gold)' }}>
            <i className="bi bi-moon-stars-fill" aria-hidden /> Elenco — quem mais precisa descansar
          </h2>
          <span className="retro-text text-xs" style={{ color: 'var(--text-muted)' }}>
            {benchPlayers.length} jogador{benchPlayers.length === 1 ? '' : 'es'}
          </span>
        </div>

        {invLoading ? (
          <p className="retro-text text-sm" style={{ color: 'var(--text-muted)' }}>
            {t('common:labels.status.loading')}
          </p>
        ) : benchPlayers.length === 0 ? (
          <p className="retro-text text-sm" style={{ color: 'var(--text-muted)' }}>
            Nenhum jogador no elenco.
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-3">
            {benchPlayers.map((p) => {
              const stamina = p.stamina ?? 0;
              const max = p.staminaMax ?? 100;
              const pct = Math.max(0, Math.min(100, Math.round((stamina / max) * 100)));
              const barColor = pct < 25 ? 'var(--red)' : pct < 60 ? 'var(--gold)' : 'var(--green)';
              const rarityColor = rarityGlowCss(p.rarity);
              const nick = playerNickname(p.name, p.id, p.position);
              const img = p.imageUrl ? resolveUploadUrl(p.imageUrl) : '';
              const icon = POSITION_EMOJI[p.position] ?? 'bi-shield-fill';
              return (
                <li key={`${p.kind}:${p.id}`}>
                  <button
                    type="button"
                    className="flex w-full items-stretch gap-3 p-3 h-full text-left"
                    style={{
                      background: 'rgba(255,255,255,0.03)',
                      border: `2px solid ${rarityColor}55`,
                      borderRadius: 4,
                    }}
                    onClick={() => setSelectedPlayer(toLineupPlayer(p))}
                  >
                    <span
                      className="relative flex aspect-[2/3] h-40 w-auto sm:h-52 shrink-0 items-center justify-center overflow-hidden"
                      style={{ border: `2px solid ${rarityColor}`, background: '#0f1622' }}
                    >
                      {img ? (
                        <img
                          src={img}
                          alt=""
                          className="absolute inset-0 h-full w-full object-cover"
                          style={{ imageRendering: 'pixelated' }}
                          draggable={false}
                        />
                      ) : (
                        <i className={`bi ${icon} text-4xl sm:text-5xl`} aria-hidden />
                      )}
                    </span>
                    <span className="min-w-0 flex flex-1 flex-col justify-between gap-2">
                      <span>
                        <span className="flex items-center gap-2 min-w-0">
                          <span
                            className="retro-text truncate text-sm font-bold"
                            style={{ color: rarityColor }}
                          >
                            {nick}
                          </span>
                          <PlayerAgeBadge player={p} />
                        </span>
                        <span className="retro-text text-[11px] mt-0.5 block" style={{ color: 'var(--text-muted)' }}>
                          {p.position} · OVR {p.overwall}
                        </span>
                      </span>
                      <span className="flex items-center gap-2">
                        <span
                          className="flex-1 h-3 overflow-hidden"
                          style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 2 }}
                        >
                          <span
                            className="block h-full transition-all"
                            style={{ width: `${pct}%`, background: barColor }}
                          />
                        </span>
                        <span
                          className="pixel-text text-sm whitespace-nowrap"
                          style={{ color: barColor, minWidth: '3.5rem', textAlign: 'right' }}
                        >
                          {stamina}/{max}
                        </span>
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </motion.section>

      <PlayerCardModal player={selectedPlayer} onClose={() => setSelectedPlayer(null)} />
    </PageContentShell>
  );
}

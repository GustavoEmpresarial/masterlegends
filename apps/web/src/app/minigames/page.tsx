import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import type { InventoryPlayerDTO, MinigameCatalogItemDTO } from '@mll/shared';
import { useInventory, useMinigames } from '../../hooks/useApi';
import { PlayerAgeBadge } from '../../components/players/PlayerAgeBadge';
import { PixelProgress } from '../../components/ui/PixelComponents';
import { PageContentShell } from '../../components/content';
import { CornerKickStage } from '../../components/minigames/CornerKickStage';
import { playerNickname } from '../../lib/playerNickname';

function useCooldownTick(cooldownSec: number) {
  const [remaining, setRemaining] = useState(cooldownSec);
  const ref = useRef(cooldownSec);

  useEffect(() => {
    ref.current = cooldownSec;
    setRemaining(cooldownSec);
    if (cooldownSec <= 0) return;
    const id = setInterval(() => {
      ref.current = Math.max(0, ref.current - 1);
      setRemaining(ref.current);
    }, 1000);
    return () => clearInterval(id);
  }, [cooldownSec]);

  return remaining;
}

function CooldownTimer({ cooldownSec }: { cooldownSec: number }) {
  const remaining = useCooldownTick(cooldownSec);
  const mm = String(Math.floor(remaining / 60)).padStart(2, '0');
  const ss = String(remaining % 60).padStart(2, '0');
  return (
    <div className="pixel-box p-3 text-center" style={{ borderColor: 'var(--orange)' }}>
      <span className="retro-text text-sm" style={{ color: 'var(--orange)' }}>
        <i className="bi bi-stopwatch-fill" aria-hidden /> Cooldown: {mm}:{ss}
      </span>
    </div>
  );
}

function GameCard({
  game,
  onPlay,
}: {
  game: MinigameCatalogItemDTO;
  onPlay: (game: MinigameCatalogItemDTO) => void;
}) {
  const inCooldown = game.cooldownSec > 0;
  const nextLevel = Math.ceil((game.totalPlays + 1) / 10) * 10;
  const progress = game.totalPlays % 10;

  return (
    <motion.div
      className="pixel-card"
      style={{ borderColor: 'var(--cyan)', opacity: inCooldown ? 0.85 : 1 }}
    >
      <div className="text-center">
        <CornerKickStage rarity="legendary" position="FW" seed="escanteio" />
        <h3 className="pixel-text text-lg mb-2 mt-3" style={{ color: 'var(--cyan)' }}>
          Pênalti de Treino
        </h3>
        <p className="retro-text text-lg mb-4" style={{ color: 'var(--text-muted)' }}>
          Abrir a sessão gasta stamina do jogador escolhido
        </p>

        <div className="pixel-box-light p-2 mb-3 flex justify-between">
          <span className="retro-text text-sm" style={{ color: 'var(--text-muted)' }}>
            <i className="bi bi-lightning-charge-fill" aria-hidden /> Custo
          </span>
          <span className="retro-text text-sm" style={{ color: 'var(--orange)' }}>
            -{game.staminaCost}
          </span>
        </div>

        {/* Cooldown progress info */}
        <div className="pixel-box-light p-2 mb-4">
          <div className="flex justify-between items-center mb-1">
            <span className="retro-text text-xs" style={{ color: 'var(--text-muted)' }}>
              Jogos ({game.totalPlays})
            </span>
            <span className="retro-text text-xs" style={{ color: 'var(--text-muted)' }}>
              +10s cooldown em {nextLevel - game.totalPlays} jogo{nextLevel - game.totalPlays !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-dark)' }}>
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${(progress / 10) * 100}%`,
                background: 'var(--cyan)',
              }}
            />
          </div>
        </div>

        {inCooldown ? (
          <CooldownTimer cooldownSec={game.cooldownSec} />
        ) : (
          <motion.button
            type="button"
            className="pixel-btn pixel-btn-md w-full"
            style={{ background: 'var(--cyan)', borderColor: 'var(--cyan)' }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onPlay(game)}
          >
            <i className="bi bi-controller" aria-hidden /> JOGAR
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}

export function MinigamesPage() {
  const { t } = useTranslation(['minigames', 'common', 'club']);
  const { data: catalog, isLoading } = useMinigames();
  const { data: inventory } = useInventory();

  const [selectedGame, setSelectedGame] = useState<MinigameCatalogItemDTO | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<InventoryPlayerDTO | null>(null);
  const [error, setError] = useState('');

  function handleClose() {
    setSelectedGame(null);
    setSelectedPlayer(null);
    setError('');
  }

  const games = catalog?.games ?? [];

  return (
    <PageContentShell>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
        <h1 className="pixel-text text-xl sm:text-2xl md:text-3xl" style={{ color: 'var(--cyan)' }}>
          <i className="bi bi-controller" aria-hidden /> {t('title')}
        </h1>
        <p className="retro-text text-xl mt-2" style={{ color: 'var(--text-secondary)' }}>
          Ilimitado — cooldown aumenta a cada 10 jogos, decai após 12h
        </p>
        <Link to="/club/ct" className="retro-text text-sm mt-2 inline-block hover:underline" style={{ color: 'var(--blue)' }}>
          ← {t('club:buildings.ct.name', { ns: 'club' })}
        </Link>
      </motion.div>

      {/* Cooldown explanation */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="pixel-box-light p-4"
        style={{ borderColor: 'var(--cyan)' }}
      >
        <p className="retro-text text-sm text-center" style={{ color: 'var(--text-primary)' }}>
          <i className="bi bi-stopwatch-fill" aria-hidden /> <span style={{ color: 'var(--cyan)' }}>Sistema de cooldown progressivo:</span>
          {' '}a cada 10 jogos você ganha +10s de espera. Após 12h sem incremento, o cooldown começa a cair.
        </p>
      </motion.div>

      {isLoading && (
        <p className="retro-text text-center" style={{ color: 'var(--text-muted)' }}>
          {t('common:labels.status.loading')}
        </p>
      )}

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="pixel-card-grid md:grid-cols-2"
      >
        {games.map((game, index) => (
          <motion.div
            key={game.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <GameCard game={game} onPlay={(g) => { setSelectedGame(g); setSelectedPlayer(null); setError(''); }} />
          </motion.div>
        ))}
      </motion.div>

      <AnimatePresence>
        {selectedGame && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
            onClick={handleClose}
          >
            <motion.div
              initial={{ scale: 0.92 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.92 }}
              className="pixel-card max-w-lg w-full max-h-[80vh] overflow-y-auto p-6"
              style={{ borderColor: 'var(--cyan)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="pixel-text text-lg mb-2" style={{ color: 'var(--cyan)' }}>
                Pênalti de Recuperação
              </h3>
              <p className="retro-text text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
                {t('labels.pickPlayer', { defaultValue: 'Escolha o jogador que receberá stamina' })}
              </p>
              <div className="space-y-2 max-h-64 overflow-y-auto mb-4">
                {(inventory?.players ?? []).map((player) => (
                  <button
                    key={`${player.kind}-${player.id}`}
                    type="button"
                    onClick={() => setSelectedPlayer(player)}
                    className={`w-full text-left pixel-box-light p-3 ${
                      selectedPlayer?.id === player.id && selectedPlayer.kind === player.kind
                        ? 'ring-2 ring-[var(--cyan)]'
                        : ''
                    }`}
                  >
                    <p className="retro-text text-sm font-bold flex items-center gap-2 flex-wrap">
                      <span>
                        {playerNickname(player.name, player.id, player.position)} · {player.overwall.toLocaleString()} OW
                      </span>
                      <PlayerAgeBadge player={player} />
                    </p>
                    {player.stamina !== undefined && (
                      <div className="mt-2">
                        <PixelProgress
                          value={player.stamina}
                          max={player.staminaMax ?? 100}
                          color={player.stamina < 30 ? 'var(--red)' : 'var(--green)'}
                          showLabel
                          label={t('club:vestiario.stamina', { ns: 'club' })}
                        />
                      </div>
                    )}
                  </button>
                ))}
              </div>
              {error && <p className="retro-text text-red text-center mb-3">{error}</p>}
              <div className="flex flex-wrap gap-2">
                <button type="button" className="pixel-btn pixel-btn-md" onClick={handleClose}>
                  {t('common:actions.close')}
                </button>
                <button
                  type="button"
                  className="pixel-btn pixel-btn-md"
                  style={{ background: 'var(--cyan)', borderColor: 'var(--cyan)', color: '#ffffff' }}
                  disabled={!selectedPlayer}
                  onClick={() => {
                    if (!selectedPlayer || !selectedGame) return;
                    const url =
                      `/minigames/penalty?game=${encodeURIComponent(selectedGame.id)}` +
                      `&playerId=${encodeURIComponent(selectedPlayer.id)}` +
                      `&kind=${selectedPlayer.kind}`;
                    window.open(url, '_blank', 'noopener,noreferrer');
                    handleClose();
                  }}
                >
                  <i className="bi bi-controller" aria-hidden /> ABRIR ARENA
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </PageContentShell>
  );
}

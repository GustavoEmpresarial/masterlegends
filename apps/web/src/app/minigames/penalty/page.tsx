import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { InventoryPlayerDTO } from '@mll/shared';
import {
  useInventory,
  usePenaltyShoot,
  usePenaltyStart,
  usePlayMinigame,
} from '../../../hooks/useApi';
import { translateError } from '../../../lib/apiError';
import { playerNickname } from '../../../lib/playerNickname';
import { PenaltyKickGame } from '../../../components/minigames/PenaltyKickGame';

export function PenaltyArenaPage() {
  const [params] = useSearchParams();
  const playerId = params.get('playerId') ?? '';
  const kind = (params.get('kind') === 'nft' ? 'nft' : 'base') as 'base' | 'nft';
  const gameId = params.get('game') ?? 'recovery_penalty';

  const { data: inventory } = useInventory();
  const penaltyStart = usePenaltyStart();
  const penaltyShoot = usePenaltyShoot();
  const playMinigame = usePlayMinigame();

  const [player, setPlayer] = useState<InventoryPlayerDTO | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [startKey, setStartKey] = useState(0);
  const [result, setResult] = useState<{ before: number; after: number } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!inventory) return;
    const p = inventory.players.find((pp) => pp.id === playerId && pp.kind === kind);
    setPlayer(p ?? null);
  }, [inventory, playerId, kind]);

  useEffect(() => {
    if (!player || sessionId || penaltyStart.isPending) return;

    let cancelled = false;
    void penaltyStart
      .mutateAsync({ playerId, kind })
      .then((res) => {
        if (!cancelled) setSessionId(res.sessionId);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(translateError(err, 'UNKNOWN'));
      });

    return () => {
      cancelled = true;
    };
  }, [player, playerId, kind, sessionId, startKey]);

  function retryStart() {
    setError('');
    setSessionId(null);
    setStartKey((k) => k + 1);
  }

  async function handleClaim() {
    if (!sessionId) return;
    setError('');
    try {
      const res = await playMinigame.mutateAsync({ id: gameId, playerId, kind, sessionId });
      setResult({ before: res.staminaBefore, after: res.staminaAfter });
    } catch (err: unknown) {
      setError(translateError(err, 'UNKNOWN'));
    }
  }

  return (
    <div
      className="fixed inset-0 flex flex-col"
      style={{
        background:
          'radial-gradient(ellipse at 50% 0%, #1e4a2a 0%, #0a1a28 42%, #050810 100%)',
        zIndex: 9999,
      }}
    >
      <header
        className="flex items-center justify-between gap-3 px-4 py-2"
        style={{
          background: '#050805',
          borderBottom: '4px solid #000',
        }}
      >
        <div className="flex items-center gap-3">
          <span className="pixel-text text-base sm:text-lg" style={{ color: '#ffd400' }}>
            <i className="bi bi-shield-fill" aria-hidden /> ARENA DE PÊNALTI
          </span>
          {player && (
            <>
              <span className="retro-text text-xs" style={{ color: '#ffffff', opacity: 0.6 }}>
                ·
              </span>
              <span className="retro-text text-xs sm:text-sm" style={{ color: '#ffffff' }}>
                Jogando para:{' '}
                <span style={{ color: 'var(--cyan)', fontWeight: 600 }}>
                  {playerNickname(player.name, player.id, player.position)}
                </span>
              </span>
              <span
                className="hidden sm:inline-block px-2 py-0.5 rounded text-[10px]"
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  color: '#ffffff',
                }}
              >
                Stamina: {player.stamina ?? 100}/{player.staminaMax ?? 100}
              </span>
            </>
          )}
        </div>
        <button
          type="button"
          onClick={() => window.close()}
          className="px-3 py-1.5 retro-text text-xs"
          style={{
            background: 'rgba(255,80,80,0.15)',
            border: '1px solid var(--red)',
            color: '#ffffff',
            borderRadius: 3,
          }}
        >
          <i className="bi bi-x-lg" aria-hidden /> FECHAR
        </button>
      </header>

      <main className="flex-1 overflow-auto p-4 sm:p-6 flex items-center justify-center">
        {!playerId ? (
          <div
            className="pixel-card max-w-md text-center"
            style={{ borderColor: 'var(--red)' }}
          >
            <h2 className="pixel-text text-xl mb-2" style={{ color: 'var(--red)' }}>
              JOGADOR NÃO INFORMADO
            </h2>
            <p className="retro-text text-sm" style={{ color: '#ffffff' }}>
              Abra esta página pelo menu de Treinar Jogadores.
            </p>
          </div>
        ) : !inventory ? (
          <p className="retro-text" style={{ color: '#ffffff' }}>
            Carregando...
          </p>
        ) : !player ? (
          <div
            className="pixel-card max-w-md text-center"
            style={{ borderColor: 'var(--red)' }}
          >
            <h2 className="pixel-text text-xl mb-2" style={{ color: 'var(--red)' }}>
              JOGADOR NÃO ENCONTRADO
            </h2>
            <p className="retro-text text-sm" style={{ color: '#ffffff' }}>
              Confira no Vestiário e tente novamente.
            </p>
          </div>
        ) : result ? (
          <div
            className="pixel-card max-w-md w-full text-center space-y-3"
            style={{ borderColor: 'var(--green)' }}
          >
            <h2 className="pixel-text text-2xl" style={{ color: 'var(--green)' }}>
              <i className="bi bi-lightning-charge-fill" aria-hidden /> TREINO CONCLUÍDO
            </h2>
            <p className="retro-text text-base" style={{ color: '#ffffff' }}>
              Stamina atual{' '}
              <span className="pixel-text text-2xl" style={{ color: 'var(--green)' }}>
                {result.after}
              </span>
            </p>
            <button
              type="button"
              onClick={() => window.close()}
              className="pixel-btn pixel-btn-green pixel-btn-md w-full"
              style={{ color: '#ffffff' }}
            >
              <i className="bi bi-check-lg" aria-hidden /> FECHAR ABA
            </button>
          </div>
        ) : !sessionId ? (
          error ? (
            <div
              className="pixel-card max-w-md w-full text-center space-y-3"
              style={{ borderColor: 'var(--red)' }}
            >
              <h2 className="pixel-text text-xl" style={{ color: 'var(--red)' }}>
                NÃO FOI POSSÍVEL INICIAR
              </h2>
              <p className="retro-text text-sm" style={{ color: '#ffffff' }}>
                {error}
              </p>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={retryStart}
                  className="pixel-btn pixel-btn-md w-full"
                  style={{ color: '#ffffff' }}
                >
                  ↻ TENTAR NOVAMENTE
                </button>
                <button
                  type="button"
                  onClick={() => window.close()}
                  className="pixel-btn pixel-btn-md w-full"
                  style={{ color: '#ffffff' }}
                >
                  FECHAR
                </button>
              </div>
            </div>
          ) : (
            <p className="retro-text" style={{ color: '#ffffff' }}>
              Preparando partida...
            </p>
          )
        ) : (
          <div className="w-full max-w-5xl min-w-0 mx-auto">
            <div
              className="overflow-hidden"
              style={{
                border: '3px solid #2a6b3a',
                background: 'rgba(0,0,0,0.45)',
                padding: 14,
                boxShadow: '0 12px 40px rgba(0,0,0,0.45)',
              }}
            >
              <PenaltyKickGame
                sessionId={sessionId}
                rarity={player.rarity}
                position={player.position}
                playerId={player.id}
                playerName={playerNickname(player.name, player.id, player.position)}
                overwall={player.overwall}
                onShoot={(nx, ny) =>
                  penaltyShoot.mutateAsync({ sessionId, nx, ny })
                }
                onClaim={() => void handleClaim()}
                onClose={() => window.close()}
              />
            </div>
            {error && (
              <p
                className="retro-text text-center mt-3"
                style={{ color: 'var(--red)' }}
              >
                {error}
              </p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

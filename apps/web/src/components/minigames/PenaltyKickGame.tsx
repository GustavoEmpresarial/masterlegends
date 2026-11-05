import { useRef, useState, useCallback, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { motion, AnimatePresence } from 'framer-motion';
import type { PenaltyShootResultDTO } from '@mll/shared';
import { PenaltyThreeScene } from './PenaltyThreeScene';
import { GOAL_W, aimNormToWorld, type GamePhase, type ShotTarget } from './penaltyTypes';

interface PenaltyKickGameProps {
  sessionId: string;
  onShoot: (nx: number, ny: number) => Promise<PenaltyShootResultDTO>;
  onClaim: () => void;
  onClose: () => void;
  attempts?: number;
  rarity?: string | null;
  position?: string | null;
  playerId?: string;
  playerName?: string | null;
  overwall?: number;
}

interface ShotRecord {
  scored: boolean;
}

function pointerNorm(el: HTMLElement, clientX: number, clientY: number) {
  const rect = el.getBoundingClientRect();
  return {
    nx: (clientX - rect.left) / rect.width,
    ny: (clientY - rect.top) / rect.height,
  };
}

export function PenaltyKickGame({
  sessionId,
  onShoot,
  onClaim,
  onClose,
  attempts = 3,
  rarity,
  position,
  playerId,
  playerName,
  overwall = 0,
}: PenaltyKickGameProps) {
  const phaseRef = useRef<GamePhase>('aiming');
  const shootingRef = useRef(false);
  const pendingShotRef = useRef<PenaltyShootResultDTO | null>(null);
  const chargeRef = useRef(0);
  const aimRef = useRef({ nx: 0.5, ny: 0.55 });
  const stageRef = useRef<HTMLDivElement>(null);
  const chargeRaf = useRef<number | null>(null);

  const [phase, setPhase] = useState<GamePhase>('aiming');
  const [target, setTarget] = useState<ShotTarget | null>(null);
  const [goalieEnd, setGoalieEnd] = useState(0);
  const [power, setPower] = useState(0.65);
  const [charge, setCharge] = useState(0);
  const [serverScored, setServerScored] = useState<boolean | undefined>(undefined);
  const [shotsLeft, setShotsLeft] = useState(attempts);
  const [goals, setGoals] = useState(0);
  const [history, setHistory] = useState<ShotRecord[]>([]);
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const [resultText, setResultText] = useState<'GOOOL!' | 'DEFENDEU!' | null>(null);
  const [shootError, setShootError] = useState('');

  const ended = phase === 'done';
  const won = goals > 0;
  const canAim = phase === 'aiming' || phase === 'charging';

  useEffect(() => {
    return () => {
      if (chargeRaf.current != null) cancelAnimationFrame(chargeRaf.current);
    };
  }, []);

  // Release even if pointer leaves the stage while charging.
  useEffect(() => {
    if (phase !== 'charging') return;
    const onUp = () => releaseShot();
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchend', onUp);
    return () => {
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchend', onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only rebind while charging
  }, [phase]);

  const handleShotResolved = useCallback((scored: boolean) => {
    const result = pendingShotRef.current;
    if (!result) return;

    setResultText(result.scored ? 'GOOOL!' : 'DEFENDEU!');
    setPhase('result');
    phaseRef.current = 'result';

    setTimeout(() => {
      setResultText(null);
      setHover(null);
      setCharge(0);
      chargeRef.current = 0;
      if (result.finished) {
        setPhase('done');
        phaseRef.current = 'done';
      } else {
        setPhase('aiming');
        phaseRef.current = 'aiming';
        setTarget(null);
        setGoalieEnd(0);
        setServerScored(undefined);
        setPower(0.65);
      }
      pendingShotRef.current = null;
    }, 1600);
  }, []);

  const fireShot = useCallback(
    async (nx: number, ny: number, shotPower: number) => {
      if (shootingRef.current) return;
      shootingRef.current = true;
      setShootError('');

      const world = aimNormToWorld(nx, ny);
      setPower(shotPower);
      setTarget(world);
      setPhase('flying');
      phaseRef.current = 'flying';

      try {
        const result = await onShoot(nx, ny);
        pendingShotRef.current = result;
        setHistory((h) => [...h, { scored: result.scored }]);
        setGoals(result.goals);
        setShotsLeft(result.attemptsLeft);
        setServerScored(result.scored);

        const goalieX = result.scored
          ? world.x < 0
            ? GOAL_W / 4
            : world.x > 0
              ? -GOAL_W / 4
              : GOAL_W / 3
          : world.x;

        setGoalieEnd(goalieX);
      } catch {
        setShootError('Falha ao registrar chute. Segure e solte de novo.');
        setPhase('aiming');
        phaseRef.current = 'aiming';
        setTarget(null);
        setCharge(0);
        chargeRef.current = 0;
      } finally {
        shootingRef.current = false;
      }
    },
    [onShoot],
  );

  const stopChargeLoop = () => {
    if (chargeRaf.current != null) {
      cancelAnimationFrame(chargeRaf.current);
      chargeRaf.current = null;
    }
  };

  const startCharge = (nx: number, ny: number) => {
    if (phaseRef.current !== 'aiming' || shootingRef.current) return;
    aimRef.current = { nx, ny };
    setHover({ x: nx, y: ny });
    setPhase('charging');
    phaseRef.current = 'charging';
    chargeRef.current = 0.18;
    setCharge(0.18);

    const tick = () => {
      if (phaseRef.current !== 'charging') return;
      // Easy ramp then slow — sweet spot mid-high
      chargeRef.current = Math.min(1, chargeRef.current + 0.012);
      setCharge(chargeRef.current);
      chargeRaf.current = requestAnimationFrame(tick);
    };
    chargeRaf.current = requestAnimationFrame(tick);
  };

  const releaseShot = () => {
    if (phaseRef.current !== 'charging') return;
    stopChargeLoop();
    const { nx, ny } = aimRef.current;
    const p = Math.max(0.28, chargeRef.current);
    void fireShot(nx, ny, p);
  };

  const updateAim = (nx: number, ny: number) => {
    if (!canAim) return;
    aimRef.current = { nx, ny };
    setHover({ x: nx, y: ny });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 retro-text text-sm">
        <div className="flex gap-4">
          <span style={{ color: '#ffffff' }}>
            CHUTES{' '}
            <span className="pixel-text" style={{ color: 'var(--cyan)' }}>
              {shotsLeft}
            </span>
          </span>
          <span style={{ color: '#ffffff' }}>
            GOLS{' '}
            <span className="pixel-text" style={{ color: 'var(--green)' }}>
              {goals}
            </span>
          </span>
        </div>
        <span className="text-xs" style={{ color: '#ffffff' }}>
          {phase === 'charging'
            ? 'Solte para chutar!'
            : 'Segure no gol pra carregar · solte pra chutar'}
        </span>
      </div>

      <div
        ref={stageRef}
        className="relative mx-auto select-none touch-none"
        style={{
          width: '100%',
          aspectRatio: '16 / 10',
          border: '3px solid #2a6b3a',
          boxShadow: 'inset 0 0 40px rgba(0,0,0,0.55), 0 8px 0 rgba(0,0,0,0.35)',
          borderRadius: 6,
          cursor: canAim ? 'crosshair' : 'default',
          overflow: 'hidden',
          background: 'radial-gradient(ellipse at 50% 30%, #123048 0%, #050a12 70%)',
        }}
        onMouseMove={(e) => {
          if (!stageRef.current || !canAim) return;
          const { nx, ny } = pointerNorm(stageRef.current, e.clientX, e.clientY);
          updateAim(nx, ny);
        }}
        onMouseLeave={() => {
          if (phase === 'aiming') setHover(null);
        }}
        onMouseDown={(e) => {
          if (!stageRef.current || e.button !== 0) return;
          const { nx, ny } = pointerNorm(stageRef.current, e.clientX, e.clientY);
          startCharge(nx, ny);
        }}
        onMouseUp={() => releaseShot()}
        onTouchStart={(e) => {
          const t = e.touches[0];
          if (!t || !stageRef.current) return;
          e.preventDefault();
          const { nx, ny } = pointerNorm(stageRef.current, t.clientX, t.clientY);
          startCharge(nx, ny);
        }}
        onTouchMove={(e) => {
          const t = e.touches[0];
          if (!t || !stageRef.current || !canAim) return;
          e.preventDefault();
          const { nx, ny } = pointerNorm(stageRef.current, t.clientX, t.clientY);
          updateAim(nx, ny);
        }}
        onTouchEnd={(e) => {
          e.preventDefault();
          releaseShot();
        }}
      >
        <Canvas
          shadows
          dpr={[1, 1.5]}
          gl={{
            antialias: true,
            powerPreference: 'high-performance',
            stencil: false,
            alpha: false,
          }}
          camera={{ fov: 28, near: 0.1, far: 90, position: [0, 0.95, 4.5] }}
          style={{ width: '100%', height: '100%', display: 'block', touchAction: 'none' }}
        >
          <PenaltyThreeScene
            phase={phase}
            target={target}
            goalieEnd={goalieEnd}
            power={power}
            serverScored={serverScored}
            onShotResolved={handleShotResolved}
            shooterRarity={rarity}
            shooterPosition={position}
            shooterSeed={playerId ?? sessionId}
            shooterName={playerName}
            shooterOverwall={overwall}
          />
        </Canvas>

        {canAim && hover && (
          <div
            aria-hidden
            className="absolute pointer-events-none"
            style={{
              left: `${hover.x * 100}%`,
              top: `${hover.y * 100}%`,
              width: phase === 'charging' ? 44 + charge * 18 : 40,
              height: phase === 'charging' ? 44 + charge * 18 : 40,
              transform: 'translate(-50%, -50%)',
              border: `2px solid ${charge > 0.85 ? '#ff6b4a' : '#ffd400'}`,
              borderRadius: '50%',
              boxShadow: `0 0 ${10 + charge * 16}px ${charge > 0.85 ? '#ff6b4a' : '#ffd400'}`,
              transition: 'width 60ms linear, height 60ms linear',
            }}
          >
            <div
              style={{
                position: 'absolute',
                left: '50%',
                top: 0,
                bottom: 0,
                width: 2,
                marginLeft: -1,
                background: 'currentColor',
                opacity: 0.7,
                color: charge > 0.85 ? '#ff6b4a' : '#ffd400',
              }}
            />
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: 0,
                right: 0,
                height: 2,
                marginTop: -1,
                background: 'currentColor',
                opacity: 0.7,
                color: charge > 0.85 ? '#ff6b4a' : '#ffd400',
              }}
            />
          </div>
        )}

        {/* Power bar */}
        <AnimatePresence>
          {phase === 'charging' && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="absolute left-4 right-4 bottom-4 pointer-events-none"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="retro-text text-[10px]" style={{ color: '#fff' }}>
                  FORÇA
                </span>
                <span
                  className="pixel-text text-xs"
                  style={{ color: charge > 0.85 ? '#ff6b4a' : '#ffd400' }}
                >
                  {Math.round(charge * 100)}%
                </span>
              </div>
              <div
                style={{
                  height: 12,
                  background: 'rgba(0,0,0,0.55)',
                  border: '2px solid rgba(255,255,255,0.25)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${charge * 100}%`,
                    height: '100%',
                    background:
                      charge > 0.85
                        ? 'linear-gradient(90deg, #ffd400, #ff6b4a)'
                        : 'linear-gradient(90deg, #2ecc71, #ffd400)',
                    boxShadow: '0 0 12px rgba(255,212,0,0.45)',
                  }}
                />
              </div>
              <p className="retro-text text-[10px] mt-1 text-center" style={{ color: '#ffffff' }}>
                Cantos = mais difícil · Meio = goleiro cobre melhor
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {resultText && (
            <motion.div
              key={resultText}
              initial={{ scale: 0.4, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 1.25, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 16 }}
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
              style={{
                background:
                  resultText === 'GOOOL!'
                    ? 'radial-gradient(circle, rgba(255,212,0,0.18) 0%, transparent 55%)'
                    : 'radial-gradient(circle, rgba(255,70,70,0.16) 0%, transparent 55%)',
              }}
            >
              <span
                className="pixel-text"
                style={{
                  fontSize: 'clamp(32px, 7vw, 64px)',
                  color: resultText === 'GOOOL!' ? '#ffd400' : '#ff4757',
                  textShadow: '0 0 22px currentColor, 4px 4px 0 #000',
                  letterSpacing: '0.06em',
                }}
              >
                {resultText}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {shootError && (
        <p className="retro-text text-center text-sm" style={{ color: 'var(--red)' }}>
          {shootError}
        </p>
      )}

      <div className="flex gap-2 justify-center">
        {Array.from({ length: attempts }).map((_, i) => {
          const s = history[i];
          return (
            <div
              key={i}
              className="w-11 h-11 flex items-center justify-center pixel-box-light"
              style={{
                borderColor: s ? (s.scored ? 'var(--green)' : 'var(--red)') : 'rgba(255,255,255,0.2)',
                background: s
                  ? s.scored
                    ? 'rgba(0,200,80,0.12)'
                    : 'rgba(255,70,70,0.12)'
                  : 'var(--bg-medium)',
              }}
            >
              <span style={{ fontSize: 18 }}>{s ? <i className={`bi ${s.scored ? 'bi-shield-fill' : 'bi-hand-index-thumb-fill'}`} aria-hidden /> : '·'}</span>
            </div>
          );
        })}
      </div>

      {ended && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="pixel-card text-center space-y-3"
          style={{ borderColor: won ? 'var(--green)' : 'var(--red)' }}
        >
          <h3 className="pixel-text text-xl" style={{ color: won ? 'var(--green)' : 'var(--red)' }}>
            {won ? <><i className="bi bi-trophy-fill" aria-hidden /> VITÓRIA!</> : <><i className="bi bi-emoji-frown-fill" aria-hidden /> SEM SORTE</>}
          </h3>
          <p className="retro-text text-sm" style={{ color: '#ffffff' }}>
            {won
              ? `Você marcou ${goals} gol${goals > 1 ? 's' : ''}! O jogador vai recuperar stamina.`
              : 'O goleiro defendeu tudo. Ajuste a mira nos cantos e a força.'}
          </p>
          {won ? (
            <button
              type="button"
              className="pixel-btn pixel-btn-green pixel-btn-md w-full"
              style={{ color: '#ffffff' }}
              onClick={onClaim}
            >
              <i className="bi bi-lightning-charge-fill" aria-hidden /> RECEBER RECUPERAÇÃO
            </button>
          ) : (
            <button
              type="button"
              className="pixel-btn pixel-btn-md w-full"
              style={{ color: '#ffffff' }}
              onClick={onClose}
            >
              FECHAR
            </button>
          )}
        </motion.div>
      )}

      <input type="hidden" name="sessionId" value={sessionId} readOnly />
    </div>
  );
}

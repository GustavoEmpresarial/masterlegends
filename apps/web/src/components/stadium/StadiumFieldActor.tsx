import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import type { LineupPlayerDTO } from '@mll/shared';
import { StadiumPixelBoneco } from './StadiumPixelBoneco';
import { useStadiumKick } from './StadiumKickContext';
import { shortPlayerNickname } from '../../lib/playerNickname';
import { getBonecoMotion, rarityGlowCss, type BonecoPose } from './stadiumBonecoTheme';

interface StadiumFieldActorProps {
  slotId: string;
  player: LineupPlayerDTO;
  index: number;
  /** Live match animations (Estádio). Off on Vestiário. */
  livePlay?: boolean;
}

/** Animated field puppet: wander / run / kick synced to the stadium ball. */
export function StadiumFieldActor({
  slotId,
  player,
  index,
  livePlay = true,
}: StadiumFieldActorProps) {
  const reduceMotion = useReducedMotion();
  const { kickSlotId } = useStadiumKick();
  const params = useMemo(() => getBonecoMotion(player.rarity), [player.rarity]);
  const glow = rarityGlowCss(player.rarity);
  const phase = index * 0.41;

  const [pose, setPose] = useState<BonecoPose>('idle');
  const [facing, setFacing] = useState<1 | -1>(index % 2 === 0 ? 1 : -1);
  const kickingRef = useRef(false);

  useEffect(() => {
    if (!livePlay || reduceMotion) return;
    if (kickSlotId !== slotId) return;

    kickingRef.current = true;
    setPose('kick');
    const t = window.setTimeout(() => {
      kickingRef.current = false;
      setPose('run');
    }, params.kickHoldMs);
    return () => window.clearTimeout(t);
  }, [kickSlotId, slotId, livePlay, reduceMotion, params.kickHoldMs]);

  useEffect(() => {
    if (!livePlay || reduceMotion) {
      setPose('idle');
      return;
    }

    let cancelled = false;
    let timer: number;

    const loop = (next: BonecoPose) => {
      if (cancelled) return;
      if (!kickingRef.current) {
        setPose(next);
        if (next === 'run') {
          setFacing((f) => (Math.random() > 0.4 ? ((f * -1) as 1 | -1) : f));
        }
      }
      const waitSec = next === 'run' ? params.runCycleSec : params.idleCycleSec;
      timer = window.setTimeout(
        () => loop(next === 'run' ? 'idle' : 'run'),
        (waitSec + phase * 0.12) * 1000,
      );
    };

    timer = window.setTimeout(() => loop('run'), (0.5 + phase) * 1000);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [livePlay, reduceMotion, params.runCycleSec, params.idleCycleSec, phase]);

  const wander = livePlay && !reduceMotion;
  const wanderPx = Math.round(params.wanderRadiusPct * 2.8);

  return (
    <div
      className="stadium-field-actor"
      style={{
        position: 'relative',
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      {wander && (
        <motion.div
          className="stadium-field-actor__shadow"
          aria-hidden
          animate={{
            scaleX: pose === 'run' ? [1, 0.7, 1, 1.15, 1] : [1, 0.88, 1],
            opacity: pose === 'kick' ? 0.2 : [0.5, 0.28, 0.5],
          }}
          transition={{
            duration: pose === 'run' ? 0.38 : 2.1,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: phase,
          }}
          style={{
            position: 'absolute',
            bottom: 18,
            left: '50%',
            translateX: '-50%',
            width: '70%',
            height: 8,
            borderRadius: '50%',
            background: 'rgba(0,0,0,0.5)',
            filter: 'blur(3px)',
            pointerEvents: 'none',
            zIndex: 0,
          }}
        />
      )}

      <motion.div
        style={{ position: 'relative', zIndex: 1 }}
        animate={
          wander
            ? {
                x:
                  pose === 'run'
                    ? [-wanderPx, wanderPx * 0.7, -wanderPx * 0.5, wanderPx, -wanderPx]
                    : [-3, 0, 3, 0, -3],
                y:
                  pose === 'kick'
                    ? [0, -10, 0]
                    : pose === 'run'
                      ? [0, -params.bobAmpPx, 0, params.bobAmpPx * 0.4, 0]
                      : [0, -params.bobAmpPx * 0.55, 0, 2, 0],
              }
            : { x: 0, y: 0 }
        }
        transition={
          wander
            ? {
                duration:
                  pose === 'kick'
                    ? 0.32
                    : pose === 'run'
                      ? params.runCycleSec
                      : params.idleCycleSec,
                repeat: pose === 'kick' ? 0 : Infinity,
                ease: 'easeInOut',
                delay: phase * 0.08,
              }
            : undefined
        }
      >
        {params.showTrail && wander && pose === 'run' && (
          <div
            className="stadium-boneco__trail"
            style={{ background: `linear-gradient(90deg, transparent, ${glow}55)` }}
            aria-hidden
          />
        )}

        <StadiumPixelBoneco
          rarity={player.rarity}
          position={player.position}
          pose={reduceMotion ? 'idle' : pose}
          facing={facing}
          size={68}
          imageUrl={player.imageUrl}
          seed={player.id}
        />
      </motion.div>

      <div
        className="stadium-field-actor__label"
        style={{ borderColor: `${glow}aa`, color: glow }}
      >
        <span className="stadium-field-actor__name" style={{ color: glow }}>
          {shortPlayerNickname(player.name, player.id, player.position)}
        </span>
        <span className="stadium-field-actor__ovr">{player.overwall}</span>
      </div>
    </div>
  );
}

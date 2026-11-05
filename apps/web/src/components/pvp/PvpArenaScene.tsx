import { useEffect, useMemo, useRef, useState } from 'react';
import { buildRivalSlots, type StadiumSlotViewDTO } from '@mll/shared';
import { useClub, useStadiumView } from '../../hooks/useApi';
import { drawPlayfieldBall, drawPlayfieldPlayer, type PlayfieldActor } from '../stadium/stadiumPlayfieldDraw';
import { planAttack, sampleAttack, sampleFlow, ATTACK_SECONDS, REPLAY_LABEL, REPLAY_SECONDS, replayCameraForPlay, type AttackPlan, type FilmBody, type FilmRosterPlayer, type FilmSide, type ReplayCamera } from './pvpFilm';
import { teamPower, winnerOf } from './pvpMatch';
import { createPvpStadium } from './pvpStadium3d';

const HOME_XI: Array<{ id: string; position: 'GK' | 'DEF' | 'LAT' | 'MID' | 'FW'; xPct: number; yPct: number }> = [
  { id: 'h-gk', position: 'GK', xPct: 10, yPct: 50 },
  { id: 'h-lb', position: 'LAT', xPct: 22, yPct: 16 },
  { id: 'h-lcb', position: 'DEF', xPct: 24, yPct: 36 },
  { id: 'h-rcb', position: 'DEF', xPct: 24, yPct: 64 },
  { id: 'h-rb', position: 'LAT', xPct: 22, yPct: 84 },
  { id: 'h-lm', position: 'MID', xPct: 36, yPct: 28 },
  { id: 'h-cm', position: 'MID', xPct: 34, yPct: 50 },
  { id: 'h-rm', position: 'MID', xPct: 36, yPct: 72 },
  { id: 'h-lw', position: 'FW', xPct: 46, yPct: 22 },
  { id: 'h-st', position: 'FW', xPct: 48, yPct: 50 },
  { id: 'h-rw', position: 'FW', xPct: 46, yPct: 78 },
];

const ROLE_ORDER: Record<string, number> = { GK: 0, DEF: 1, LAT: 2, MID: 3, FW: 4 };


function buildRoster(slots: StadiumSlotViewDTO[] | undefined): FilmRosterPlayer[] {
  const starters = (slots ?? [])
    .filter((row) => row.player && row.slot.role !== 'DECOR')
    .sort((a, b) => {
      const ar = ROLE_ORDER[a.slot.role ?? a.player?.position ?? ''] ?? 9;
      const br = ROLE_ORDER[b.slot.role ?? b.player?.position ?? ''] ?? 9;
      return ar - br || a.slot.yPct - b.slot.yPct;
    });

  const home: FilmRosterPlayer[] = HOME_XI.map((spot, index) => {
    const player = starters[index]?.player;
    const overwall = player && Number.isFinite(player.overwall) ? player.overwall : 40;
    return {
      id: player ? `home-${player.id}` : spot.id,
      side: 'home',
      position: player?.position || spot.position,
      rarity: player?.rarity ?? 'common',
      overwall,
      seed: player?.id ?? spot.id,
      slotRole: spot.position,
      name: (player?.name?.trim() || player?.position || spot.position).slice(0, 24),
      finishing: (player?.attributes?.finalizacao ?? overwall) / Math.max(1, overwall),
      goalkeeping: (player?.attributes?.goleiro ?? overwall) / Math.max(1, overwall),
      age: player?.age != null && Number.isFinite(player.age) ? player.age : null,
      xPct: spot.xPct,
      yPct: spot.yPct,
      index,
    };
  });

  const away: FilmRosterPlayer[] = buildRivalSlots().map((row, index) => {
    const player = row.player;
    const overwall = player && Number.isFinite(player.overwall) ? player.overwall : 70;
    return {
      id: row.slot.id,
      side: 'away' as const,
      position: player?.position ?? 'MID',
      rarity: player?.rarity ?? 'rare',
      overwall,
      seed: player?.id || row.slot.id,
      slotRole: row.slot.role ?? player?.position ?? 'MID',
      name: (player?.name?.trim() || player?.position || 'Rival').slice(0, 24),
      finishing: (player?.attributes?.finalizacao ?? overwall) / Math.max(1, overwall),
      goalkeeping: (player?.attributes?.goleiro ?? overwall) / Math.max(1, overwall),
      age: player?.age != null && Number.isFinite(player.age) ? player.age : null,
      xPct: row.slot.xPct,
      yPct: row.slot.yPct,
      index: index + home.length,
    };
  });

  return [...home, ...away];
}

interface Sim {
  playing: boolean;
  done: boolean;
  side: FilmSide;
  elapsed: number;
  settled: boolean;
  plan: AttackPlan | null;
  score: { home: number; away: number };
  call: string;
  homePower: number;
  awayPower: number;
  netEnd: 'left' | 'right' | null;
  netUntil: number;
  playIndex: number;
  replayOn: boolean;
  replayNet: boolean;
}

export function PvpArenaScene() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const filmRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const { data: view } = useStadiumView();
  const { data: club } = useClub();
  const roster = useMemo(() => buildRoster(view?.slots), [view?.slots]);
  const homePower = useMemo(
    () => teamPower(
      (view?.slots ?? [])
        .filter((row) => row.player && row.slot.role !== 'DECOR')
        .map((row) => row.player?.overwall ?? 0),
    ),
    [view?.slots],
  );
  const awayPower = useMemo(
    () => teamPower(buildRivalSlots().map((row) => row.player?.overwall ?? 0)),
    [],
  );

  const [score, setScore] = useState({ home: 0, away: 0 });
  const [phase, setPhase] = useState<'ready' | 'live' | 'done'>('ready');
  const [call, setCall] = useState('');
  const [replay, setReplay] = useState('');
  const rosterRef = useRef(roster);
  const powersRef = useRef({ homePower, awayPower });
  const simRef = useRef<Sim>({
    playing: false,
    done: false,
    side: 'home',
    elapsed: 0,
    settled: false,
    plan: null,
    score: { home: 0, away: 0 },
    call: '',
    homePower,
    awayPower,
    netEnd: null,
    netUntil: 0,
    playIndex: 0,
    replayOn: false,
    replayNet: false,
  });
  rosterRef.current = roster;
  powersRef.current = { homePower, awayPower };

  const startMatch = () => {
    const powers = powersRef.current;
    const sim = simRef.current;
    sim.playing = true;
    sim.done = false;
    sim.side = 'home';
    sim.elapsed = 0;
    sim.settled = false;
    sim.score = { home: 0, away: 0 };
    sim.call = '';
    sim.netEnd = null;
    sim.netUntil = 0;
    sim.playIndex = 0;
    sim.replayOn = false;
    sim.replayNet = false;
    sim.homePower = powers.homePower;
    sim.awayPower = powers.awayPower;
    sim.plan = planAttack('home', rosterRef.current, powers.homePower, powers.awayPower);
    setScore({ home: 0, away: 0 });
    setCall('');
    setReplay('');
    setPhase('live');
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const film = filmRef.current;
    if (!canvas || !film) return;
    const fctx = film.getContext('2d');
    if (!fctx) return;
    const stadium = createPvpStadium(canvas);
    let raf = 0;
    let last = performance.now();

    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      const sim = simRef.current;
      const people = rosterRef.current;
      if (sim.playing && !sim.done && sim.plan) {
        sim.elapsed += dt;
        const limit = ATTACK_SECONDS + REPLAY_SECONDS;
        if (sim.elapsed >= ATTACK_SECONDS && !sim.settled) {
          sim.settled = true;
          sim.call = sim.plan.result === 'goal'
            ? 'GOL'
            : sim.plan.shotY !== 50
              ? 'TRAVE'
              : sim.plan.result === 'save'
                ? 'DEFESA'
                : 'PRA FORA';
          if (sim.plan.result === 'goal') {
            sim.score = {
              home: sim.score.home + (sim.side === 'home' ? 1 : 0),
              away: sim.score.away + (sim.side === 'away' ? 1 : 0),
            };
            sim.netEnd = sim.side === 'home' ? 'right' : 'left';
            sim.netUntil = now + 1700;
            setScore({ ...sim.score });
          }
          setCall(sim.call);
        }
        if (sim.elapsed >= ATTACK_SECONDS && !sim.replayOn) {
          sim.replayOn = true;
          setReplay(REPLAY_LABEL[replayCameraForPlay(sim.playIndex)]);
        }
        if (
          sim.replayOn
          && sim.plan.result === 'goal'
          && !sim.replayNet
          && (sim.elapsed - ATTACK_SECONDS) / REPLAY_SECONDS > 0.82
        ) {
          sim.replayNet = true;
          sim.netEnd = sim.side === 'home' ? 'right' : 'left';
          sim.netUntil = now + 1700;
        }
        if (sim.elapsed >= limit) {
          const won = winnerOf(sim.score.home, sim.score.away);
          if (won) {
            sim.done = true;
            sim.playing = false;
            sim.call = won === 'home' ? 'VITÓRIA' : 'DERROTA';
            setCall(sim.call);
            setReplay('');
            setPhase('done');
          } else {
            sim.side = sim.side === 'home' ? 'away' : 'home';
            sim.elapsed = 0;
            sim.settled = false;
            sim.call = '';
            sim.replayOn = false;
            sim.replayNet = false;
            sim.playIndex += 1;
            setReplay('');
            sim.plan = planAttack(
              sim.side,
              people,
              sim.side === 'home' ? sim.homePower : sim.awayPower,
              sim.side === 'home' ? sim.awayPower : sim.homePower,
            );
            setCall('');
          }
        }
      }

      const flow = sampleFlow(people, now / 1000);
      const replayCam: 'live' | ReplayCamera = sim.playing && sim.plan && sim.replayOn
        ? replayCameraForPlay(sim.playIndex)
        : 'live';
      const frame = (() => {
        if (!sim.plan || !sim.playing) return flow;
        if (sim.replayOn) {
          const ru = Math.min(1, Math.max(0, (sim.elapsed - ATTACK_SECONDS) / REPLAY_SECONDS));
          return sampleAttack(people, sim.plan, 0.22 + ru * 0.78);
        }
        const u = Math.min(1, sim.elapsed / ATTACK_SECONDS);
        if (u < 0.28) return flow;
        const shot = sampleAttack(people, sim.plan, (u - 0.28) / 0.72);
        const mix = Math.min(1, (u - 0.28) / 0.18);
        return {
          players: flow.players.map((body) => {
            const next = shot.players.find((p) => p.id === body.id) ?? body;
            return {
              id: body.id,
              xPct: body.xPct + (next.xPct - body.xPct) * mix,
              yPct: body.yPct + (next.yPct - body.yPct) * mix,
              pose: mix > 0.5 ? next.pose : body.pose,
              facing: next.facing,
            } satisfies FilmBody;
          }),
          ball: {
            xPct: flow.ball.xPct + (shot.ball.xPct - flow.ball.xPct) * mix,
            yPct: flow.ball.yPct + (shot.ball.yPct - flow.ball.yPct) * mix,
          },
        };
      })();

      const wrap = wrapRef.current;
      const rect = wrap?.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const cssW = Math.max(1, Math.floor(rect?.width || 16));
      const cssH = Math.max(1, Math.floor(rect?.height || 9));
      stadium.resize(cssW, cssH, dpr);
      const push = sim.playing && sim.plan
        ? Math.min(1, Math.max(0, (sim.elapsed / ATTACK_SECONDS - 0.28) / 0.45))
        : 0;
      const shaking = now < sim.netUntil;
      stadium.render(now, dt, {
        xPct: frame.ball.xPct,
        yPct: frame.ball.yPct,
        push,
        netEnd: shaking ? sim.netEnd : null,
        netAge: shaking ? (1700 - (sim.netUntil - now)) / 1000 : -1,
        camera: replayCam,
        attacking: sim.side,
      });
      if (film.width !== Math.floor(cssW * dpr) || film.height !== Math.floor(cssH * dpr)) {
        film.width = Math.floor(cssW * dpr);
        film.height = Math.floor(cssH * dpr);
        film.style.width = `${cssW}px`;
        film.style.height = `${cssH}px`;
      }
      fctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      fctx.clearRect(0, 0, cssW, cssH);
      fctx.imageSmoothingEnabled = false;
      const toScreen = (xPct: number, yPct: number) => stadium.project(xPct, yPct);
      const unit = toScreen(frame.ball.xPct, frame.ball.yPct).pxPerUnit;
      const liveScale = Math.max(2.35, Math.min(2.95, cssH / 220));
      const dollScale = (pxPerUnit: number) => {
        if (replayCam === 'live') return liveScale;
        if (replayCam === 'trave') return Math.max(0.8, Math.min(2.05, pxPerUnit * 0.034));
        return Math.max(1.15, Math.min(2.55, pxPerUnit * 1.2));
      };
      const scale = dollScale(unit);
      const drawn = frame.players
        .map((body) => {
          const src = people.find((p) => p.id === body.id);
          const pt = toScreen(body.xPct, body.yPct);
          return { body, src, pt };
        })
        .filter((row) => row.src)
        .sort((a, b) => a.pt.y - b.pt.y);

      for (const row of drawn) {
        const src = row.src!;
        const actor: PlayfieldActor = {
          slotId: src.id,
          xPct: row.body.xPct,
          yPct: row.body.yPct,
          rarity: src.rarity,
          position: src.position,
          slotRole: src.slotRole,
          name: src.name,
          overwall: src.overwall,
          finishing: src.finishing,
          goalkeeping: src.goalkeeping,
          age: src.age,
          seed: src.seed,
          index: src.index,
          side: src.side,
        };
        drawPlayfieldPlayer(fctx, actor, row.pt.x, row.pt.y, now, row.body.pose, row.body.facing, dollScale(row.pt.pxPerUnit), src.name);
      }
      const ball = toScreen(frame.ball.xPct, frame.ball.yPct);
      const inNet = frame.ball.xPct > 100 || frame.ball.xPct < 0;
      const owner = inNet
        ? undefined
        : frame.players.find((p) => Math.hypot(p.xPct - frame.ball.xPct, p.yPct - frame.ball.yPct) < 1.5);
      const bx = ball.x + (owner ? owner.facing * scale * 2.4 : 0);
      const by = ball.y + (inNet ? 0 : scale * 12.5);
      drawPlayfieldBall(fctx, bx, by, now, scale);

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      stadium.dispose();
    };
  }, []);

  const homeName = club?.name ?? 'CASA';
  const playing = phase === 'live' || phase === 'done';

  return (
    <div className="w-full" style={{ background: '#070b16' }}>
      <div ref={wrapRef} className="relative w-full" style={{ lineHeight: 0, width: '100%', aspectRatio: '16 / 9', background: '#070b16' }}>
        <canvas
          ref={canvasRef}
          className="block h-full w-full"
          style={{ imageRendering: 'auto' }}
        />
        <canvas
          ref={filmRef}
          className="pointer-events-none absolute inset-0 z-[2]"
          style={{ imageRendering: 'auto' }}
          aria-hidden
        />
        <div className="absolute inset-x-0 top-2 z-30 flex flex-col items-center gap-1" style={{ lineHeight: 'normal' }}>
          <div className="pixel-text" style={{ color: '#f8fafc', fontSize: 18, letterSpacing: '0.08em', textShadow: '0 2px 0 #000' }} data-testid="pvp-score">
            {playing ? `${score.home} — ${score.away}` : '0 — 0'}
          </div>
          {replay && phase === 'live' && (
            <div className="pixel-text" data-testid="pvp-replay" style={{ color: '#f8fafc', background: '#b91c1c', fontSize: 11, letterSpacing: '0.12em', padding: '3px 8px', textShadow: '0 1px 0 #000' }}>
              {replay}
            </div>
          )}
          <p className="pixel-text text-center" style={{ color: '#ffd600', fontSize: 10, textShadow: '0 1px 0 #000' }}>
            {phase === 'live'
              ? (call || 'A PARTIDA ANDA SOZINHA')
              : phase === 'done'
                ? (call === 'VITÓRIA' ? 'VOCÊ GANHOU. 3 GOLS.' : 'O RIVAL GANHOU. 3 GOLS.')
                : 'PRIMEIRO A FAZER 3 GOLS'}
          </p>
          {phase !== 'live' && (
            <button type="button" className="pixel-btn pixel-btn-green" onClick={startMatch} data-testid="pvp-start">
              {phase === 'done' ? 'JOGAR DE NOVO' : 'JOGAR'}
            </button>
          )}
        </div>
        <div className="absolute left-3 bottom-2 pixel-text" style={{ fontSize: 10, color: '#ffd600', textShadow: '0 1px 0 #000' }}>
          {homeName}
        </div>
        <div className="absolute right-3 bottom-2 pixel-text" style={{ fontSize: 10, color: '#ff3d00', textShadow: '0 1px 0 #000' }}>
          RIVAL FC
        </div>
        {call && phase === 'live' && (
          <div
            className="absolute left-1/2 pixel-text"
            style={{ top: '46%', transform: 'translate(-50%, -50%)', color: call === 'GOL' ? '#ffd600' : '#ff3d00', fontSize: 22, zIndex: 40, textShadow: '0 2px 0 #000' }}
          >
            {call}
          </div>
        )}
      </div>
    </div>
  );
}

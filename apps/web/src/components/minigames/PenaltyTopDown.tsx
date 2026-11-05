import { useCallback, useEffect, useRef, useState } from 'react';
import type { PenaltyShootResultDTO } from '@mll/shared';

type Phase = 'aiming' | 'charging' | 'runup' | 'kick' | 'flying' | 'result' | 'done';

interface PenaltyTopDownProps {
  onShoot: (nx: number, ny: number) => Promise<PenaltyShootResultDTO>;
  onClaim: () => void;
  attempts?: number;
  rarity?: string | null;
  playerName?: string | null;
}

const L = {
  pitch: { x: 0.03, y: 0.08, w: 0.94, h: 0.84 },
  goal: { x: 0.86, y: 0.28, w: 0.11, h: 0.44 },
  box: { x: 0.48, y: 0.18, w: 0.38, h: 0.64 },
  six: { x: 0.72, y: 0.32, w: 0.14, h: 0.36 },
  spot: { x: 0.62, y: 0.5 },
  runFrom: { x: 0.5, y: 0.58 },
  runTo: { x: 0.595, y: 0.515 },
};

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}
function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}
function easeOut(t: number) {
  return 1 - (1 - t) ** 3;
}
function easeInOut(t: number) {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}

function kitFromRarity(rarity?: string | null) {
  const r = String(rarity ?? 'legendary').toLowerCase();
  if (r.includes('myth')) return '#00d4aa';
  if (r.includes('legend')) return '#c04848';
  if (r.includes('epic')) return '#e0b028';
  if (r.includes('super')) return '#9070c8';
  if (r.includes('rare')) return '#5888d8';
  if (r.includes('uncommon')) return '#65a30d';
  return '#c04848';
}

/**
 * Pênalti 2D vista de cima — campo horizontal, gol codado, bonecos top-down.
 */
export function PenaltyTopDown({
  onShoot,
  onClaim,
  attempts = 3,
  rarity,
  playerName,
}: PenaltyTopDownProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const phaseRef = useRef<Phase>('aiming');
  const aimRef = useRef({ nx: 0.5, ny: 0.5 });
  const shotAimRef = useRef<{ nx: number; ny: number } | null>(null);
  const scoredRef = useRef<boolean | undefined>(undefined);
  const busyRef = useRef(false);
  const chargeRef = useRef(0);
  const holdRef = useRef(false);
  const animRef = useRef({ run: 0, kick: 0, fly: 0, t0: 0 });

  const [phase, setPhase] = useState<Phase>('aiming');
  const [charge, setCharge] = useState(0);
  const [shotsLeft, setShotsLeft] = useState(attempts);
  const [goals, setGoals] = useState(0);
  const [banner, setBanner] = useState<'GOOOL!' | 'DEFENDEU!' | null>(null);

  const setPhaseBoth = (next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  };

  const finishRound = useCallback((result: PenaltyShootResultDTO) => {
    setBanner(result.scored ? 'GOOOL!' : 'DEFENDEU!');
    setPhaseBoth('result');
    window.setTimeout(() => {
      setBanner(null);
      shotAimRef.current = null;
      scoredRef.current = undefined;
      chargeRef.current = 0;
      setCharge(0);
      animRef.current = { run: 0, kick: 0, fly: 0, t0: 0 };
      if (result.finished) setPhaseBoth('done');
      else setPhaseBoth('aiming');
      busyRef.current = false;
    }, 1100);
  }, []);

  const fire = useCallback(
    async (nx: number, ny: number) => {
      if (busyRef.current || phaseRef.current !== 'charging') return;
      busyRef.current = true;
      holdRef.current = false;
      shotAimRef.current = { nx, ny };
      animRef.current = { run: 0, kick: 0, fly: 0, t0: performance.now() };
      setPhaseBoth('runup');

      let result: PenaltyShootResultDTO | null = null;
      const api = onShoot(nx, ny)
        .then((res) => {
          result = res;
          scoredRef.current = res.scored;
          setGoals(res.goals);
          setShotsLeft(res.attemptsLeft);
          return res;
        })
        .catch(() => {
          setPhaseBoth('aiming');
          busyRef.current = false;
          return null;
        });

      await new Promise((r) => setTimeout(r, 520));
      if (phaseRef.current !== 'runup') return;
      setPhaseBoth('kick');
      await new Promise((r) => setTimeout(r, 180));
      if (phaseRef.current !== 'kick') return;
      setPhaseBoth('flying');

      const res = result ?? (await api);
      if (!res) return;
      await new Promise((r) => setTimeout(r, 700));
      finishRound(res);
    },
    [finishRound, onShoot],
  );

  useEffect(() => {
    if (phase !== 'charging') return;
    let raf = 0;
    const t0 = performance.now();
    const loop = (now: number) => {
      const t = clamp((now - t0) / 800, 0, 1);
      chargeRef.current = t;
      setCharge(t);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const up = () => {
      if (phaseRef.current === 'charging') void fire(aimRef.current.nx, aimRef.current.ny);
    };
    window.addEventListener('mouseup', up);
    window.addEventListener('touchend', up);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('mouseup', up);
      window.removeEventListener('touchend', up);
    };
  }, [phase, fire]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const parent = canvas?.parentElement;
    if (!canvas || !parent) return;

    let raf = 0;
    let alive = true;
    let w = 0;
    let h = 0;
    const shirt = kitFromRarity(rarity);
    const label = (playerName || 'VOCÊ').slice(0, 12);

    const resize = () => {
      const rect = parent.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = Math.max(1, Math.floor(rect.width));
      h = Math.max(1, Math.floor(rect.height));
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.imageSmoothingEnabled = false;
      }
    };

    const box = (b: { x: number; y: number; w?: number; h?: number }) => ({
      x: w * b.x,
      y: h * b.y,
      ww: w * (b.w ?? 0),
      hh: h * (b.h ?? 0),
    });

    const drawPlayer = (
      ctx: CanvasRenderingContext2D,
      x: number,
      y: number,
      facing: number,
      color: string,
      pose: 'idle' | 'run' | 'kick',
      name: string,
      now: number,
      isGk = false,
    ) => {
      const bodyW = Math.max(22, h * 0.055);
      const bodyH = Math.max(30, h * 0.075);
      const bob = pose === 'run' ? Math.sin(now * 0.02) * 2 : pose === 'kick' ? -3 : Math.sin(now * 0.004);
      const lean = pose === 'kick' ? 0.28 : pose === 'run' ? Math.sin(now * 0.02) * 0.08 : 0;
      ctx.save();
      ctx.translate(x, y + bob);
      ctx.rotate(facing + lean);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.ellipse(0, bodyH * 0.42, bodyW * 0.55, bodyH * 0.18, 0, 0, Math.PI * 2);
      ctx.fill();
      const stride = pose === 'run' ? Math.sin(now * 0.028) * bodyW * 0.35 : 0;
      const kickLeg = pose === 'kick' ? bodyW * 0.55 : 0;
      ctx.fillStyle = isGk ? '#0369a1' : '#111827';
      ctx.beginPath();
      ctx.ellipse(-bodyW * 0.22, stride + kickLeg * 0.2, bodyW * 0.18, bodyH * 0.28, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(bodyW * 0.22, -stride + kickLeg, bodyW * 0.18, bodyH * 0.28, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(0, 0, bodyW * 0.42, bodyH * 0.38, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#0b1020';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#e8b888';
      const arm = pose === 'kick' ? bodyW * 0.4 : pose === 'run' ? stride * 0.4 : 0;
      ctx.beginPath();
      ctx.ellipse(-bodyW * 0.48, arm, bodyW * 0.14, bodyH * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(bodyW * 0.48, -arm, bodyW * 0.14, bodyH * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(0, -bodyH * 0.42, bodyW * 0.28, bodyW * 0.28, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1c1410';
      ctx.beginPath();
      ctx.ellipse(0, -bodyH * 0.5, bodyW * 0.3, bodyW * 0.18, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${Math.max(11, h * 0.028)}px "Chakra Petch", sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(name, x, y - bodyH * 0.85);
    };

    const drawBall = (ctx: CanvasRenderingContext2D, x: number, y: number, scale = 1) => {
      const r = Math.max(7, h * 0.018) * scale;
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.ellipse(x + 2, y + r * 0.7, r * 0.9, r * 0.35, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f4f4f4';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#111';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = '#111';
      ctx.beginPath();
      ctx.moveTo(x, y - r * 0.45);
      ctx.lineTo(x + r * 0.4, y - r * 0.1);
      ctx.lineTo(x + r * 0.25, y + r * 0.4);
      ctx.lineTo(x - r * 0.25, y + r * 0.4);
      ctx.lineTo(x - r * 0.4, y - r * 0.1);
      ctx.closePath();
      ctx.fill();
    };

    const paint = (now: number) => {
      if (!alive) return;
      const ctx = canvas.getContext('2d');
      if (!ctx || !w) {
        raf = requestAnimationFrame(paint);
        return;
      }

      const ph = phaseRef.current;
      const anim = animRef.current;
      if (ph === 'runup') anim.run = clamp((now - anim.t0) / 520, 0, 1);
      if (ph === 'kick') anim.kick = clamp((now - anim.t0) / 180, 0, 1);
      if (ph === 'flying') anim.fly = clamp((now - anim.t0) / 700, 0, 1);

      ctx.fillStyle = '#061018';
      ctx.fillRect(0, 0, w, h);

      const p = box(L.pitch);
      const stripes = 10;
      for (let i = 0; i < stripes; i++) {
        ctx.fillStyle = i % 2 === 0 ? '#2f8a3a' : '#267832';
        ctx.fillRect(p.x + (p.ww / stripes) * i, p.y, p.ww / stripes + 1, p.hh);
      }

      const area = box(L.box);
      const six = box(L.six);
      const spot = box(L.spot);
      const goal = box(L.goal);
      ctx.strokeStyle = '#e8f0e4';
      ctx.fillStyle = '#e8f0e4';
      ctx.lineWidth = Math.max(2, h * 0.004);
      ctx.strokeRect(p.x, p.y, p.ww, p.hh);
      ctx.strokeRect(area.x, area.y, area.ww, area.hh);
      ctx.strokeRect(six.x, six.y, six.ww, six.hh);
      ctx.beginPath();
      ctx.arc(spot.x, spot.y, h * 0.12, Math.PI * 0.55, Math.PI * 1.45);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(spot.x, spot.y, Math.max(3, h * 0.008), 0, Math.PI * 2);
      ctx.fill();

      const post = Math.max(5, h * 0.012);
      ctx.fillStyle = '#f5f5f5';
      ctx.fillRect(goal.x, goal.y, post, goal.hh);
      ctx.fillRect(goal.x + goal.ww - post, goal.y, post, goal.hh);
      ctx.fillRect(goal.x, goal.y, goal.ww, post);
      ctx.strokeStyle = 'rgba(220,230,240,0.55)';
      ctx.lineWidth = 1;
      for (let i = 0; i <= 8; i++) {
        const x = goal.x + post + ((goal.ww - post * 2) * i) / 8;
        ctx.beginPath();
        ctx.moveTo(x, goal.y + post);
        ctx.lineTo(goal.x + goal.ww * 0.15 + x * 0.85, goal.y + goal.hh);
        ctx.stroke();
      }
      for (let j = 0; j <= 6; j++) {
        const y = goal.y + post + ((goal.hh - post) * j) / 6;
        ctx.beginPath();
        ctx.moveTo(goal.x + post, y);
        ctx.lineTo(goal.x + goal.ww - post, y);
        ctx.stroke();
      }

      const shot = shotAimRef.current;
      const scored = scoredRef.current;
      let gkX = goal.x + goal.ww * 0.35;
      let gkY = goal.y + goal.hh * 0.5;
      if (shot && (ph === 'flying' || ph === 'result' || ph === 'kick')) {
        const diveX = goal.x + post + (goal.ww - post * 2) * shot.nx;
        const diveY = goal.y + post + (goal.hh - post) * shot.ny;
        const t = ph === 'flying' ? easeOut(anim.fly) : 1;
        if (scored === false) {
          gkX = lerp(gkX, diveX, t);
          gkY = lerp(gkY, diveY, t);
        } else {
          gkX = lerp(gkX, diveX + (diveX > gkX ? -40 : 40), t * 0.7);
          gkY = lerp(gkY, diveY, t * 0.5);
        }
      } else {
        gkY += Math.sin(now * 0.004) * 6;
      }

      const from = box(L.runFrom);
      const to = box(L.runTo);
      let sx = from.x;
      let sy = from.y;
      let pose: 'idle' | 'run' | 'kick' = 'idle';
      let facing = Math.atan2(spot.y - from.y, spot.x - from.x) + Math.PI / 2;
      if (ph === 'runup') {
        const t = easeInOut(anim.run);
        sx = lerp(from.x, to.x, t);
        sy = lerp(from.y, to.y, t);
        pose = 'run';
        facing = Math.atan2(to.y - from.y, to.x - from.x) + Math.PI / 2;
      } else if (ph === 'kick' || ph === 'flying' || ph === 'result' || ph === 'done') {
        sx = to.x;
        sy = to.y;
        pose = ph === 'kick' ? 'kick' : 'idle';
        facing = Math.atan2(spot.y - to.y, spot.x - to.x) + Math.PI / 2;
      }

      let bx = spot.x;
      let by = spot.y;
      let bscale = 1;
      if (shot && (ph === 'flying' || ph === 'result')) {
        const tx = goal.x + post + (goal.ww - post * 2) * shot.nx;
        const ty = goal.y + post + (goal.hh - post) * shot.ny;
        const t = ph === 'result' ? 1 : easeOut(anim.fly);
        bx = lerp(spot.x, tx, t);
        by = lerp(spot.y, ty, t);
        bscale = 1 + Math.sin(t * Math.PI) * 0.25;
        if (scored === false && t > 0.75) {
          bx = lerp(bx, gkX, ((t - 0.75) / 0.25) * 0.5);
          by = lerp(by, gkY, ((t - 0.75) / 0.25) * 0.5);
        }
      }

      if (ph !== 'flying' && ph !== 'result') drawBall(ctx, bx, by);
      const gkFacing = Math.atan2(spot.y - gkY, spot.x - gkX) + Math.PI / 2;
      drawPlayer(ctx, gkX, gkY, gkFacing, '#0ea5e9', ph === 'flying' && scored === false ? 'kick' : 'idle', 'GK', now, true);
      drawPlayer(ctx, sx, sy, facing, shirt, pose, label, now, false);
      if (ph === 'flying' || ph === 'result') drawBall(ctx, bx, by, bscale);

      if (ph === 'aiming' || ph === 'charging') {
        const aim = aimRef.current;
        const ax = goal.x + post + (goal.ww - post * 2) * aim.nx;
        const ay = goal.y + post + (goal.hh - post) * aim.ny;
        const s = Math.max(10, h * 0.03);
        ctx.strokeStyle = ph === 'charging' ? '#ffd400' : 'rgba(255,255,255,0.85)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(ax - s, ay);
        ctx.lineTo(ax + s, ay);
        ctx.moveTo(ax, ay - s);
        ctx.lineTo(ax, ay + s);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(ax, ay, s * 0.55, 0, Math.PI * 2);
        ctx.stroke();
        if (ph === 'charging') {
          ctx.strokeStyle = `rgba(255,212,0,${0.25 + chargeRef.current * 0.5})`;
          ctx.setLineDash([6, 6]);
          ctx.beginPath();
          ctx.moveTo(spot.x, spot.y);
          ctx.lineTo(ax, ay);
          ctx.stroke();
          ctx.setLineDash([]);
          const bw = w * 0.22;
          const bh = 10;
          const bx0 = w * 0.5 - bw / 2;
          const by0 = h * 0.92;
          ctx.fillStyle = 'rgba(0,0,0,0.55)';
          ctx.fillRect(bx0 - 2, by0 - 2, bw + 4, bh + 4);
          ctx.fillStyle = '#1f2937';
          ctx.fillRect(bx0, by0, bw, bh);
          ctx.fillStyle = chargeRef.current > 0.85 ? '#ef4444' : '#ffd400';
          ctx.fillRect(bx0, by0, bw * chargeRef.current, bh);
        }
      }

      raf = requestAnimationFrame(paint);
    };

    const ro = new ResizeObserver(resize);
    ro.observe(parent);
    resize();
    raf = requestAnimationFrame(paint);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [rarity, playerName]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (phaseRef.current !== 'aiming') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width;
    const ny = (e.clientY - rect.top) / rect.height;
    const g = L.goal;
    if (nx < g.x || nx > g.x + g.w || ny < g.y || ny > g.y + g.h) return;
    aimRef.current = {
      nx: clamp((nx - g.x) / g.w, 0, 1),
      ny: clamp((ny - g.y) / g.h, 0, 1),
    };
    holdRef.current = true;
    setPhaseBoth('charging');
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (phaseRef.current !== 'charging' || !holdRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width;
    const ny = (e.clientY - rect.top) / rect.height;
    const g = L.goal;
    if (nx < g.x || nx > g.x + g.w || ny < g.y || ny > g.y + g.h) return;
    aimRef.current = {
      nx: clamp((nx - g.x) / g.w, 0, 1),
      ny: clamp((ny - g.y) / g.h, 0, 1),
    };
  };

  return (
    <div style={{ position: 'relative', width: '100%', aspectRatio: '16 / 9', border: '3px solid #1e3a2a', background: '#0a1a12', overflow: 'hidden' }}>
      <canvas
        ref={canvasRef}
        style={{ display: 'block', width: '100%', height: '100%', cursor: 'crosshair', touchAction: 'none' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
      />
      <div style={{ position: 'absolute', left: 12, top: 10, right: 12, display: 'flex', justifyContent: 'space-between', pointerEvents: 'none', fontWeight: 700, textShadow: '0 2px 0 #000', fontFamily: '"Chakra Petch", sans-serif', fontSize: 14 }}>
        <span>GOLS {goals}</span>
        <span>CHUTES {shotsLeft}</span>
      </div>
      {phase === 'aiming' || phase === 'charging' ? (
        <div style={{ position: 'absolute', left: '50%', bottom: 12, transform: 'translateX(-50%)', pointerEvents: 'none', fontWeight: 700, fontSize: 13, background: 'rgba(0,0,0,0.45)', padding: '6px 12px', border: '1px solid rgba(255,255,255,0.15)', fontFamily: '"Chakra Petch", sans-serif' }}>
          {phase === 'charging' ? `CARREGANDO ${Math.round(charge * 100)}% · SOLTA` : 'SEGURA NO GOL E SOLTA PRA CHUTAR'}
        </div>
      ) : null}
      {banner ? (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', fontSize: 'clamp(42px, 8vw, 72px)', fontWeight: 700, color: banner === 'GOOOL!' ? '#ffd400' : '#7dd3fc', textShadow: '0 4px 0 #000', fontFamily: '"Chakra Petch", sans-serif' }}>
          {banner}
        </div>
      ) : null}
      {phase === 'done' ? (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 14, background: 'rgba(0,0,0,0.55)', zIndex: 5 }}>
          <strong style={{ fontSize: 28, letterSpacing: '0.05em', fontFamily: '"Chakra Petch", sans-serif' }}>
            {goals > 0 ? `VENCEU · ${goals} GOL(S)` : 'PERDEU · 0 GOLS'}
          </strong>
          <button type="button" onClick={onClaim} style={{ font: 'inherit', fontWeight: 700, border: '2px solid #ffd400', background: '#ffd400', color: '#071018', padding: '10px 18px', cursor: 'pointer' }}>
            CONTINUAR
          </button>
        </div>
      ) : null}
    </div>
  );
}

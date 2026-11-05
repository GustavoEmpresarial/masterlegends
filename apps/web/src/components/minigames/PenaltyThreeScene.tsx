/// <reference types="@react-three/fiber" />
import { useRef, useMemo, useEffect, useState, type RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import {
  drawPlayfieldPlayer,
  type PlayfieldActor,
} from '../stadium/stadiumPlayfieldDraw';
import {
  GOAL_W,
  GOAL_H,
  GOAL_Z,
  GOAL_LINE_Z,
  BALL_START,
  createFlightState,
  type GamePhase,
  type ShotTarget,
  type FlightState,
} from './penaltyTypes';

interface PenaltyThreeSceneProps {
  phase: GamePhase;
  target: ShotTarget | null;
  goalieEnd: number;
  power?: number;
  serverScored?: boolean;
  onShotResolved: (scored: boolean) => void;
  shooterRarity?: string | null;
  shooterPosition?: string | null;
  shooterSeed?: string;
  shooterName?: string | null;
  shooterOverwall?: number;
}

const CAM_HOME = new THREE.Vector3(0, 0.95, 4.5);
const CAM_LOOK = new THREE.Vector3(0, 1.15, GOAL_Z);

function makeGrassTexture() {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  const stripe = 32;
  for (let y = 0; y < size; y += stripe) {
    ctx.fillStyle = y % (stripe * 2) === 0 ? '#2f9e45' : '#248538';
    ctx.fillRect(0, y, size, stripe);
  }
  for (let i = 0; i < 1200; i++) {
    const g = 110 + Math.random() * 50;
    ctx.fillStyle = `rgba(30,${g|0},40,0.2)`;
    ctx.fillRect(Math.random() * size, Math.random() * size, 2, 2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(18, 18);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function makeBallTexture() {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#f2f2f2';
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = '#1a1a1a';
  ctx.lineWidth = 6;
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
    const cx = size / 2 + Math.cos(a) * 70;
    const cy = size / 2 + Math.sin(a) * 70;
    ctx.beginPath();
    for (let k = 0; k < 5; k++) {
      const pa = a + (k / 5) * Math.PI * 2;
      const px = cx + Math.cos(pa) * 32;
      const py = cy + Math.sin(pa) * 32;
      if (k === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = i % 2 === 0 ? '#151515' : 'rgba(0,0,0,0.12)';
    ctx.fill();
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function SeatBank({ count }: { count: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(() => new THREE.BoxGeometry(0.5, 0.22, 0.42), []);
  const mat = useMemo(
    () => new THREE.MeshLambertMaterial({ vertexColors: true }),
    [],
  );

  useEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const palette = [
      new THREE.Color('#c41e1e'),
      new THREE.Color('#1e4d9c'),
      new THREE.Color('#e8c020'),
      new THREE.Color('#1a8a4a'),
      new THREE.Color('#e8e8ea'),
    ];
    let i = 0;
    for (let tier = 0; tier < 7 && i < count; tier++) {
      for (let col = 0; col < 28 && i < count; col++) {
        m.makeTranslation((col - 13.5) * 0.58, 1.0 + tier * 0.38, GOAL_Z - 5.2 - tier * 0.34);
        mesh.setMatrixAt(i, m);
        mesh.setColorAt(i, palette[(tier + col) % palette.length]!);
        i++;
      }
    }
    mesh.count = i;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [count]);

  return <instancedMesh ref={ref} args={[geo, mat, count]} />;
}

type NetCord = { pos: THREE.Vector3; quat: THREE.Quaternion; scale: THREE.Vector3 };

function buildGoalNetCords(): NetCord[] {
  const depth = 1.7;
  const backH = GOAL_H * 0.45;
  const cols = 10;
  const rows = 6;
  const thick = 0.02;
  const cords: NetCord[] = [];
  const up = new THREE.Vector3(0, 1, 0);
  const dir = new THREE.Vector3();
  const mid = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const scale = new THREE.Vector3();

  const addCord = (x1: number, y1: number, z1: number, x2: number, y2: number, z2: number) => {
    dir.set(x2 - x1, y2 - y1, z2 - z1);
    const len = dir.length();
    if (len < 0.02) return;
    mid.set((x1 + x2) / 2, (y1 + y2) / 2, (z1 + z2) / 2);
    dir.normalize();
    quat.setFromUnitVectors(up, dir);
    scale.set(thick, len, thick);
    cords.push({
      pos: mid.clone(),
      quat: quat.clone(),
      scale: scale.clone(),
    });
  };

  // NO front face — goal mouth stays open. Net only on roof, sides, back.

  // Roof (from crossbar back/down)
  for (let i = 0; i <= cols; i++) {
    const x = -GOAL_W / 2 + (i / cols) * GOAL_W;
    addCord(x, GOAL_H - 0.02, -0.02, x, backH, -depth);
  }
  for (let k = 1; k <= 5; k++) {
    const t = k / 6;
    const z = -depth * t;
    const y = GOAL_H + (backH - GOAL_H) * t - Math.sin(t * Math.PI) * 0.12;
    addCord(-GOAL_W / 2, y, z, GOAL_W / 2, y, z);
  }

  // Sides (from posts back)
  for (let j = 0; j <= rows; j++) {
    const t = j / rows;
    const yF = 0.06 + t * (GOAL_H - 0.1);
    const yB = 0.1 + t * (backH - 0.1);
    addCord(-GOAL_W / 2, yF, -0.02, -GOAL_W / 2, yB, -depth);
    addCord(GOAL_W / 2, yF, -0.02, GOAL_W / 2, yB, -depth);
  }
  for (let k = 1; k <= 4; k++) {
    const t = k / 5;
    const z = -depth * t;
    const yTop = GOAL_H + (backH - GOAL_H) * t;
    addCord(-GOAL_W / 2, 0.06, z, -GOAL_W / 2, yTop, z);
    addCord(GOAL_W / 2, 0.06, z, GOAL_W / 2, yTop, z);
  }

  // Back wall of the net (where the ball hits)
  for (let i = 0; i <= cols; i++) {
    const x = -GOAL_W / 2 + (i / cols) * GOAL_W;
    addCord(x, 0.08, -depth, x, backH, -depth);
  }
  for (let j = 0; j <= rows; j++) {
    const y = 0.08 + (j / rows) * (backH - 0.08);
    addCord(-GOAL_W / 2, y, -depth, GOAL_W / 2, y, -depth);
  }

  // Floor pocket (short cords near ground at back)
  for (let i = 0; i <= cols; i++) {
    const x = -GOAL_W / 2 + (i / cols) * GOAL_W;
    addCord(x, 0.06, -0.15, x, 0.08, -depth * 0.55);
  }

  return cords;
}

function GoalNet() {
  const depth = 1.7;
  const backH = GOAL_H * 0.45;
  const cords = useMemo(() => buildGoalNetCords(), []);
  const geo = useMemo(() => new THREE.CylinderGeometry(0.5, 0.5, 1, 5), []);
  const mat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#eef2f8', roughness: 0.5, metalness: 0.08 }),
    [],
  );
  const meshRef = useRef<THREE.InstancedMesh>(null);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    cords.forEach((c, i) => {
      m.compose(c.pos, c.quat, c.scale);
      mesh.setMatrixAt(i, m);
    });
    mesh.count = cords.length;
    mesh.instanceMatrix.needsUpdate = true;
  }, [cords]);

  return (
    <group position={[0, 0, GOAL_Z]}>
      <instancedMesh ref={meshRef} args={[geo, mat, cords.length]} />
      <mesh position={[0, GOAL_H * 0.42, -depth * 0.5]} rotation={[0.18, 0, 0]}>
        <planeGeometry args={[GOAL_W * 0.96, GOAL_H * 0.9]} />
        <meshBasicMaterial
          color="#8aa0b4"
          transparent
          opacity={0.06}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      <mesh position={[-GOAL_W / 2, backH / 2, -depth]}>
        <cylinderGeometry args={[0.04, 0.04, backH, 8]} />
        <meshStandardMaterial color="#f0f4fa" metalness={0.45} roughness={0.3} />
      </mesh>
      <mesh position={[GOAL_W / 2, backH / 2, -depth]}>
        <cylinderGeometry args={[0.04, 0.04, backH, 8]} />
        <meshStandardMaterial color="#f0f4fa" metalness={0.45} roughness={0.3} />
      </mesh>
      <mesh position={[0, backH, -depth]}>
        <boxGeometry args={[GOAL_W + 0.08, 0.07, 0.07]} />
        <meshStandardMaterial color="#f0f4fa" metalness={0.45} roughness={0.3} />
      </mesh>
    </group>
  );
}

const BONECO_W = 180;
const BONECO_H = 280;
const BONECO_SCALE = 6;
const BONECO_ANCHOR_Y = 168;

function PixelBoneco({
  rarity,
  position,
  seed,
  name,
  overwall,
  slotRole,
  side = 'home',
  pose,
  facing = 1,
  height = 1.85,
  badge,
}: {
  rarity?: string | null;
  position?: string | null;
  seed: string;
  name?: string | null;
  overwall?: number;
  slotRole?: string;
  side?: 'home' | 'away';
  pose: 'idle' | 'run' | 'kick';
  facing?: 1 | -1;
  height?: number;
  badge: string;
}) {
  const poseRef = useRef(pose);
  const facingRef = useRef(facing);
  poseRef.current = pose;
  facingRef.current = facing;

  const canvas = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = BONECO_W;
    c.height = BONECO_H;
    return c;
  }, []);

  const tex = useMemo(() => {
    const t = new THREE.CanvasTexture(canvas);
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestFilter;
    t.colorSpace = THREE.SRGBColorSpace;
    t.needsUpdate = true;
    return t;
  }, [canvas]);

  useEffect(() => () => tex.dispose(), [tex]);

  useFrame(({ clock }) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, BONECO_W, BONECO_H);
    const actor: PlayfieldActor = {
      slotId: seed,
      xPct: 50,
      yPct: 50,
      rarity: rarity ?? 'common',
      position: position ?? slotRole ?? 'FW',
      slotRole,
      name: name ?? 'Jogador',
      overwall: overwall ?? 0,
      seed,
      index: side === 'away' ? 1 : 0,
      side,
    };
    drawPlayfieldPlayer(
      ctx,
      actor,
      BONECO_W / 2,
      BONECO_ANCHOR_Y,
      clock.elapsedTime * 1000,
      poseRef.current,
      facingRef.current,
      BONECO_SCALE,
      badge,
    );
    tex.needsUpdate = true;
  });

  const bootBottom = BONECO_ANCHOR_Y + 14 * BONECO_SCALE;
  const headTop = BONECO_ANCHOR_Y - 18 * BONECO_SCALE;
  const charPx = Math.max(1, bootBottom - headTop);
  const planeH = (height * BONECO_H) / charPx;
  const planeW = planeH * (BONECO_W / BONECO_H);
  const feetFromBottom = (BONECO_H - bootBottom) / BONECO_H;
  const y = planeH * (0.5 - feetFromBottom);

  return (
    <mesh position={[0, y, 0]} renderOrder={3}>
      <planeGeometry args={[planeW, planeH]} />
      <meshBasicMaterial map={tex} transparent alphaTest={0.4} depthWrite toneMapped={false} />
    </mesh>
  );
}

function Goalkeeper({
  groupRef,
  pose,
}: {
  groupRef: RefObject<THREE.Group | null>;
  pose: 'idle' | 'run' | 'kick';
}) {
  return (
    <group ref={groupRef} position={[0, 0, GOAL_Z + 0.55]}>
      <PixelBoneco
        rarity="rare"
        position="GK"
        slotRole="GK"
        seed="penalty-gk"
        name="Goleiro"
        overwall={72}
        side="away"
        pose={pose}
        facing={1}
        height={1.95}
        badge="GOL"
      />
    </group>
  );
}

function Floodlight({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 4.8, 0]}>
        <cylinderGeometry args={[0.09, 0.14, 9.6, 6]} />
        <meshLambertMaterial color="#3a4558" />
      </mesh>
      <mesh position={[0, 9.7, 0]} rotation={[0.5, 0, x > 0 ? -0.12 : 0.12]}>
        <boxGeometry args={[1.8, 0.35, 0.55]} />
        <meshBasicMaterial color="#fff2b0" />
      </mesh>
      <pointLight position={[0, 9.4, 0]} intensity={28} distance={36} color="#fff0c0" />
    </group>
  );
}

function Stadium() {
  return (
    <group>
      {/* Back stand */}
      <mesh position={[0, 2.2, GOAL_Z - 7.2]}>
        <boxGeometry args={[22, 4.6, 4.8]} />
        <meshLambertMaterial color="#1a2433" />
      </mesh>
      <mesh position={[0, 4.7, GOAL_Z - 6.6]} rotation={[0.15, 0, 0]}>
        <boxGeometry args={[23, 0.16, 5.5]} />
        <meshLambertMaterial color="#121a26" />
      </mesh>
      {/* Side walls */}
      <mesh position={[-11.5, 2, -5]}>
        <boxGeometry args={[1.4, 4.2, 16]} />
        <meshLambertMaterial color="#16202c" />
      </mesh>
      <mesh position={[11.5, 2, -5]}>
        <boxGeometry args={[1.4, 4.2, 16]} />
        <meshLambertMaterial color="#16202c" />
      </mesh>
      {/* Side boards — dark, no solid yellow slab */}
      <mesh position={[-6.5, 0.42, -3.5]} rotation={[0, 0.35, 0]}>
        <boxGeometry args={[4, 0.55, 0.08]} />
        <meshLambertMaterial color="#0d2818" />
      </mesh>
      <mesh position={[6.5, 0.42, -3.5]} rotation={[0, -0.35, 0]}>
        <boxGeometry args={[4, 0.55, 0.08]} />
        <meshLambertMaterial color="#1a1428" />
      </mesh>
      <SeatBank count={180} />
    </group>
  );
}

export function PenaltyThreeScene({
  phase,
  target,
  goalieEnd,
  power = 0.65,
  serverScored,
  onShotResolved,
  shooterRarity,
  shooterPosition,
  shooterSeed = 'penalti',
  shooterName,
  shooterOverwall = 0,
}: PenaltyThreeSceneProps) {
  const ballRef = useRef<THREE.Mesh>(null);
  const shadowRef = useRef<THREE.Mesh>(null);
  const gkRef = useRef<THREE.Group>(null);
  const flightRef = useRef<FlightState | null>(null);
  const diveT = useRef(0);
  const bobT = useRef(0);
  const shake = useRef(0);
  const camTarget = useRef(new THREE.Vector3());
  const camLook = useRef(new THREE.Vector3());
  const [burst, setBurst] = useState(false);
  const { camera, gl } = useThree();

  const grassTex = useMemo(() => makeGrassTexture(), []);
  const ballTex = useMemo(() => makeBallTexture(), []);

  useEffect(() => {
    gl.shadowMap.enabled = true;
    gl.shadowMap.type = THREE.PCFSoftShadowMap;
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = 1.35;
    gl.outputColorSpace = THREE.SRGBColorSpace;
  }, [gl]);

  useEffect(() => {
    if (phase === 'flying' && target) {
      flightRef.current = createFlightState(target, power, serverScored);
      diveT.current = 0;
      setBurst(false);
    } else if (phase === 'aiming') {
      flightRef.current = null;
      diveT.current = 0;
      shake.current = 0;
      setBurst(false);
      if (ballRef.current) {
        ballRef.current.position.set(...BALL_START);
        ballRef.current.rotation.set(0, 0, 0);
        ballRef.current.scale.setScalar(1);
      }
      if (gkRef.current) {
        gkRef.current.position.set(0, 0, GOAL_Z + 0.55);
        gkRef.current.rotation.set(0, 0, 0);
      }
    }
  }, [phase, target, serverScored, power]);

  useEffect(() => {
    if (flightRef.current && serverScored !== undefined) {
      flightRef.current.serverScored = serverScored;
    }
  }, [serverScored]);

  useFrame((_, dt) => {
    if (!Number.isFinite(dt) || dt <= 0) return;
    const clampedDt = Math.min(dt, 0.05);
    const gk = gkRef.current;
    const ball = ballRef.current;
    const f = flightRef.current;

    if ((phase === 'aiming' || phase === 'charging') && gk) {
      bobT.current += clampedDt;
      const amp = phase === 'charging' ? 0.45 : 1.15;
      gk.position.x = Math.sin(bobT.current * 1.55) * amp;
      gk.rotation.z = Math.sin(bobT.current * 2.1) * 0.05;
      if (ball && phase === 'charging') {
        ball.scale.setScalar(1 + Math.sin(bobT.current * 16) * 0.04 * power);
      }
    } else if (phase === 'flying' && gk && target) {
      diveT.current = Math.min(1, diveT.current + clampedDt * 2.9);
      const t = diveT.current;
      const side = goalieEnd < -0.3 ? 1 : goalieEnd > 0.3 ? -1 : 0;
      gk.position.x = THREE.MathUtils.lerp(gk.position.x, goalieEnd * 1.52, Math.min(1, clampedDt * 7.5));
      gk.position.y = Math.sin(t * Math.PI) * 0.55;
      gk.rotation.z = THREE.MathUtils.lerp(0, side * 1.25, t);
      gk.rotation.x = THREE.MathUtils.lerp(0, -0.25, t);
    }

    if (phase === 'flying' && f && target && ball) {
      f.t = Math.min(1, f.t + clampedDt / f.duration);
      const t = f.t;
      ball.position.x = THREE.MathUtils.lerp(f.start.x, f.end.x, t);
      ball.position.z = THREE.MathUtils.lerp(f.start.z, f.end.z, t);
      const yBase = THREE.MathUtils.lerp(f.start.y, f.end.y, t);
      ball.position.y = yBase + Math.sin(t * Math.PI) * (f.peakY - Math.max(f.start.y, f.end.y));
      ball.rotation.y += clampedDt * (11 + f.power * 9);
      ball.rotation.x += clampedDt * (13 + f.power * 11);
      ball.scale.setScalar(1);

      if (t >= 1 && !f.resolved) {
        f.resolved = true;
        const scored =
          f.serverScored !== undefined
            ? f.serverScored
            : (() => {
                const goalieAtBall = Math.abs(target.x - goalieEnd);
                const isInGoal =
                  target.x > -GOAL_W / 2 + 0.18 &&
                  target.x < GOAL_W / 2 - 0.18 &&
                  target.y < GOAL_H - 0.15;
                return isInGoal && !(isInGoal && goalieAtBall < 1.1 && target.y < 1.6);
              })();
        if (scored) {
          shake.current = 0.55;
          setBurst(true);
        }
        onShotResolved(scored);
      }
    }

    if (shake.current > 0) shake.current = Math.max(0, shake.current - clampedDt * 1.7);
    const shakeAmt = shake.current * shake.current;

    if (ball && shadowRef.current) {
      const lift = Math.max(0, ball.position.y - 0.22);
      const scale = THREE.MathUtils.clamp(1 - lift * 0.35, 0.4, 1);
      shadowRef.current.position.set(ball.position.x, 0.015, ball.position.z);
      shadowRef.current.scale.setScalar(scale);
      (shadowRef.current.material as THREE.MeshBasicMaterial).opacity = 0.35 * scale;
    }

    if (phase === 'aiming' || phase === 'charging') {
      camera.position.copy(CAM_HOME);
      if (phase === 'charging') {
        camera.position.z -= power * 0.35;
        camera.position.y += power * 0.08;
      }
      camera.lookAt(CAM_LOOK);
    } else if (ball && f) {
      const p = f.t;
      camTarget.current.set(
        THREE.MathUtils.lerp(ball.position.x * 0.08, ball.position.x * 0.22, p) +
          (Math.random() - 0.5) * shakeAmt * 0.25,
        THREE.MathUtils.lerp(0.95, 1.15, p) + (Math.random() - 0.5) * shakeAmt * 0.15,
        ball.position.z + THREE.MathUtils.lerp(4.05, 2.8, p),
      );
      camLook.current.set(ball.position.x, ball.position.y + 0.1, ball.position.z - 0.5);
      camera.position.lerp(camTarget.current, Math.min(1, clampedDt * 8));
      camera.lookAt(camLook.current);
    } else if (phase === 'result' && target) {
      camTarget.current.set(target.x * 0.2, 1.2, GOAL_LINE_Z + 4.4);
      camLook.current.set(target.x, target.y * 0.7 + 0.4, GOAL_LINE_Z);
      camera.position.lerp(camTarget.current, Math.min(1, clampedDt * 4.5));
      camera.lookAt(camLook.current);
    }
  });

  return (
    <>
      {/* Night stadium sky — not pure black void */}
      <color attach="background" args={['#0c1c2e']} />
      <fog attach="fog" args={['#0c1c2e', 28, 75]} />

      <ambientLight intensity={0.55} color="#c8d8f0" />
      <hemisphereLight args={['#a8c8ff', '#1a4028', 0.85]} />
      <directionalLight
        position={[6, 16, 8]}
        intensity={1.8}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-far={35}
        shadow-camera-left={-14}
        shadow-camera-right={14}
        shadow-camera-top={12}
        shadow-camera-bottom={-6}
        shadow-bias={-0.00025}
        color="#fff5d6"
      />
      <directionalLight position={[-8, 6, -4]} intensity={0.45} color="#7eb0ff" />

      {/* Pitch — bright, readable grass */}
      <mesh position={[0, 0, -4]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[70, 70]} />
        <meshLambertMaterial map={grassTex} />
      </mesh>

      {/* Penalty spot */}
      <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.5, 24]} />
        <meshLambertMaterial color="#6e5638" />
      </mesh>
      <mesh position={[0, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.08, 0.13, 20]} />
        <meshBasicMaterial color="#f0f4f8" />
      </mesh>

      {/* Pitch lines */}
      <mesh position={[0, 0.02, GOAL_Z + 0.15]}>
        <boxGeometry args={[16, 0.02, 0.08]} />
        <meshBasicMaterial color="#f4f7fb" />
      </mesh>
      <mesh position={[-8, 0.02, GOAL_Z + 2.4]}>
        <boxGeometry args={[0.08, 0.02, 4.5]} />
        <meshBasicMaterial color="#f4f7fb" />
      </mesh>
      <mesh position={[8, 0.02, GOAL_Z + 2.4]}>
        <boxGeometry args={[0.08, 0.02, 4.5]} />
        <meshBasicMaterial color="#f4f7fb" />
      </mesh>
      <mesh position={[0, 0.02, GOAL_Z + 4.4]}>
        <boxGeometry args={[5.5, 0.02, 0.07]} />
        <meshBasicMaterial color="#f4f7fb" />
      </mesh>
      <mesh position={[0, 0.02, GOAL_Z + 2.2]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.85, 0.93, 36]} />
        <meshBasicMaterial color="#f4f7fb" side={THREE.DoubleSide} />
      </mesh>

      {/* Goal frame */}
      <group position={[0, 0, GOAL_Z]}>
        <mesh position={[0, GOAL_H, 0]} castShadow>
          <boxGeometry args={[GOAL_W + 0.22, 0.14, 0.14]} />
          <meshStandardMaterial color="#f5f7fa" metalness={0.4} roughness={0.3} />
        </mesh>
        <mesh position={[-GOAL_W / 2, GOAL_H / 2, 0]} castShadow>
          <cylinderGeometry args={[0.07, 0.07, GOAL_H, 12]} />
          <meshStandardMaterial color="#f5f7fa" metalness={0.4} roughness={0.3} />
        </mesh>
        <mesh position={[GOAL_W / 2, GOAL_H / 2, 0]} castShadow>
          <cylinderGeometry args={[0.07, 0.07, GOAL_H, 12]} />
          <meshStandardMaterial color="#f5f7fa" metalness={0.4} roughness={0.3} />
        </mesh>
      </group>

      <GoalNet />
      <Stadium />
      <Floodlight x={-10.5} z={-1} />
      <Floodlight x={10.5} z={-1} />

      <mesh ref={ballRef} position={BALL_START} castShadow>
        <sphereGeometry args={[0.22, 24, 24]} />
        <meshStandardMaterial map={ballTex} roughness={0.4} />
      </mesh>
      <mesh ref={shadowRef} position={[0, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.2, 16]} />
        <meshBasicMaterial color="#000" transparent opacity={0.35} depthWrite={false} />
      </mesh>

      <group position={[-0.72, 0, 0.48]}>
        <PixelBoneco
          rarity={shooterRarity}
          position={shooterPosition ?? 'FW'}
          slotRole={shooterPosition ?? 'FW'}
          seed={shooterSeed}
          name={shooterName}
          overwall={shooterOverwall}
          side="home"
          pose={phase === 'charging' || phase === 'flying' ? 'kick' : 'run'}
          facing={1}
          height={1.8}
          badge={(shooterName ?? 'ATA').slice(0, 10)}
        />
      </group>

      <Goalkeeper groupRef={gkRef} pose={phase === 'flying' ? 'kick' : 'run'} />

      {(burst || (phase === 'result' && !!serverScored)) && (
        <pointLight position={[0, 1.4, GOAL_LINE_Z]} intensity={20} distance={8} color="#ffd060" />
      )}
    </>
  );
}

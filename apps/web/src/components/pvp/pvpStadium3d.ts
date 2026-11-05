import {
  ACESFilmicToneMapping,
  AmbientLight,
  BoxGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  Fog,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  RepeatWrapping,
  Scene,
  SphereGeometry,
  SpotLight,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from 'three';

const PITCH_L = 36;
const PITCH_W = 22;
const GOAL_LINE = (0.5 - 16 / 1400) * PITCH_L;

export interface PvpStadium {
  resize(cssW: number, cssH: number, dpr: number): void;
  render(timeMs: number, dt: number, aim: {
    xPct: number;
    yPct: number;
    push: number;
    netEnd: 'left' | 'right' | null;
    netAge: number;
    camera: 'live' | 'cima' | 'trave' | 'escanteio';
    attacking: 'home' | 'away';
  }): void;
  project(xPct: number, yPct: number): { x: number; y: number; pxPerUnit: number };
  dispose(): void;
}

function canvasTex(draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void, w: number, h: number) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas');
  draw(ctx, w, h);
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function pitchTexture() {
  return canvasTex((ctx, w, h) => {
    for (let i = 0; i < 14; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#1a7a34' : '#14662b';
      ctx.fillRect((i * w) / 14, 0, w / 14 + 1, h);
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.92)';
    ctx.lineWidth = 5;
    ctx.strokeRect(16, 16, w - 32, h - 32);
    ctx.beginPath();
    ctx.moveTo(w / 2, 16);
    ctx.lineTo(w / 2, h - 16);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, h * 0.16, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#f4ecd2';
    ctx.fillRect(w / 2 - 3, h / 2 - 3, 6, 6);
    const box = (x: number, width: number, atRight: boolean) => {
      ctx.strokeRect(x, h * 0.22, width, h * 0.56);
      const innerW = width * 0.42;
      ctx.strokeRect(atRight ? x + width - innerW : x, h * 0.36, innerW, h * 0.28);
    };
    box(16, w * 0.16, false);
    box(w - 16 - w * 0.16, w * 0.16, true);
  }, 1400, 860);
}

function seatMaterial() {
  const colors = ['#c23b3b', '#315684', '#d4a017', '#efe8dc', '#1d6a44', '#5b2d91', '#c56a1d', '#1f4e79'];
  const tex = canvasTex((ctx, w, h) => {
    ctx.fillStyle = '#241c2c';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#3d3448';
    ctx.fillRect(0, 0, w, 5);
    const cols = 10;
    const cell = w / cols;
    for (let i = 0; i < cols; i++) {
      ctx.fillStyle = '#120e16';
      ctx.fillRect(i * cell, 5, 2, h - 5);
      ctx.fillStyle = colors[i % colors.length]!;
      ctx.fillRect(i * cell + 4, 10, cell - 8, h - 20);
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(i * cell + 4, h - 12, cell - 8, 7);
    }
  }, 320, 56);
  tex.wrapS = RepeatWrapping;
  tex.wrapT = RepeatWrapping;
  tex.repeat.set(7, 1);
  return new MeshStandardMaterial({ map: tex, roughness: 0.94 });
}

function netTexture() {
  return canvasTex((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(232, 240, 246, 0.96)';
    ctx.lineWidth = 3.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 1.6);
    ctx.lineTo(w, 1.6);
    ctx.moveTo(1.6, 0);
    ctx.lineTo(1.6, h);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(0, 3.4);
    ctx.lineTo(w, 3.4);
    ctx.moveTo(3.4, 0);
    ctx.lineTo(3.4, h);
    ctx.stroke();
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.arc(1.6, 1.6, 4.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(168, 188, 204, 0.9)';
    ctx.lineWidth = 1.1;
    ctx.stroke();
  }, 64, 64);
}

function netMaterial(worldW: number, worldH: number) {
  const map = netTexture();
  map.wrapS = RepeatWrapping;
  map.wrapT = RepeatWrapping;
  map.repeat.set(worldW / 0.2, worldH / 0.2);
  return new MeshBasicMaterial({
    map,
    transparent: true,
    side: DoubleSide,
    depthWrite: false,
    alphaTest: 0.28,
  });
}

function hangNet(geo: PlaneGeometry, amount: number) {
  const pos = geo.attributes.position;
  const rest = new Float32Array(pos.array);
  let maxX = 0.001;
  let maxY = 0.001;
  for (let i = 0; i < pos.count; i++) {
    maxX = Math.max(maxX, Math.abs(rest[i * 3] ?? 0));
    maxY = Math.max(maxY, Math.abs(rest[i * 3 + 1] ?? 0));
  }
  for (let i = 0; i < pos.count; i++) {
    const px = rest[i * 3] ?? 0;
    const py = rest[i * 3 + 1] ?? 0;
    const edge = Math.max(Math.abs(px) / maxX, Math.abs(py) / maxY);
    const sag = -Math.pow(Math.max(0, 1 - edge), 1.35) * amount;
    rest[i * 3 + 2] = sag;
    pos.setZ(i, sag);
  }
  pos.needsUpdate = true;
  return rest;
}

function addGoal(parent: Group, x: number, facing: 1 | -1): Mesh {
  const goal = new Group();
  const white = new MeshStandardMaterial({ color: '#f4f7fb', roughness: 0.28, metalness: 0.16 });
  const postH = 3.2;
  const mouth = 8;
  const depth = 1.62;
  const back = -facing * depth;
  const postGeo = new CylinderGeometry(0.055, 0.055, postH, 14);
  const rearGeo = new CylinderGeometry(0.032, 0.032, postH, 10);
  for (const z of [-mouth / 2, mouth / 2]) {
    const mesh = new Mesh(postGeo, white);
    mesh.position.set(0, postH / 2, z);
    mesh.castShadow = true;
    goal.add(mesh);
    const rear = new Mesh(rearGeo, white);
    rear.position.set(back, postH / 2, z);
    goal.add(rear);
  }
  const bar = new Mesh(new CylinderGeometry(0.05, 0.05, mouth, 14), white);
  bar.rotation.x = Math.PI / 2;
  bar.position.set(0, postH, 0);
  bar.castShadow = true;
  goal.add(bar);
  const backBar = new Mesh(new CylinderGeometry(0.028, 0.028, mouth, 10), white);
  backBar.rotation.x = Math.PI / 2;
  backBar.position.set(back, postH, 0);
  goal.add(backBar);

  const backGeo = new PlaneGeometry(mouth, postH, 22, 12);
  const net = new Mesh(backGeo, netMaterial(mouth, postH));
  net.position.set(back, postH / 2, 0);
  net.rotation.y = facing > 0 ? Math.PI / 2 : -Math.PI / 2;
  net.userData.rest = hangNet(backGeo, 0.34);
  net.userData.end = facing > 0 ? 'left' : 'right';
  goal.add(net);

  const topGeo = new PlaneGeometry(depth, mouth, 8, 22);
  const top = new Mesh(topGeo, netMaterial(depth, mouth));
  hangNet(topGeo, 0.16);
  top.rotation.x = -Math.PI / 2;
  top.position.set(back / 2, postH, 0);
  goal.add(top);

  const tie = new CylinderGeometry(0.012, 0.012, depth, 6);
  for (const z of [-mouth / 2, mouth / 2]) {
    const sideGeo = new PlaneGeometry(depth, postH, 8, 12);
    const side = new Mesh(sideGeo, netMaterial(depth, postH));
    hangNet(sideGeo, 0.1);
    side.position.set(back / 2, postH / 2, z);
    side.rotation.y = facing > 0 ? 0 : Math.PI;
    goal.add(side);
    const rope = new Mesh(tie, white);
    rope.rotation.z = Math.PI / 2;
    rope.position.set(back / 2, postH, z);
    goal.add(rope);
    const base = new Mesh(tie, white);
    base.rotation.z = Math.PI / 2;
    base.position.set(back / 2, 0.02, z);
    goal.add(base);
  }

  goal.position.set(x, 0, 0);
  parent.add(goal);
  return net;
}

function rippleNet(net: Mesh, age: number, hit: boolean) {
  const pos = net.geometry.attributes.position;
  const rest = net.userData.rest as Float32Array;
  if (!pos || !rest) return;
  const wave = hit ? Math.abs(Math.sin(age * 14)) * Math.exp(-age * 1.35) : 0;
  for (let i = 0; i < pos.count; i++) {
    const px = rest[i * 3] ?? 0;
    const py = rest[i * 3 + 1] ?? 0;
    const pz = rest[i * 3 + 2] ?? 0;
    const pinned = Math.cos((px / 4) * (Math.PI / 2));
    const lift = 0.45 + (py + 1.2) / 3.2;
    pos.setXYZ(i, px, py, pz - wave * 1.15 * pinned * lift);
  }
  pos.needsUpdate = true;
}

export function createPvpStadium(canvas: HTMLCanvasElement): PvpStadium {
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.shadowMap.enabled = true;

  const scene = new Scene();
  scene.background = new Color('#070b16');
  scene.fog = new Fog('#070b16', 42, 92);

  const camera = new PerspectiveCamera(48, 16 / 9, 0.1, 200);
  camera.position.set(0, 8.2, 20);
  camera.lookAt(0, 0.4, -6);

  scene.add(new AmbientLight('#9eb4d6', 0.55));
  const moon = new DirectionalLight('#d7e4ff', 1.35);
  moon.position.set(-18, 28, 8);
  scene.add(moon);

  const pitch = new Mesh(
    new PlaneGeometry(PITCH_L, PITCH_W),
    new MeshStandardMaterial({ map: pitchTexture(), roughness: 0.86, metalness: 0 }),
  );
  pitch.rotation.x = -Math.PI / 2;
  pitch.receiveShadow = true;
  scene.add(pitch);

  const apron = new Mesh(
    new PlaneGeometry(PITCH_L + 8, PITCH_W + 6),
    new MeshStandardMaterial({ color: '#0e3d1c', roughness: 1 }),
  );
  apron.rotation.x = -Math.PI / 2;
  apron.position.y = -0.02;
  scene.add(apron);

  const bowl = new Group();
  const seats = seatMaterial();
  const concrete = new MeshStandardMaterial({ color: '#2a2633', roughness: 0.88 });
  const tier = (length: number, depth: number, x: number, y: number, z: number, alongZ = false) => {
    const box = new Mesh(new BoxGeometry(alongZ ? depth : length, 1.05, alongZ ? length : depth), seats);
    box.position.set(x, y, z);
    box.castShadow = true;
    box.receiveShadow = true;
    bowl.add(box);
    return box;
  };
  for (let i = 0; i < 5; i++) {
    tier(PITCH_L + 10, 1.9, 0, 0.55 + i * 0.78, -PITCH_W / 2 - 1.5 - i * 1.55);
    const lip = new Mesh(new BoxGeometry(PITCH_L + 10, 0.14, 0.18), concrete);
    lip.position.set(0, i * 0.78 + 0.08, -PITCH_W / 2 - 0.55 - i * 1.55);
    bowl.add(lip);
  }
  const roof = new Mesh(new BoxGeometry(PITCH_L + 14, 0.32, 9.2), concrete);
  roof.position.set(0, 4.7, -PITCH_W / 2 - 6.2);
  bowl.add(roof);
  for (const sx of [-1, 1]) {
    const near = new Mesh(new BoxGeometry(7.5, 1.15, 1.35), seats);
    near.position.set(sx * 11, 0.58, PITCH_W / 2 + 1.55);
    bowl.add(near);
  }
  scene.add(bowl);

  const boards = new Group();
  const boardColors = ['#b91c1c', '#0f766e', '#1d4ed8', '#a16207', '#6d28d9', '#15803d'];
  for (let i = 0; i < 10; i++) {
    const board = new Mesh(
      new BoxGeometry(3.2, 0.7, 0.12),
      new MeshStandardMaterial({ color: boardColors[i % boardColors.length], roughness: 0.45, emissive: boardColors[i % boardColors.length], emissiveIntensity: 0.18 }),
    );
    board.position.set(-16 + i * 3.55, 0.45, PITCH_W / 2 + 0.55);
    boards.add(board);
  }
  scene.add(boards);

  const lamps: SpotLight[] = [];
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    const x = sx * (PITCH_L / 2 + 3.4);
    const z = sz * (PITCH_W / 2 + 2.6);
    const pole = new Mesh(
      new CylinderGeometry(0.12, 0.16, 8, 8),
      new MeshStandardMaterial({ color: '#2a2e3a', metalness: 0.4, roughness: 0.45 }),
    );
    pole.position.set(x, 4, z);
    scene.add(pole);
    const head = new Mesh(
      new BoxGeometry(1.4, 0.28, 0.45),
      new MeshStandardMaterial({ color: '#f8fafc', emissive: '#fff4d2', emissiveIntensity: 0.8 }),
    );
    head.position.set(x, 8.1, z);
    scene.add(head);
    const spot = new SpotLight('#fff4d2', 28, 48, Math.PI / 5.2, 0.45, 1.2);
    spot.position.set(x, 8, z);
    spot.target.position.set(0, 0, 0);
    scene.add(spot);
    scene.add(spot.target);
    lamps.push(spot);
  }

  const goals = new Group();
  const nets = [
    addGoal(goals, -GOAL_LINE, 1),
    addGoal(goals, GOAL_LINE, -1),
  ];
  scene.add(goals);

  const flags: Mesh[] = [];
  const flagMatHome = new MeshBasicMaterial({ color: '#ffd600', side: DoubleSide });
  const flagMatAway = new MeshBasicMaterial({ color: '#ff3d00', side: DoubleSide });
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    const pole = new Mesh(
      new CylinderGeometry(0.03, 0.03, 1.5, 6),
      new MeshStandardMaterial({ color: '#e7e5e4' }),
    );
    pole.position.set(x * (PITCH_L / 2 - 0.3), 0.75, z * (PITCH_W / 2 - 0.3));
    scene.add(pole);
    const cloth = new Mesh(new PlaneGeometry(0.7, 0.38), x < 0 ? flagMatHome : flagMatAway);
    cloth.position.set(pole.position.x + x * 0.35, 1.35, pole.position.z);
    scene.add(cloth);
    flags.push(cloth);
  }

  const moonMesh = new Mesh(
    new SphereGeometry(1.5, 24, 24),
    new MeshBasicMaterial({ color: '#f4ecd2' }),
  );
  moonMesh.position.set(-14, 16, -28);
  scene.add(moonMesh);

  const ground = new Vector3();
  const step = new Vector3();
  const look = new Vector3(0, 0, -1);
  const desired = new Vector3();
  const desiredLook = new Vector3();
  let cssW = 16;
  let cssH = 9;
  let camKey = '';

  return {
    resize(nextW, nextH, dpr) {
      cssW = Math.max(1, nextW);
      cssH = Math.max(1, nextH);
      renderer.setPixelRatio(dpr);
      renderer.setSize(cssW, cssH, false);
      camera.aspect = cssW / cssH;
      camera.updateProjectionMatrix();
    },
    render(timeMs, dt, aim) {
      const t = timeMs / 1000;
      const x = (aim.xPct / 100 - 0.5) * PITCH_L;
      const z = (aim.yPct / 100 - 0.5) * PITCH_W;
      const push = Math.min(1, Math.max(0, aim.push));
      const sign = aim.attacking === 'away' ? -1 : 1;
      const goalX = sign * (PITCH_L / 2 - 0.15);
      const fov = aim.camera === 'cima' ? 36 : aim.camera === 'trave' ? 34 : aim.camera === 'escanteio' ? 40 : 48;
      if (camera.fov !== fov) {
        camera.fov = fov;
        camera.updateProjectionMatrix();
      }
      if (aim.camera === 'cima') {
        desired.set(x * 0.4, 17.2, 6.4);
        desiredLook.set(x * 0.82, 0, z * 0.82);
      } else if (aim.camera === 'trave') {
        desired.set(goalX + sign * 9.2, 10.6, 2.2);
        desiredLook.set(goalX - sign * 4.6, 0.7, z * 0.35);
      } else if (aim.camera === 'escanteio') {
        desired.set(sign * 6.5, 9.2, 14.8);
        desiredLook.set(x * 0.62, 0.4, z * 0.22);
      } else {
        const sweep = Math.sin(t * 0.45) * (3.2 - push * 1.2);
        desired.set(x * 0.28 + sweep, 8.4 - push * 1.4, 20.5 - push * 2.2);
        desiredLook.set(x * 0.62, 0.5, -6 + z * 0.15);
      }
      const key = `${aim.camera}:${aim.attacking}`;
      if (key !== camKey) {
        camera.position.copy(desired);
        look.copy(desiredLook);
        camKey = key;
      } else {
        const follow = aim.camera === 'live' ? 1.15 + push * 1.1 : 2.6;
        const k = 1 - Math.exp(-Math.min(0.05, Math.max(0, dt)) * follow);
        camera.position.lerp(desired, k);
        look.lerp(desiredLook, k);
      }
      camera.lookAt(look);
      for (const net of nets) {
        rippleNet(net, aim.netAge, aim.netEnd != null && net.userData.end === aim.netEnd);
      }
      for (const flag of flags) flag.rotation.y = Math.sin(t * 2.2 + flag.position.x) * 0.35;
      for (const lamp of lamps) lamp.intensity = 26 + Math.sin(t * 7 + lamp.position.x) * 1.4;
      renderer.render(scene, camera);
    },
    project(xPct, yPct) {
      camera.updateMatrixWorld();
      ground.set((xPct / 100 - 0.5) * PITCH_L, 0, (yPct / 100 - 0.5) * PITCH_W);
      step.copy(ground);
      step.z += 1;
      ground.project(camera);
      step.project(camera);
      const pxPerUnit = Math.hypot((step.x - ground.x) * 0.5 * cssW, (step.y - ground.y) * 0.5 * cssH);
      return {
        x: (ground.x * 0.5 + 0.5) * cssW,
        y: (-ground.y * 0.5 + 0.5) * cssH,
        pxPerUnit,
      };
    },
    dispose() {
      renderer.dispose();
      scene.traverse((obj) => {
        const mesh = obj as Mesh;
        mesh.geometry?.dispose();
        const material = mesh.material;
        if (Array.isArray(material)) material.forEach((item) => item.dispose());
        else material?.dispose();
      });
    },
  };
}

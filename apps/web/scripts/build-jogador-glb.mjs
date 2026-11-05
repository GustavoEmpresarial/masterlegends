globalThis.FileReader = class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((buf) => {
      this.result = buf;
      this.onloadend?.();
    });
  }
};

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

const outDir = join(dirname(fileURLToPath(import.meta.url)), '../public/ui/vestiario/models');

const KITS = [
  { file: 'gk.glb', shirt: '#f59e0b', shorts: '#1e293b', socks: '#fbbf24', hands: '#f87171' },
  { file: 'def.glb', shirt: '#1d4ed8', shorts: '#0f172a', socks: '#93c5fd', hands: null },
  { file: 'lat.glb', shirt: '#0e7490', shorts: '#082f49', socks: '#67e8f9', hands: null },
  { file: 'mid.glb', shirt: '#15803d', shorts: '#052e16', socks: '#86efac', hands: null },
  { file: 'fw.glb', shirt: '#b91c1c', shorts: '#1c1917', socks: '#fca5a5', hands: null },
];

function mat(name, color, roughness = 0.58) {
  return new THREE.MeshStandardMaterial({
    name,
    color,
    roughness,
    metalness: 0.02,
  });
}

function capsule(name, material, radius, length, position, rotation) {
  const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(radius, length, 6, 12), material);
  mesh.name = name;
  mesh.position.set(position[0], position[1], position[2]);
  if (rotation) mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
  mesh.castShadow = true;
  return mesh;
}

function build(kit) {
  const root = new THREE.Group();
  root.name = 'Jogador';

  const skin = mat('Skin', '#e7b48a', 0.72);
  const hair = mat('Hair', '#241c16', 0.86);
  const shirt = mat('Shirt', kit.shirt, 0.62);
  const shorts = mat('Shorts', kit.shorts, 0.7);
  const socks = mat('Socks', kit.socks, 0.65);
  const boots = mat('Boots', '#16181d', 0.45);
  const eyes = mat('Eyes', '#f8fafc', 0.35);
  const pupil = mat('Pupil', '#0b1020', 0.3);
  const hands = mat('Hands', kit.hands ?? '#e7b48a', 0.7);

  const hip = new THREE.Group();
  hip.name = 'Hip';
  root.add(hip);

  hip.add(capsule('Shorts', shorts, 0.15, 0.12, [0, 0.78, 0]));
  hip.add(capsule('Torso', shirt, 0.16, 0.28, [0, 1.08, 0]));
  hip.add(capsule('Collar', shirt, 0.07, 0.02, [0, 1.28, 0.02]));

  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.04, 0.02), mat('Stripe', '#f8fafc', 0.5));
  stripe.name = 'Stripe';
  stripe.position.set(0, 1.12, 0.15);
  hip.add(stripe);

  const addLeg = (side, x) => {
    const leg = new THREE.Group();
    leg.name = side === -1 ? 'LegL' : 'LegR';
    leg.position.set(x, 0.7, 0);
    leg.add(capsule('Thigh', shorts, 0.07, 0.16, [0, -0.16, 0]));
    leg.add(capsule('Shin', socks, 0.055, 0.18, [0, -0.4, 0]));
    const boot = capsule('Boot', boots, 0.06, 0.1, [0, -0.58, 0.04], [0.55, 0, 0]);
    leg.add(boot);
    hip.add(leg);
  };
  addLeg(-1, -0.09);
  addLeg(1, 0.09);

  const addArm = (side) => {
    const arm = new THREE.Group();
    arm.name = side === -1 ? 'ArmL' : 'ArmR';
    arm.position.set(side * 0.24, 1.18, 0);
    arm.rotation.z = side * -0.22;
    arm.add(capsule('UpperArm', shirt, 0.05, 0.16, [0, -0.16, 0]));
    arm.add(capsule('Forearm', skin, 0.042, 0.14, [0, -0.38, 0]));
    arm.add(capsule('Hand', hands, 0.04, 0.02, [0, -0.5, 0.01]));
    hip.add(arm);
  };
  addArm(-1);
  addArm(1);

  const neck = capsule('Neck', skin, 0.045, 0.04, [0, 1.34, 0]);
  hip.add(neck);

  const head = new THREE.Group();
  head.name = 'Head';
  head.position.set(0, 1.5, 0);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.145, 20, 16), skin);
  skull.name = 'Skull';
  head.add(skull);
  const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.15, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), hair);
  hairCap.name = 'Hair';
  hairCap.position.y = 0.02;
  head.add(hairCap);
  const earGeo = new THREE.SphereGeometry(0.035, 10, 8);
  for (const x of [-0.14, 0.14]) {
    const ear = new THREE.Mesh(earGeo, skin);
    ear.name = 'Ear';
    ear.position.set(x, -0.01, 0);
    head.add(ear);
  }
  for (const x of [-0.045, 0.045]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 8), eyes);
    eye.name = 'Eye';
    eye.position.set(x, 0.01, 0.125);
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.01, 8, 8), pupil);
    dot.position.set(0, 0, 0.016);
    eye.add(dot);
    head.add(eye);
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.012, 0.012), hair);
    brow.position.set(x, 0.045, 0.12);
    head.add(brow);
  }
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 8), skin);
  nose.position.set(0, -0.02, 0.14);
  head.add(nose);
  hip.add(head);

  const times = [0, 0.55, 1.1];
  const quat = (name, eulers) => {
    const values = [];
    for (const [x, y, z] of eulers) {
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z));
      values.push(q.x, q.y, q.z, q.w);
    }
    return new THREE.QuaternionKeyframeTrack(name, times, values);
  };
  const clip = new THREE.AnimationClip('Idle', 1.1, [
    quat('Jogador/Hip/ArmL.quaternion', [[0.2, 0, 0.22], [-0.15, 0, 0.22], [0.2, 0, 0.22]]),
    quat('Jogador/Hip/ArmR.quaternion', [[-0.2, 0, -0.22], [0.15, 0, -0.22], [-0.2, 0, -0.22]]),
    quat('Jogador/Hip/LegL.quaternion', [[0.08, 0, 0], [-0.06, 0, 0], [0.08, 0, 0]]),
    quat('Jogador/Hip/LegR.quaternion', [[-0.06, 0, 0], [0.08, 0, 0], [-0.06, 0, 0]]),
    new THREE.VectorKeyframeTrack('Jogador/Hip.position', times, [0, 0, 0, 0, 0.025, 0, 0, 0, 0]),
  ]);

  const scene = new THREE.Scene();
  scene.name = 'Scene';
  scene.add(root);
  return { scene, clip };
}

mkdirSync(outDir, { recursive: true });
const exporter = new GLTFExporter();

for (const kit of KITS) {
  const { scene, clip } = build(kit);
  const bin = await exporter.parseAsync(scene, { binary: true, animations: [clip] });
  const file = join(outDir, kit.file);
  writeFileSync(file, Buffer.from(bin));
  console.log(kit.file, Buffer.from(bin).byteLength);
}

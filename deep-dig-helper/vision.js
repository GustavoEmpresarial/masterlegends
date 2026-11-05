/* Visible pixels and geometry only; no access to the game's private state. */
(() => {
  'use strict';
  const width = 256, height = 192, pivot = { x: 128, y: 27 }, tickMs = 1000 / 30, period = 72;
  const claw = { x: 112, y: 27, width: 33, height: 17 };
  const kinds = {
    gold: { name: 'ouro', color: '#ffdb6e', value: 90, weight: 5, colors: [0x8a5a10, 0xc4821c, 0xf6c443, 0xfff3b0] },
    crystal: { name: 'cristal', color: '#63ecff', value: 550, weight: 2, colors: [0x63ecff, 0x1c86b0] },
    emerald: { name: 'esmeralda', color: '#6ee88a', value: 900, weight: 3, colors: [0x6ee88a, 0x2fc46a, 0x1b7f4a] },
    copper: { name: 'cobre', color: '#ffc29a', value: 45, weight: 4, colors: [0x6a3418, 0xa8582e, 0xe07f4c, 0xffc29a] },
    stone: { name: 'pedra', color: '#b2a6c5', value: 11, weight: 6, colors: [0x3a3644, 0x5a5566, 0x7d7689, 0xa8a2b4] },
    bag: { name: 'saco', color: '#e0c080', value: 150, weight: 6, colors: [0xb98a52, 0x7a5530, 0xe0c080, 0xffd54a] },
    mole: { name: 'toupeira', color: '#c87080', value: 8, weight: 3, colors: [0x8a6a5a, 0x5a4038, 0xffb0b8, 0xc87080] },
    mole_gem: { name: 'toupeira com cristal', color: '#63ecff', value: 600, weight: 3, colors: [] }
  };
  const names = Object.keys(kinds), codes = new Map(names.flatMap((name, n) => kinds[name].colors.map(color => [color, n + 1])));
  const labels = new Uint8Array(width * height), queue = new Int32Array(width * height);
  const pack = (data, i) => (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
  const mod = n => (n % period + period) % period;
  const swings = Array.from({ length: period }, (_, k) => {
    const angle = 1.29 * Math.sin(2 * Math.PI * k / period);
    return { dx: Math.round(Math.sin(angle) * 1024) / 1024, dy: Math.round(Math.cos(angle) * 1024) / 1024 };
  });
  function ores(pixels) {
    labels.fill(0);
    for (let y = 49; y < height - 2; y++) for (let x = 3; x < width - 3; x++) {
      const pos = y * width + x; labels[pos] = codes.get(pack(pixels, pos * 4)) || 0;
    }
    const found = [];
    for (let y = 49; y < height - 2; y++) for (let x = 3; x < width - 3; x++) {
      const start = y * width + x, code = labels[start];
      if (!code) continue;
      let count = 1, minX = x, maxX = x, minY = y, maxY = y;
      queue[0] = start; labels[start] = 0;
      for (let n = 0; n < count; n++) {
        const pos = queue[n], px = pos % width, py = Math.floor(pos / width);
        minX = Math.min(minX, px); maxX = Math.max(maxX, px); minY = Math.min(minY, py); maxY = Math.max(maxY, py);
        for (let ny = Math.max(49, py - 2); ny <= Math.min(height - 3, py + 2); ny++) {
          for (let nx = Math.max(3, px - 2); nx <= Math.min(width - 4, px + 2); nx++) {
            const next = ny * width + nx;
            if (labels[next] === code) { labels[next] = 0; queue[count++] = next; }
          }
        }
      }
      if (count < 5 || maxX - minX > 32 || maxY - minY > 32) continue;
      const kind = names[code - 1], spec = kinds[kind];
      let radius = (Math.max(maxX - minX, maxY - minY) + 3) / 2, value = spec.value, weight = spec.weight;
      if (kind === 'gold') { if (radius > 11) { value = 480; weight = 18; } else if (radius > 7) { value = 220; weight = 10; } }
      if (kind === 'stone' && radius > 7) { value = 25; weight = 14; }
      if (kind === 'bag') radius = 6;
      if (kind === 'mole') radius = 5;
      const ox = (minX + maxX) / 2, oy = (minY + maxY) / 2;
      found.push({ kind, x: ox, y: oy, radius, value, weight, moving: kind === 'mole', efficiency: value / Math.max(1, Math.hypot(ox - pivot.x, oy - pivot.y) * (0.25 + (4 + weight) / 24)) });
    }
    // The crystal above a moving mole is decoration, not a separate collision target.
    for (const body of found.filter(i => i.kind === 'mole')) {
      const gem = found.find(i => i.kind === 'crystal' && Math.abs(i.x - body.x) < 9 && body.y - i.y > 4 && body.y - i.y < 20);
      if (gem) { body.kind = 'mole_gem'; body.value = 600; gem.decoration = true; }
    }
    return found.filter(i => !i.decoration);
  }
  function makeTemplate(aim) {
    const { dx, dy } = aim, tx = pivot.x + dx * 6, ty = pivot.y + dy * 6, pixels = new Set();
    for (const side of [-1, 1]) {
      const points = [[side, 0], [side * 2.6, 2], [side * 2, 4], [side, 5]].map(([n, f]) => [tx - dy * n + dx * f, ty + dx * n + dy * f]);
      for (let j = 1; j < points.length; j++) {
        const [ax, ay] = points[j - 1], [bx, by] = points[j], steps = Math.max(Math.abs(bx - ax), Math.abs(by - ay), 1);
        for (let i = 0; i <= steps; i++) {
          const x = Math.round(ax + (bx - ax) * i / steps), y = Math.round(ay + (by - ay) * i / steps);
          if (x >= claw.x && x < claw.x + claw.width && y >= claw.y && y < claw.y + claw.height) pixels.add((y - claw.y) * claw.width + x - claw.x);
        }
      }
    }
    for (let y = Math.round(ty - 2); y < Math.round(ty - 2) + 3; y++) for (let x = Math.round(tx - 2); x < Math.round(tx - 2) + 4; x++) pixels.delete((y - claw.y) * claw.width + x - claw.x);
    return [...pixels];
  }
  const templates = swings.map(aim => ({ ...aim, pixels: makeTemplate(aim) }));
  function direction(pixels, crop = false) {
    const seen = new Uint8Array(claw.width * claw.height); let count = 0;
    for (let y = 0; y < claw.height; y++) for (let x = 0; x < claw.width; x++) {
      const i = crop ? (y * claw.width + x) * 4 : ((y + claw.y) * width + x + claw.x) * 4;
      const color = pack(pixels, i);
      if (color === 0xe3e8ef || color === 0xa3acb9) { seen[y * claw.width + x] = 1; count++; }
    }
    if (count < 6) return null;
    let score = 0, best = 0, phases = [];
    for (let k = 0; k < period; k++) {
      const template = templates[k]; let overlap = 0;
      for (const p of template.pixels) overlap += seen[p];
      const match = overlap / (template.pixels.length + count - overlap);
      if (match > score + 0.00001) { score = match; best = k; phases = [k]; }
      else if (Math.abs(match - score) < 0.00001) phases.push(k);
    }
    return score >= 0.66 ? { ...swings[best], confidence: score, phases } : null;
  }
  function createTracker() {
    let hypotheses = [], first = 0, samples = 0, previous = -Infinity;
    const reset = () => { hypotheses = []; samples = 0; first = 0; previous = -Infinity; };
    function observe(aim, at) {
      if (!aim || aim.confidence < 0.8 || at - previous > 150) reset();
      if (!aim || aim.confidence < 0.8) return null;
      const initialize = () => { hypotheses = aim.phases.map(k => ({ low: at - (k + 1) * tickMs - 2, high: at - k * tickMs + 2 })); first = at; samples = 0; };
      if (!hypotheses.length) initialize();
      else {
        const next = [];
        for (const h of hypotheses) {
          for (let k = Math.floor((at - h.high) / tickMs); k <= Math.floor((at - h.low) / tickMs); k++) {
            if (!aim.phases.includes(mod(k))) continue;
            const low = Math.max(h.low, at - (k + 1) * tickMs - 2), high = Math.min(h.high, at - k * tickMs + 2);
            if (low <= high) next.push({ low, high });
          }
        }
        if (next.length) hypotheses = next; else initialize();
      }
      previous = at; samples++;
      if (samples < 4 || at - first < 65) return null;
      const reference = (hypotheses[0].low + hypotheses[0].high) / 2, cycle = period * tickMs;
      let low = Infinity, high = -Infinity;
      for (const h of hypotheses) {
        const adjustment = Math.round(((h.low + h.high) / 2 - reference) / cycle) * cycle;
        low = Math.min(low, h.low - adjustment); high = Math.max(high, h.high - adjustment);
      }
      return high - low <= 22 ? { origin: (low + high) / 2, uncertainty: (high - low) / 2 } : null;
    }
    return { observe, reset };
  }
  function firstHit(items, aim) {
    if (!aim) return null;
    let hit = null, nearest = Infinity;
    for (const item of items) {
      const vx = item.x - pivot.x, vy = item.y - pivot.y, along = vx * aim.dx + vy * aim.dy;
      const across = Math.abs(vx * aim.dy - vy * aim.dx), radius = item.radius + 3;
      if (along <= 0 || across > radius) continue;
      const entry = along - Math.sqrt(radius * radius - across * across);
      if (entry < nearest) { hit = item; nearest = entry; }
    }
    return hit;
  }
  function itemX(item, deltaMs) {
    if (!item.moving || !Number.isFinite(item.vx)) return item.x;
    const left = 10 + item.radius, span = 236 - item.radius * 2;
    const t = ((item.x - left + item.vx * deltaMs / 1000) % (2 * span) + 2 * span) % (2 * span);
    return left + (t <= span ? t : 2 * span - t);
  }
  function trajectory(items, phase, at) {
    const aim = swings[mod(phase)];
    for (let n = 1; n <= 50; n++) {
      const x = pivot.x + Math.trunc(aim.dx * n * 4 * 64) / 64, y = pivot.y + Math.trunc(aim.dy * n * 4 * 64) / 64;
      for (const item of items) {
        const delta = at + (n - 1) * tickMs - (item.seenAt ?? at), ix = itemX(item, delta);
        const radius = item.radius + 3, dx = ix - x, dy = item.y - y;
        if (dx * dx + dy * dy <= radius * radius) return { item, outTicks: n, distance: n * 4 };
      }
      if (x < 2 || x > 254 || y > 190) return null;
    }
    return null;
  }
  function candidates(items, model, now, options) {
    const first = Math.ceil((now + (options.leadMs ?? 110) - model.origin) / tickMs - 0.5);
    const byItem = new Map();
    for (let tick = first; tick < first + period; tick++) {
      const at = model.origin + (tick + 0.5) * tickMs, hit = trajectory(items, tick, at);
      if (!hit || (hit.item.moving && !Number.isFinite(hit.item.vx))) continue;
      if (model.uncertainty > 11 && (trajectory(items, tick - 1, at - tickMs)?.item !== hit.item || trajectory(items, tick + 1, at + tickMs)?.item !== hit.item)) continue;
      const radius = Math.max(1, hit.item.radius + 1.5), dx = itemX(hit.item, at + (hit.outTicks - 1) * tickMs - (hit.item.seenAt ?? at)) - pivot.x, dy = hit.item.y - pivot.y;
      if (Math.abs(dx * swings[mod(tick)].dy - dy * swings[mod(tick)].dx) > radius) continue;
      const pull = Math.max(1 / 64, Math.floor(Math.floor(1536 / (4 + hit.item.weight)) * (options.pullMultiplier ?? 1)) / 64);
      const flightMs = (hit.outTicks + Math.ceil(hit.distance / pull)) * tickMs;
      const doneAt = at + flightMs;
      // Delivery, not just launch, must fit before the timer expires.
      if (doneAt + 350 > options.deadline) continue;
      const item = hit.item, rich = ['stone', 'mole'].includes(item.kind) ? 1 : (options.richness ?? 1);
      const base = options.mode === 'survive' && item.kind === 'bag' ? 20 : item.value;
      const value = Math.floor(Math.floor(base * rich) * (options.valueMultiplier ?? 1));
      const shot = { at, phase: mod(tick), item, doneAt, flightMs, value, maxLateMs: Math.max(2, Math.min(8, 12 - model.uncertainty)) };
      if (!byItem.has(item) || doneAt < byItem.get(item).doneAt) byItem.set(item, shot);
    }
    return [...byItem.values()];
  }
  function plan(items, model, now, settings = {}) {
    if (!model || !items.length) return null;
    const options = typeof settings === 'number' ? { leadMs: settings } : settings;
    const mode = options.mode ?? 'all';
    const deadline = now + Math.max(0, options.secondsLeft ?? Infinity) * 1000;
    const opts = { ...options, mode, deadline };
    const shots = candidates(items, model, now, opts);
    if (!shots.length) return null;
    if (mode === 'all') return shots.reduce((first, shot) => !first || shot.at < first.at ? shot : first, null);
    const goal = Math.max(1, options.remainingValue ?? Infinity);
    if (!Number.isFinite(goal)) return shots.reduce((best, shot) => !best || shot.value / (shot.doneAt - now) > best.value / (best.doneAt - now) ? shot : best, null);
    let fastest = null, fallback = null, rate = -Infinity;
    const consider = node => {
      if (node.gain >= goal) { if (!fastest || node.now < fastest.now) fastest = node; }
      const progress = Math.min(node.gain, goal) / Math.max(1, node.now - now);
      if (progress > rate) { rate = progress; fallback = node; }
    };
    let frontier = [{ items, model, now, gain: 0, first: null }];
    // Short routes include clearing a blocking rock before a valuable item.
    for (let depth = 0; depth < 4; depth++) {
      const next = [];
      for (const node of frontier) {
        if (fastest && node.now >= fastest.now) continue;
        const choices = depth === 0 ? shots : candidates(node.items, node.model, node.now, opts);
        for (const shot of choices) {
          if (fastest && shot.doneAt >= fastest.now) continue;
          const child = {
            items: node.items.filter(item => item !== shot.item),
            model: { origin: shot.doneAt - shot.phase * tickMs, uncertainty: model.uncertainty },
            now: shot.doneAt + 150, gain: node.gain + shot.value, first: node.first || shot
          };
          consider(child);
          if (child.gain < goal && child.items.length) next.push(child);
        }
      }
      // Preserve routes that spend a low-value haul to expose a valuable item.
      const potential = node => {
        let future = 0;
        for (const item of node.items) {
          if (item.moving) continue;
          const distance = Math.hypot(item.x - pivot.x, item.y - pivot.y);
          const aim = { dx: (item.x - pivot.x) / distance, dy: (item.y - pivot.y) / distance };
          if (firstHit(node.items, aim) !== item) continue;
          const rich = ['stone', 'mole'].includes(item.kind) ? 1 : (opts.richness ?? 1);
          const value = (item.kind === 'bag' ? 20 : item.value) * rich * (opts.valueMultiplier ?? 1);
          future = Math.max(future, value);
        }
        return (node.gain + future * 0.7) / (node.now - now + 2500);
      };
      const byProgress = [...next].sort((a, b) => b.gain / (b.now - now) - a.gain / (a.now - now));
      const byPotential = next.map(node => ({ node, score: potential(node) })).sort((a, b) => b.score - a.score);
      frontier = [...new Set([...byProgress.slice(0, 6), ...byPotential.slice(0, 6).map(entry => entry.node)])];
      if (!frontier.length) break;
    }
    return (fastest || fallback)?.first || null;
  }
  function chooseTarget(items) { return items.reduce((best, item) => !best || item.efficiency > best.efficiency ? item : best, null); }
  globalThis.DeepDigVision = Object.freeze({ width, height, pivot, claw, tickMs, swings, kinds, ores, direction, createTracker, firstHit, trajectory, plan, chooseTarget });
})();

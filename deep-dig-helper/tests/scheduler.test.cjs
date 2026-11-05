const { test } = require('node:test');
const assert = require('node:assert/strict');
require('../vision.js');
const V = globalThis.DeepDigVision;
const mod = n => (n % 72 + 72) % 72;
const observed = k => ({ ...V.swings[mod(k)], confidence: 1, phases: [...new Set([mod(k), mod(36 - k)])] });

test('locks onto both directions of swing at every starting phase', () => {
  for (let start = 0; start < 72; start++) {
    const tracker = V.createTracker(); let model;
    const origin = 10000 - start * V.tickMs;
    for (let frame = 0; frame < 32; frame++) {
      const at = 10000 + frame * 16.67 + 5;
      model = tracker.observe(observed(Math.floor((at - origin) / V.tickMs)), at);
    }
    assert(model, `no lock at phase ${start}`);
    const offset = model.origin - origin;
    assert(Math.abs(offset - Math.round(offset / 2400) * 2400) < 9, `bad timing at ${start}: ${offset}`);
  }
});
test('a stationary countdown never creates a clock lock', () => {
  const tracker = V.createTracker();
  for (let frame = 0; frame < 180; frame++) assert.equal(tracker.observe(observed(0), frame * 16.67), null);
});
test('collects the first safe item instead of waiting for a more valuable one', () => {
  const position = (phase, distance) => ({ x: V.pivot.x + V.swings[phase].dx * distance, y: V.pivot.y + V.swings[phase].dy * distance });
  const stone = { kind: 'stone', ...position(4, 75), radius: 6, value: 11, weight: 6 };
  const gold = { kind: 'gold', ...position(12, 100), radius: 6, value: 900, weight: 5 };
  const plan = V.plan([stone, gold], { origin: 0, uncertainty: 2 }, 0);
  assert(plan); assert.equal(plan.item, stone);
  assert(plan.at >= 110 && plan.at < 500);
  assert.equal(V.trajectory([stone, gold], plan.phase, plan.at).item, stone);
  assert.equal(V.plan([gold], { origin: 0, uncertainty: 2 }, 0).item, gold);
});
test('every item category is eligible for collection', () => {
  for (const kind of Object.keys(V.kinds)) {
    const item = { kind, x: 128, y: 110, radius: 6, value: V.kinds[kind].value, weight: V.kinds[kind].weight, moving: kind.startsWith('mole'), vx: 0 };
    assert.equal(V.plan([item], { origin: 0, uncertainty: 2 }, 0)?.item, item, kind);
  }
});
test('does not invent a narrow launch window with an uncertain clock', () => {
  const target = { kind: 'crystal', x: 128, y: 180, radius: 4, value: 550, weight: 2 };
  assert.equal(V.plan([target], { origin: 0, uncertainty: 14 }, 0), null);
});

test('survival planning finishes the goal instead of collecting a cheap rock first', () => {
  const point = (phase, distance) => ({ x: V.pivot.x + V.swings[phase].dx * distance, y: V.pivot.y + V.swings[phase].dy * distance });
  const stone = { kind: 'stone', ...point(4, 75), radius: 6, value: 11, weight: 6 };
  const gold = { kind: 'gold', ...point(12, 100), radius: 13, value: 480, weight: 18 };
  const selected = V.plan([stone, gold], { origin: 0, uncertainty: 2 }, 0, { mode: 'survive', remainingValue: 350, secondsLeft: 6 });
  assert.equal(selected?.item, gold);
});
test('an almost complete goal can favor a small stone over a valuable distant item', () => {
  const point = (phase, distance) => ({ x: V.pivot.x + V.swings[phase].dx * distance, y: V.pivot.y + V.swings[phase].dy * distance });
  const stone = { kind: 'stone', ...point(4, 45), radius: 6, value: 11, weight: 6 };
  const crystal = { kind: 'crystal', ...point(12, 125), radius: 4, value: 550, weight: 2 };
  assert.equal(V.plan([stone, crystal], { origin: 0, uncertainty: 2 }, 0, { mode: 'survive', remainingValue: 10, secondsLeft: 10 })?.item, stone);
});
test('does not start a haul that will return after the phase expires', () => {
  const slow = { kind: 'gold', x: 128, y: 175, radius: 13, value: 480, weight: 18 };
  const fast = { kind: 'copper', x: 128 + V.swings[4].dx * 40, y: 27 + V.swings[4].dy * 40, radius: 6, value: 45, weight: 4 };
  const options = { mode: 'survive', remainingValue: 40, secondsLeft: 2 };
  assert.equal(V.plan([slow], { origin: 0, uncertainty: 2 }, 0, options), null);
  assert.equal(V.plan([slow, fast], { origin: 0, uncertainty: 2 }, 0, options)?.item, fast);
});
test('can remove a blocking stone before collecting the item that meets the goal', () => {
  const stone = { kind: 'stone', x: 128, y: 70, radius: 10, value: 25, weight: 14 };
  const gold = { kind: 'gold', x: 128, y: 150, radius: 6, value: 90, weight: 5 };
  const shot = V.plan([stone, gold], { origin: 0, uncertainty: 2 }, 0, { mode: 'survive', remainingValue: 100, secondsLeft: 15 });
  assert.equal(shot?.item, stone);
});

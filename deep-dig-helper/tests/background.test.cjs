const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const source = fs.readFileSync(require('node:path').join(__dirname, '../background.js'), 'utf8');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
function fixture(preflightDelay = 0) {
  let listener; const inputs = [], data = {};
  const event = { addListener() {} };
  const area = { get: async () => ({}), set: async value => Object.assign(data, value) };
  const chrome = {
    storage: { session: area, local: area }, action: { setBadgeText: async () => {} },
    runtime: { id: 'helper', getURL: path => `chrome-extension://helper/${path}`, onMessage: { addListener: fn => { listener = fn; } } },
    permissions: { contains: async () => true },
    tabs: { get: async id => ({ id, active: true, url: 'https://deep-dig.xyz/' }), sendMessage: async () => {}, onRemoved: event, onUpdated: event, onActivated: event },
    debugger: { attach: async () => {}, detach: async () => {}, onDetach: event, sendCommand: async (_, method, params) => {
      if (method === 'Runtime.evaluate') { await delay(preflightDelay); return { result: { value: { x: 200, y: 200 } } }; }
      inputs.push({ at: Date.now(), method, params });
    } }
  };
  vm.runInNewContext(source, { chrome, URL, setTimeout, clearTimeout, Date });
  const popup = { id: 'helper', url: 'chrome-extension://helper/popup.html' };
  const game = { id: 'helper', url: 'https://deep-dig.xyz/', tab: { id: 1 }, frameId: 0 };
  const send = (message, sender = game) => new Promise(resolve => listener(message, sender, resolve));
  const start = () => send({ type: 'bot.start', tabId: 1 }, popup);
  return { send, start, inputs, data };
}
test('a launch waits for its scheduled window', async () => {
  const f = fixture(); assert((await f.start()).ok);
  const at = Date.now() + 100;
  const result = await f.send({ type: 'bot.click', action: 'fire', fireAt: at });
  assert(result.clicked, JSON.stringify(result)); assert.equal(f.inputs.length, 2);
  assert(f.inputs[0].at >= at - 2 && f.inputs[0].at < at + 20);
});
test('stop cancels a launch before it reaches the browser', async () => {
  const f = fixture(); await f.start();
  const pending = f.send({ type: 'bot.click', action: 'fire', fireAt: Date.now() + 180 });
  await delay(15); await f.send({ type: 'bot.stop' });
  assert((await pending).canceled); assert.equal(f.inputs.length, 0);
});
test('an expensive preflight drops a late launch instead of clicking', async () => {
  const f = fixture(80); await f.start();
  const result = await f.send({ type: 'bot.click', action: 'fire', fireAt: Date.now() + 90 });
  assert(result.late, JSON.stringify(result)); assert.equal(f.inputs.length, 0);
});
test('stale unscheduled scripts cannot keep firing', async () => {
  const f = fixture(); await f.start();
  const result = await f.send({ type: 'bot.click', action: 'fire' });
  assert.equal(result.ok, false); assert.equal(f.inputs.length, 0);
});

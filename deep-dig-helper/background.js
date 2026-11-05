'use strict';

const isGame = url => {
  try { return new URL(url).origin === 'https://deep-dig.xyz'; } catch { return false; }
};
let state = { tabId: null, clicks: 0, error: '' }, pending = null, lastClick = 0, generation = 0, wake = null;
const ready = chrome.storage.session.get('botState').then(saved => {
  if (saved.botState) state = saved.botState;
});
async function publish() {
  await chrome.storage.session.set({ botState: state });
  await chrome.action.setBadgeText({ text: state.tabId === null ? '' : 'AUTO' });
  if (state.tabId !== null) chrome.tabs.sendMessage(state.tabId, { type: 'bot.state', ...state }).catch(() => {});
}
function cancelRequest() { generation++; pending = null; if (wake) wake(); }
function waitUntil(at) {
  return new Promise(resolve => {
    const finish = value => { clearTimeout(timer); if (wake === cancel) wake = null; resolve(value); };
    const cancel = () => finish(false), timer = setTimeout(() => finish(true), Math.max(0, at - Date.now()));
    wake = cancel;
  });
}
async function stop(error = '') {
  cancelRequest();
  const old = state.tabId;
  state = { tabId: null, clicks: state.clicks, error };
  await publish();
  if (old !== null) {
    chrome.tabs.sendMessage(old, { type: 'bot.state', ...state }).catch(() => {});
    try { await chrome.debugger.detach({ tabId: old }); } catch { /* already detached */ }
  }
  return { ...state };
}

// Inspect DOM controls only; never read or change the game's internal state.
function clickPosition(action) {
  const selector = action === 'next' ? '#rushNextPhase' : '#rushCanvas';
  return `(() => {
    const visible = el => el && !el.closest('[hidden]') && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden';
    const modal = document.getElementById('rushModal');
    if (document.hidden || !visible(modal) || location.origin !== 'https://deep-dig.xyz') return null;
    const done = document.getElementById('rushDone');
    if (${JSON.stringify(action)} === 'next') { if (!visible(done)) return null; }
    else if (!modal.querySelector('.rush.playing') || visible(done) || visible(document.getElementById('rushOver')) || visible(document.getElementById('rushEnd'))) return null;
    const target = modal.querySelector(${JSON.stringify(selector)});
    if (!visible(target) || target.disabled) return null;
    const box = target.getBoundingClientRect(), x = box.left + box.width / 2, y = box.top + box.height / 2;
    if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) return null;
    const top = document.elementFromPoint(x, y);
    return top === target || target.contains(top) ? { x, y } : null;
  })()`;
}
async function handle(message, sender) {
  await ready;
  if (sender.id !== chrome.runtime.id) throw new Error('Remetente inválido.');
  const popup = sender.url === chrome.runtime.getURL('popup.html');
  const game = sender.tab && sender.frameId === 0 && isGame(sender.url);
  if (!popup && !game) throw new Error('Origem não autorizada.');
  if (message.type === 'bot.status') return { ...state, running: state.tabId !== null && (popup || sender.tab.id === state.tabId) };
  if (message.type === 'bot.stop') {
    if (popup || sender.tab.id === state.tabId) return stop(typeof message.error === 'string' ? message.error.slice(0, 200) : '');
    return { ...state };
  }
  if (message.type === 'bot.start') {
    if (!popup) throw new Error('Inicie pelo ícone da extensão.');
    if (pending) throw new Error('Aguarde a operação anterior.');
    const operation = {}; pending = operation;
    try {
      if (!await chrome.permissions.contains({ permissions: ['debugger'] })) throw new Error('Autorize a permissão de depuração para clicar automaticamente.');
      const tab = await chrome.tabs.get(message.tabId);
      if (!isGame(tab.url) || !tab.active) throw new Error('Deixe a aba do Deep Dig aberta e selecionada.');
      if (state.tabId !== null) await stop();
      pending = operation; const revision = generation;
      await chrome.storage.local.set({ enabled: true });
      await chrome.debugger.attach({ tabId: tab.id }, '1.3');
      if (revision !== generation) { await chrome.debugger.detach({ tabId: tab.id }); throw new Error('Início cancelado.'); }
      state = { tabId: tab.id, clicks: 0, error: '' };
      lastClick = 0;
      await publish();
      return { ...state, running: true };
    } finally { if (pending === operation) pending = null; }
  }
  if (message.type === 'bot.cancel') {
    if (game && sender.tab.id === state.tabId) cancelRequest();
    return { canceled: true };
  }
  if (message.type === 'bot.click') {
    if (!game || sender.tab.id !== state.tabId || !['fire', 'next'].includes(message.action)) throw new Error('Automação inativa nesta aba.');
    if (pending || Date.now() - lastClick < 500) return { skipped: true };
    if (message.action === 'fire' && !Number.isFinite(message.fireAt)) throw new Error('Recarregue o jogo para atualizar o modo automático.');
    const fireAt = message.action === 'fire' ? message.fireAt : null;
    const maxLateMs = Math.max(2, Math.min(8, Number.isFinite(message.maxLateMs) ? message.maxLateMs : 4));
    if (fireAt !== null && (fireAt - Date.now() > 2700 || Date.now() - fireAt > maxLateMs)) return { skipped: true, late: true };
    const operation = {}; pending = operation;
    const revision = generation, tabId = state.tabId, valid = () => generation === revision && state.tabId === tabId;
    try {
      // Do the DOM preflight before the launch window, then dispatch at its midpoint.
      if (fireAt !== null && (!await waitUntil(fireAt - 40) || !valid())) return { canceled: true };
      const tab = await chrome.tabs.get(tabId);
      if (!valid()) return { canceled: true };
      if (!isGame(tab.url) || !tab.active) return await stop('Automático parado: a aba do jogo perdeu o foco.');
      const target = { tabId };
      const response = await chrome.debugger.sendCommand(target, 'Runtime.evaluate', { expression: clickPosition(message.action), returnByValue: true });
      const point = response.result?.value;
      if (!point || !valid()) return { skipped: true };
      if (fireAt !== null && (!await waitUntil(fireAt) || !valid())) return { canceled: true };
      // Drop stale launches instead of firing after the aim has already moved away.
      if (fireAt !== null && Date.now() - fireAt > maxLateMs) return { skipped: true, late: true };
      lastClick = Date.now();
      await chrome.debugger.sendCommand(target, 'Input.dispatchMouseEvent', { type: 'mousePressed', x: point.x, y: point.y, button: 'left', buttons: 1, clickCount: 1 });
      try {
        await chrome.debugger.sendCommand(target, 'Input.dispatchMouseEvent', { type: 'mouseReleased', x: point.x, y: point.y, button: 'left', buttons: 0, clickCount: 1 });
      } finally {
        if (valid()) { state.clicks++; await publish(); }
      }
      return { clicked: true, clicks: state.clicks, lateMs: fireAt === null ? 0 : lastClick - fireAt };
    } catch (error) {
      if (valid()) await stop(`Automático parado: ${error.message}`);
      throw error;
    } finally { if (pending === operation) pending = null; }
  }
  throw new Error('Comando desconhecido.');
}
chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (!message?.type?.startsWith('bot.') || message.type === 'bot.state') return;
  handle(message, sender).then(result => reply({ ok: true, ...result }), error => reply({ ok: false, error: error.message }));
  return true;
});
chrome.debugger.onDetach.addListener(source => {
  ready.then(() => { if (source.tabId === state.tabId) return stop('Controle desconectado. Ative o automático novamente.'); }).catch(() => {});
});
chrome.tabs.onRemoved.addListener(tabId => { ready.then(() => { if (tabId === state.tabId) return stop(); }).catch(() => {}); });
chrome.tabs.onUpdated.addListener((tabId, change) => {
  ready.then(() => { if (tabId === state.tabId && (change.status === 'loading' || (change.url && !isGame(change.url)))) return stop('Página recarregada. Ative o automático novamente.'); }).catch(() => {});
});
chrome.tabs.onActivated.addListener(info => {
  ready.then(() => { if (state.tabId !== null && info.tabId !== state.tabId) return stop('Automático parado ao trocar de aba.'); }).catch(() => {});
});

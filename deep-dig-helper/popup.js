'use strict';
const toggle = document.getElementById('enabled'), start = document.getElementById('start'), stop = document.getElementById('stop'), status = document.getElementById('state');
chrome.storage.local.get({ enabled: true }).then(prefs => { toggle.checked = prefs.enabled; });
toggle.addEventListener('change', () => chrome.storage.local.set({ enabled: toggle.checked }));
function render(state) {
  const running = state.tabId !== null;
  start.hidden = running; stop.hidden = !running;
  status.textContent = running ? `Ligado · ${state.clicks} cliques enviados` : state.error || 'Automático desligado';
}
chrome.runtime.sendMessage({ type: 'bot.status' }).then(state => { if (state.ok) render(state); });
start.addEventListener('click', async () => {
  start.disabled = true;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url?.startsWith('https://deep-dig.xyz/')) throw new Error('Abra o popup com a aba do Deep Dig selecionada.');
    const result = await chrome.runtime.sendMessage({ type: 'bot.start', tabId: tab.id });
    if (!result.ok) throw new Error(result.error);
    toggle.checked = true; render(result);
  } catch (error) { status.textContent = error.message; }
  finally { start.disabled = false; }
});
stop.addEventListener('click', async () => {
  const result = await chrome.runtime.sendMessage({ type: 'bot.stop' });
  if (result.ok) render(result);
});
chrome.storage.onChanged.addListener((changes, area) => { if (area === 'session' && changes.botState) render(changes.botState.newValue); });

const strategy = document.getElementById('strategy');
chrome.storage.local.get({ strategy: 'survive' }).then(prefs => { strategy.value = prefs.strategy; });
strategy.addEventListener('change', () => chrome.storage.local.set({ strategy: strategy.value }));

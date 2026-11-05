(() => {
  'use strict';
  if (document.getElementById('deep-dig-visual-helper')) return;
  const V = globalThis.DeepDigVision;
  const host = document.createElement('div');
  host.id = 'deep-dig-visual-helper';
  host.style.cssText = 'all:initial;position:fixed;inset:0;pointer-events:none;z-index:2147483647';
  const shadow = host.attachShadow({ mode: 'closed' });
  shadow.innerHTML = `<style>
    *{box-sizing:border-box}canvas{position:fixed;pointer-events:none}
    aside{position:fixed;right:12px;bottom:12px;max-width:min(350px,calc(100vw - 24px));padding:12px 15px;background:#171420f2;color:#f7ecd2;border:1px solid #a88643;border-radius:12px;font:13px/1.5 system-ui;box-shadow:0 4px 24px #0008;pointer-events:auto}
    b{color:#ffdb6e}p{margin:5px 0}small{color:#c5bbc9}button{float:right;margin-left:16px;background:#35303e;color:#fff;border:1px solid #776581;border-radius:5px;cursor:pointer;padding:3px 8px}
    [hidden]{display:none!important}
  </style><canvas hidden></canvas><aside hidden><button type="button" aria-label="Parar automático e desligar ajuda">Parar</button><b id="title">Mira visual</b><p id="status"></p><small id="hint">Ative a coleta automática no ícone da extensão.</small></aside>`;
  document.documentElement.append(host);
  const overlay = shadow.querySelector('canvas'), panel = shadow.querySelector('aside'), status = shadow.querySelector('#status');
  overlay.width = V.width * 3; overlay.height = V.height * 3;
  const ctx = overlay.getContext('2d');
  let strategy = 'survive';
  let enabled = true, automatic = false, sending = false, scheduledAt = 0, lastShot = -Infinity;
  let lastScan = -Infinity, lastStatusPaint = 0, lastCheck = 0, source = null, sensor = null, items = [], missedFrames = 0;
  let lastText = '', lastStage = '', currentPlan = null, lastBox = '';
  const tracker = V.createTracker(), title = shadow.querySelector('#title'), hint = shadow.querySelector('#hint');
  function reset() { tracker.reset(); items = []; lastScan = -Infinity; currentPlan = null; }
  function botState(state) {
    const was = automatic;
    automatic = state.tabId !== null && state.running !== false;
    if (automatic !== was) { reset(); lastShot = -Infinity; }
    title.textContent = automatic ? 'Coleta automática LIGADA' : 'Mira visual';
    hint.textContent = automatic ? 'Mantenha esta aba selecionada. Esc ou Parar interrompe.' : state.error || 'Ative a coleta automática no ícone da extensão.';
  }
  chrome.runtime.sendMessage({ type: 'bot.status' }).then(state => { if (state.ok) botState(state); }).catch(() => {});
  chrome.runtime.onMessage.addListener(message => { if (message.type === 'bot.state') botState(message); });
  chrome.storage.local.get({ enabled: true, strategy: 'survive' }).then(prefs => { enabled = prefs.enabled; strategy = prefs.strategy; });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes.enabled) enabled = changes.enabled.newValue;
    if (changes.strategy) { strategy = changes.strategy.newValue; if (sending) chrome.runtime.sendMessage({ type: 'bot.cancel' }).catch(() => {}); reset(); }
  });
  function stopBot(error = '') {
    automatic = false; reset();
    chrome.runtime.sendMessage({ type: 'bot.stop', error }).then(state => { if (state.ok) botState(state); }).catch(() => {});
  }
  shadow.querySelector('button').addEventListener('click', () => { stopBot(); chrome.storage.local.set({ enabled: false }); });
  addEventListener('keydown', event => { if (event.code === 'Escape' && automatic) stopBot(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && automatic) stopBot(); });
  const visible = element => element && !element.closest('[hidden]') && element.getClientRects().length && getComputedStyle(element).visibility !== 'hidden';
  function click(action, planned = null) {
    const now = performance.now();
    if (sending || now - lastShot < 500) return;
    sending = true; scheduledAt = planned?.at || now;
    chrome.runtime.sendMessage({ type: 'bot.click', action, fireAt: planned ? performance.timeOrigin + planned.at : undefined, maxLateMs: planned?.maxLateMs }).then(result => {
      if (!result.ok) { stopBot(result.error); return; }
      if (result.clicked) { lastShot = performance.now(); tracker.reset(); lastScan = -Infinity; }
      if ('tabId' in result) botState(result);
    }).catch(() => { stopBot('Recarregue o jogo e reative a extensão.'); }).finally(() => { sending = false; currentPlan = null; });
  }
  function scan(now) {
    const next = V.ores(sensor.getImageData(0, 0, V.width, V.height).data);
    for (const item of next) {
      item.seenAt = now;
      if (!item.moving) continue;
      const before = items.filter(old => old.kind === item.kind && Math.abs(old.y - item.y) < 3).sort((a, b) => Math.abs(a.x - item.x) - Math.abs(b.x - item.x))[0];
      if (before && now - before.seenAt >= 80 && now - before.seenAt < 600 && Math.abs(item.x - before.x) < 35) item.vx = (item.x - before.x) * 1000 / (now - before.seenAt);
    }
    items = next; lastScan = now;
  }
  function phaseContext() {
    const values = document.getElementById('rushGoal')?.textContent.split('/').map(part => Number(part.replace(/[^0-9]/g, '')));
    const time = document.getElementById('rushTime')?.textContent.match(/(\d+):(\d{2})/);
    const phase = Math.max(1, Number(document.getElementById('rushPhase')?.textContent) || 1);
    const bonuses = [...(document.getElementById('rushChip')?.querySelectorAll('em') || [])].map(el => Number(el.textContent.match(/(\d+)%/)?.[1]) || 0);
    return {
      mode: strategy,
      remainingValue: values?.length === 2 && values[1] > values[0] ? values[1] - values[0] : Infinity,
      secondsLeft: time ? Math.max(0, Number(time[1]) * 60 + Number(time[2]) - 0.75) : Infinity,
      richness: 1 + 0.05 * (phase - 1),
      valueMultiplier: 1 + (bonuses[0] || 0) / 100,
      pullMultiplier: 1 + (bonuses[1] || 0) / 100
    };
  }
  function paint(now, aim, text) {
    const box = source.getBoundingClientRect();
    if (Math.abs(box.width / box.height - V.width / V.height) > 0.1) { overlay.hidden = true; return; }
    const boxKey = `${box.left},${box.top},${box.width},${box.height}`;
    if (boxKey !== lastBox) {
      Object.assign(overlay.style, { left: `${box.left}px`, top: `${box.top}px`, width: `${box.width}px`, height: `${box.height}px` });
      lastBox = boxKey;
    }
    if (text !== lastText && now - lastStatusPaint >= 80) { status.textContent = text; lastText = text; lastStatusPaint = now; }
    ctx.setTransform(3, 0, 0, 3, 0, 0); ctx.clearRect(0, 0, V.width, V.height);
    const best = currentPlan?.item;
    for (const item of items) {
      ctx.strokeStyle = V.kinds[item.kind].color; ctx.lineWidth = item === best ? 1 : 0.5;
      ctx.setLineDash(item === best ? [] : [2, 2]); ctx.beginPath(); ctx.arc(item.x, item.y, item.radius + 2, 0, Math.PI * 2); ctx.stroke();
      if (item === best) { ctx.fillStyle = '#fff'; ctx.font = 'bold 5px sans-serif'; ctx.fillText('★', item.x - 2, item.y - item.radius - 3); }
    }
    if (aim) {
      const hit = V.firstHit(items, aim);
      ctx.strokeStyle = hit ? (hit.kind === 'stone' ? '#ff7272' : V.kinds[hit.kind].color) : '#ffffff99';
      ctx.lineWidth = 0.75; ctx.setLineDash([3, 2]); ctx.beginPath();
      ctx.moveTo(V.pivot.x + aim.dx * 14, V.pivot.y + aim.dy * 14); ctx.lineTo(V.pivot.x + aim.dx * 280, V.pivot.y + aim.dy * 280); ctx.stroke();
    }
  }
  const frames = new MessageChannel();
  frames.port1.onmessage = () => requestAnimationFrame(draw);
  function nextFrame() {
    // Register after this animation-frame batch, so the game's next frame runs first.
    frames.port2.postMessage(null);
  }
  function draw(now) {
    nextFrame();
    if (now - lastCheck >= 100 || !source) {
      lastCheck = now;
      const game = document.getElementById('rushCanvas');
      if (game !== source) { source = game; sensor = source?.getContext('2d'); reset(); }
      const active = enabled && !document.hidden && visible(source);
      panel.hidden = overlay.hidden = !active;
      if (!active) { if (automatic) stopBot(); lastStage = 'hidden'; return; }
    }
    if (panel.hidden || !source) return;
    const modal = document.getElementById('rushModal'), playing = modal?.querySelector('.rush.playing');
    const done = visible(document.getElementById('rushDone'));
    const over = visible(document.getElementById('rushOver')) || visible(document.getElementById('rushEnd'));
    const stage = over ? 'over' : done ? 'done' : playing ? 'play' : 'lobby';
    if (stage !== lastStage) { reset(); lastStage = stage; }
    if (automatic && over) stopBot('Rodada encerrada. Inicie outra manualmente para continuar.');
    if (done) { if (automatic) click('next'); paint(now, null, automatic ? 'Fase concluída. Avançando…' : 'Fase concluída.'); return; }
    if (source.width !== V.width || source.height !== V.height) { overlay.hidden = true; if (automatic) stopBot('Tabuleiro incompatível com esta versão.'); return; }
    try {
      // Read only 561 pixels at frame rate. The whole field is scanned at most 5 times/sec, only while idle.
      const crop = V.claw, aim = V.direction(sensor.getImageData(crop.x, crop.y, crop.width, crop.height).data, true);
      const sampledAt = performance.now(), model = tracker.observe(aim, sampledAt);
      if (aim) { missedFrames = 0; if (sampledAt - lastScan >= 220) scan(sampledAt); }
      else {
        missedFrames++;
        if (missedFrames >= 2 && sending && scheduledAt - sampledAt > 30) chrome.runtime.sendMessage({ type: 'bot.cancel' }).catch(() => {});
      }
      let text = aim ? 'Sincronizando com o movimento da garra…' : 'Aguardando o gancho voltar…';
      if (automatic && stage === 'play' && !sending && model && sampledAt - lastShot >= 500) {
        currentPlan = V.plan(items, model, sampledAt, phaseContext());
        if (currentPlan) click('fire', currentPlan);
      }
      if (sending && currentPlan) text = `Mira sincronizada: ${V.kinds[currentPlan.item.kind].name} · lançamento agendado`;
      else if (automatic && stage === 'lobby') text = 'Comece a rodada no botão JOGAR.';
      else if (!automatic) text = aim ? 'Mira visual · ative o automático pelo ícone da extensão.' : 'Gancho em movimento.';
      paint(now, aim, text);
    } catch (error) { overlay.hidden = true; if (automatic) stopBot(`Erro ao ler o tabuleiro: ${error.message}`); }
  }
  nextFrame();
})();

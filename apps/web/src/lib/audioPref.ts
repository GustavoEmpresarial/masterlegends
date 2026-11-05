const KEY = 'mll_audio_muted';
const EVENT = 'mll-audio-pref';

export function isAudioMuted(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function setAudioMuted(muted: boolean): void {
  try {
    localStorage.setItem(KEY, muted ? '1' : '0');
  } catch {
    /* private mode */
  }
  window.dispatchEvent(new Event(EVENT));
}

export function subscribeAudioPref(listener: () => void): () => void {
  window.addEventListener(EVENT, listener);
  window.addEventListener('storage', listener);
  return () => {
    window.removeEventListener(EVENT, listener);
    window.removeEventListener('storage', listener);
  };
}

/** Square-wave blip, skipped when the cabinet is muted. */
export function playUiBlip(): void {
  if (isAudioMuted()) return;
  const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return;
  const ctx = new AudioCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'square';
  osc.frequency.value = 740;
  gain.gain.value = 0.035;
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.045);
  osc.onended = () => {
    void ctx.close();
  };
}

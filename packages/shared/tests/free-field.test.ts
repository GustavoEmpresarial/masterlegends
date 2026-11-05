import { describe, expect, it } from 'vitest';
import {
  FREE_FIELD_COOLDOWN_MS,
  FREE_FIELD_PLAY_MS,
  freeFieldStatus,
  staysOnFreeField,
} from '@mll/shared';

const start = Date.parse('2026-10-16T12:00:00.000Z');

describe('free field window', () => {
  it('gives unstaked players 5 minutes, then locks them until 24 hours', () => {
    expect(freeFieldStatus({ staked: true, windowStartedAt: start, now: start }).state).toBe('unlimited');
    expect(freeFieldStatus({ staked: false, windowStartedAt: null, now: start }).state).toBe('ready');

    const playing = freeFieldStatus({ staked: false, windowStartedAt: start, now: start + 60_000 });
    expect(playing.state).toBe('playing');
    expect(Date.parse(playing.playEndsAt ?? '')).toBe(start + FREE_FIELD_PLAY_MS);

    const locked = freeFieldStatus({
      staked: false,
      windowStartedAt: start,
      now: start + FREE_FIELD_PLAY_MS,
    });
    expect(locked.state).toBe('locked');
    expect(Date.parse(locked.nextPlayAt ?? '')).toBe(start + FREE_FIELD_COOLDOWN_MS);

    expect(
      freeFieldStatus({
        staked: false,
        windowStartedAt: start,
        now: start + FREE_FIELD_COOLDOWN_MS,
      }).state,
    ).toBe('ready');
  });

  it('keeps a player on the pitch only while staked or inside the 5 minutes', () => {
    expect(staysOnFreeField(true, null, start)).toBe(true);
    expect(staysOnFreeField(false, null, start)).toBe(false);
    expect(staysOnFreeField(false, start, start + 1_000)).toBe(true);
    expect(staysOnFreeField(false, start, start + FREE_FIELD_PLAY_MS)).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { advanceSpriteGait, playerSpriteFrame } from '../../../src/components/stadium/playerSpriteMotion';
import { cardSpritePath } from '../../../src/components/stadium/cardBonecoCutout';

describe('generated player animation', () => {
  it('uses all six locomotion poses and keeps idle/kick separate', () => {
    const frames = new Set(Array.from({ length: 60 }, (_, i) => playerSpriteFrame('run', i * 20)));
    expect([...frames].sort()).toEqual([1, 2, 3, 4, 5, 6]);
    expect(playerSpriteFrame('idle', 700)).toBe(0);
    expect(playerSpriteFrame('kick', 700)).toBe(7);
    expect(playerSpriteFrame('run', 700, true)).toBe(0);
  });
  it('ties cadence to speed and keeps it independent of frame rate', () => {
    const at30 = Array.from({ length: 30 }).reduce<number>((v) => advanceSpriteGait(v, 120 / 30, 1 / 30, 3), 0);
    const at60 = Array.from({ length: 60 }).reduce<number>((v) => advanceSpriteGait(v, 120 / 60, 1 / 60, 3), 0);
    expect(at30).toBeCloseTo(at60);
    expect(advanceSpriteGait(0, 20, 1, 3)).toBeLessThan(at30);
    expect(advanceSpriteGait(77, 0, 1, 3)).toBe(77);
  });
  it('matches card URLs including absolute origins and cache queries', () => {
    const path = '/uploads/items/catalog/comum-01.png';
    expect(cardSpritePath(path)).toMatch(/^\/ui\/player-sprites\/.+\.webp$/);
    expect(cardSpritePath(`https://masterlegends.online${path}?v=42`)).toBe(cardSpritePath(path));
    expect(cardSpritePath('/uploads/items/unknown.png')).toBeNull();
    expect(cardSpritePath('http://[')).toBeNull();
  });
});

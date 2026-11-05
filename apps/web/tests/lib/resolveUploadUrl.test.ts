import { describe, it, expect } from 'vitest';
import { pointerToPct } from '../../src/lib/resolveUploadUrl';

describe('pointerToPct', () => {
  const rect = { left: 0, top: 0, width: 200, height: 100 } as DOMRect;

  it('maps center click to 50%, 50%', () => {
    expect(pointerToPct(100, 50, rect)).toEqual({ xPct: 50, yPct: 50 });
  });

  it('clamps to 0–100', () => {
    expect(pointerToPct(-10, 150, rect)).toEqual({ xPct: 0, yPct: 100 });
  });

  it('snaps to grid', () => {
    expect(pointerToPct(103, 47, rect, 2)).toEqual({ xPct: 52, yPct: 48 });
  });
});

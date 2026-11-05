import { act, cleanup, render } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { StadiumMatchCanvas } from '../../../src/components/stadium/StadiumMatchCanvas';
import { drawPlayfieldBall } from '../../../src/components/stadium/stadiumPlayfieldDraw';

vi.mock('../../../src/components/stadium/stadiumPlayfieldDraw', () => ({
  drawPlayfieldBall: vi.fn(), drawPlayfieldPlayer: vi.fn(),
}));

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it('continues animating when the first frame timestamp precedes effect setup', () => {
  let frame: FrameRequestCallback = () => {};
  vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => { frame = callback; return 1; }));
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
  vi.spyOn(performance, 'now').mockReturnValue(200);
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    setTransform: vi.fn(), clearRect: vi.fn(),
  } as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({
    width: 800, height: 600,
  } as DOMRect);
  render(<StadiumMatchCanvas imageUrl="/stadium.webp" slots={[{
    slot: { id: 'keeper', role: 'GK', xPct: 8, yPct: 68 },
    player: { id: 'keeper', kind: 'base', position: 'GK', name: 'Goleiro', overwall: 5 },
  }]} />);
  expect(() => act(() => frame(190))).not.toThrow();
  act(() => frame(230));
  expect(drawPlayfieldBall).toHaveBeenCalledTimes(2);
  for (const call of vi.mocked(drawPlayfieldBall).mock.calls) {
    expect(Number.isFinite(call[1])).toBe(true);
    expect(Number.isFinite(call[2])).toBe(true);
  }
});

import { describe, it, expect } from 'vitest';
import {
  MAX_STADIUM_SLOTS,
  parseStadiumSlotsJson,
  stadiumSlotSchema,
  stadiumTemplateCreateSchema,
} from '../../src/schemas/stadium.js';

describe('stadiumSlotSchema', () => {
  it('accepts valid slot', () => {
    const slot = stadiumSlotSchema.parse({
      id: 'abc',
      label: 'GOL',
      xPct: 50,
      yPct: 82,
      role: 'GK',
    });
    expect(slot.label).toBe('GOL');
  });

  it('rejects xPct out of range', () => {
    expect(() =>
      stadiumSlotSchema.parse({ id: 'a', label: 'X', xPct: 101, yPct: 50 }),
    ).toThrow();
  });
});

describe('stadiumTemplateCreateSchema', () => {
  it('rejects more than max slots', () => {
    const slots = Array.from({ length: MAX_STADIUM_SLOTS + 1 }, (_, i) => ({
      id: `s${i}`,
      label: `Slot ${i}`,
      xPct: 50,
      yPct: 50,
    }));
    expect(() => stadiumTemplateCreateSchema.parse({ name: 'Test', slots })).toThrow();
  });

  it('accepts nullable priceUsdc', () => {
    const parsed = stadiumTemplateCreateSchema.parse({
      name: 'Neon',
      slots: [],
      priceUsdc: null,
    });
    expect(parsed.priceUsdc).toBeNull();
  });
});

describe('parseStadiumSlotsJson', () => {
  it('parses JSON string', () => {
    const slots = parseStadiumSlotsJson('[{"id":"1","label":"A","xPct":10,"yPct":20}]');
    expect(slots).toHaveLength(1);
    expect(slots[0].xPct).toBe(10);
  });
});

describe('remapAssignmentsToDisplaySlots', () => {
  it('keeps a lateral when the stadium slot ids differ', async () => {
    const { remapAssignmentsToDisplaySlots } = await import('../../src/schemas/stadium.js');
    const source = [
      { id: 'vest-gk', label: 'GOL', xPct: 50, yPct: 80, role: 'GK' as const },
      { id: 'vest-lat', label: 'LAT', xPct: 15, yPct: 40, role: 'LAT' as const },
    ];
    const display = [
      { id: 'pitch-gk', label: 'GOL', xPct: 50, yPct: 80, role: 'GK' as const },
      { id: 'pitch-lat', label: 'LAT', xPct: 15, yPct: 40, role: 'LAT' as const },
    ];
    const mapped = remapAssignmentsToDisplaySlots(source, display, {
      'vest-gk': { playerId: 'gk1', kind: 'base' },
      'vest-lat': { playerId: 'lat1', kind: 'base' },
    });
    expect(mapped['pitch-lat']?.playerId).toBe('lat1');
    expect(mapped['pitch-gk']?.playerId).toBe('gk1');
  });
});

describe('lineupPatchSchema', () => {
  it('accepts valid assignments', async () => {
    const { lineupPatchSchema } = await import('../../src/schemas/stadium.js');
    const parsed = lineupPatchSchema.parse({
      assignments: { s1: { playerId: 'bp1', kind: 'base' } },
    });
    expect(parsed.assignments.s1.playerId).toBe('bp1');
  });
});

describe('rival slots', () => {
  it('keeps side and moves a placed opponent', async () => {
    const { buildRivalSlots, isAwaySlot } = await import('../../src/stadium-rivals.js');
    const parsed = stadiumSlotSchema.parse({
      id: 'rival-gk',
      label: 'GOL',
      xPct: 90,
      yPct: 40,
      role: 'GK',
      side: 'away',
    });
    expect(isAwaySlot(parsed)).toBe(true);
    expect(isAwaySlot({ id: 'home-1' })).toBe(false);
    const [gk] = buildRivalSlots([parsed]);
    expect(gk?.slot.xPct).toBe(90);
    expect(gk?.slot.yPct).toBe(40);
    expect(gk?.player?.name).toBe('Kovač');
  });
});

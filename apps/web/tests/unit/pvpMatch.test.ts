import { describe, expect, it } from 'vitest';
import { planAttack, sampleAttack, sampleFlow, type FilmRosterPlayer } from '../../src/components/pvp/pvpFilm';
import { resolveShot, teamPower, winnerOf } from '../../src/components/pvp/pvpMatch';

describe('first to 3', () => {
  it('ends when either side reaches 3', () => {
    expect(winnerOf(2, 2)).toBeNull();
    expect(winnerOf(3, 1)).toBe('home');
    expect(winnerOf(0, 3)).toBe('away');
  });

  it('scores on an open side and saves a correct dive', () => {
    expect(resolveShot('left', 'right', 100, 100, 0.5)).toBe('goal');
    expect(resolveShot('left', 'left', 100, 100, 0.5)).toBe('save');
    expect(resolveShot(null, 'center', 100, 100, 0.1)).toBe('miss');
  });

  it('lets a much stronger attack beat the keeper', () => {
    expect(resolveShot('center', 'center', 200, 100, 0.1)).toBe('goal');
    expect(resolveShot('center', 'center', 200, 100, 0.9)).toBe('save');
  });

  it('uses a modest power when the lineup is empty', () => {
    expect(teamPower([])).toBe(440);
    expect(teamPower([10, 20])).toBe(30);
  });

  it('moves the ball to the goal by itself', () => {
    const roster: FilmRosterPlayer[] = [
      { id: 'h', side: 'home', position: 'FW', rarity: 'rare', overwall: 80, seed: 'h', slotRole: 'FW', name: 'Ata', xPct: 40, yPct: 50, index: 0 },
      { id: 'a', side: 'away', position: 'GK', rarity: 'rare', overwall: 80, seed: 'a', slotRole: 'GK', name: 'Gol', xPct: 90, yPct: 50, index: 1 },
    ];
    const plan = planAttack('home', roster, 100, 100, () => 0);
    const start = sampleAttack(roster, plan, 0.1);
    const end = sampleAttack(roster, plan, 0.95);
    expect(start.ball.xPct).toBeLessThan(end.ball.xPct);
    expect(end.players.find((p) => p.id === 'h')?.pose).not.toBe('run');
  });

  it('keeps the outfield running and the ball moving', () => {
    const roster: FilmRosterPlayer[] = [
      { id: 'h', side: 'home', position: 'FW', rarity: 'rare', overwall: 80, seed: 'h', slotRole: 'FW', name: 'Ata', xPct: 40, yPct: 40, index: 0 },
      { id: 'm', side: 'home', position: 'MID', rarity: 'rare', overwall: 70, seed: 'm', slotRole: 'MID', name: 'Mei', xPct: 30, yPct: 60, index: 1 },
    ];
    const a = sampleFlow(roster, 0.1);
    const b = sampleFlow(roster, 0.7);
    expect(a.players.every((p) => p.pose === 'run')).toBe(true);
    expect(Math.hypot(a.ball.xPct - b.ball.xPct, a.ball.yPct - b.ball.yPct)).toBeGreaterThan(1);
  });
});

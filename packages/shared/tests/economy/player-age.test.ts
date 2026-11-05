import { describe, expect, it } from 'vitest';
import {
  PLAYER_CAREER_RETIRE_AGE,
  PLAYER_CAREER_START_AGE,
  playerAgeFromRoi,
} from '../../src/economy/player-age.js';

describe('playerAgeFromRoi', () => {
  it('maps 0% ROI to age 18', () => {
    const r = playerAgeFromRoi(2, 0);
    expect(r.hasCareerCycle).toBe(true);
    expect(r.age).toBe(PLAYER_CAREER_START_AGE);
    expect(r.roiPct).toBe(0);
    expect(r.isRetired).toBe(false);
  });

  it('maps 100% ROI (earned = cost) to age 29', () => {
    const r = playerAgeFromRoi(2, 2);
    expect(r.age).toBe(29);
    expect(r.roiPct).toBe(100);
    expect(r.isRetired).toBe(false);
  });

  it('maps 200% ROI to age 40 and retired', () => {
    const r = playerAgeFromRoi(2, 4);
    expect(r.age).toBe(PLAYER_CAREER_RETIRE_AGE);
    expect(r.roiPct).toBe(200);
    expect(r.isRetired).toBe(true);
  });

  it('clamps above 200% at age 40', () => {
    const r = playerAgeFromRoi(2, 10);
    expect(r.age).toBe(40);
    expect(r.isRetired).toBe(true);
  });

  it('zero cost has no career cycle', () => {
    const r = playerAgeFromRoi(0, 5);
    expect(r.hasCareerCycle).toBe(false);
    expect(r.age).toBe(18);
    expect(r.isRetired).toBe(false);
  });

  it('alreadyRetired forces retired flag for free players', () => {
    const r = playerAgeFromRoi(0, 0, { alreadyRetired: true });
    expect(r.isRetired).toBe(true);
  });
});

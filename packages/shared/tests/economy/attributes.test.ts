import { describe, expect, it } from 'vitest';
import {
  POSITION_ATTRIBUTE_WEIGHTS,
  evolveMainAttribute,
  fnv1a32,
  positionPower,
  rollPlayerAttributes,
  trainingEvolutionStep,
} from '@mll/shared';

describe('player attributes', () => {
  it('keeps each role weight at 1', () => {
    for (const weights of Object.values(POSITION_ATTRIBUTE_WEIGHTS)) {
      const total = Object.values(weights).reduce((sum, weight) => sum + (weight ?? 0), 0);
      expect(total).toBeCloseTo(1, 10);
    }
  });

  it('rolls inside the rarity band and makes finishing matter for a striker', () => {
    const rolled = rollPlayerAttributes('striker-weak', 0, 3);
    const weak = { ...rolled, finalizacao: 1, ataque: 1 };
    const strong = { ...rolled, finalizacao: 10, ataque: 10 };
    const weakPower = positionPower(weak, 'FW');
    const strongPower = positionPower(strong, 'FW');
    expect(weakPower).toBeGreaterThanOrEqual(1);
    expect(weakPower).toBeLessThanOrEqual(10);
    expect(strongPower).toBeGreaterThan(weakPower);
    expect(fnv1a32('same')).toBe(fnv1a32('same'));
  });

  it('raises the role attribute by the training step and stops at the band top', () => {
    expect(trainingEvolutionStep(1)).toBe(1);
    expect(trainingEvolutionStep(4)).toBe(2);
    expect(trainingEvolutionStep(7)).toBe(3);
    expect(trainingEvolutionStep(10)).toBe(4);

    const base = rollPlayerAttributes('evo-1', 0, 'FW');
    const raised = evolveMainAttribute({ ...base, finalizacao: 9 }, 'FW', 0, 4);
    expect(raised.key).toBe('finalizacao');
    expect(raised.after).toBe(10);

    const capped = evolveMainAttribute({ ...base, finalizacao: 10 }, 'FW', 0, 10);
    expect(capped.after).toBe(10);
  });

  it('leaves goalkeeper attribute at zero for outfield players', () => {
    const attacker = rollPlayerAttributes('ata-1', 2, 'FW');
    expect(attacker.goleiro).toBe(0);
    const keeper = rollPlayerAttributes('gol-1', 2, 'GK');
    expect(keeper.goleiro).toBeGreaterThan(0);
  });
});

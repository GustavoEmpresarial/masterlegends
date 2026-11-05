import { describe, it, expect } from 'vitest';
import { aggregateLineupPowerByUser } from '../../src/mining/lineup-power.js';

describe('aggregateLineupPowerByUser', () => {
  it('counts only players assigned to stadium lineup slots', () => {
    const power = aggregateLineupPowerByUser(
      [
        {
          assignments: {
            gk: { kind: 'base', playerId: 'b1' },
            fw: { kind: 'nft', playerId: '42' },
          },
          club: { userId: 'u1', user: { wallet: '0xABC' } },
        },
      ],
      [
        { id: 'b1', userId: 'u1', overwall: 500 },
        { id: 'b2', userId: 'u1', overwall: 9000 },
      ],
      [{ tokenId: 42n, ownerWallet: '0xabc', overwall: 1500 }],
    );

    expect(power.get('u1')).toBe(2000);
  });

  it('excludes users with empty lineup', () => {
    const power = aggregateLineupPowerByUser(
      [{ assignments: {}, club: { userId: 'u1', user: { wallet: '0x1' } } }],
      [{ id: 'b1', userId: 'u1', overwall: 500 }],
      [],
    );

    expect(power.size).toBe(0);
  });

  it('ignores duplicate player assignments in the same lineup', () => {
    const power = aggregateLineupPowerByUser(
      [
        {
          assignments: {
            gk: { kind: 'base', playerId: 'b1' },
            fw: { kind: 'base', playerId: 'b1' },
          },
          club: { userId: 'u1', user: { wallet: '0x1' } },
        },
      ],
      [{ id: 'b1', userId: 'u1', overwall: 500 }],
      [],
    );

    expect(power.get('u1')).toBe(500);
  });

  it('ignores lineup players not owned by the club user', () => {
    const power = aggregateLineupPowerByUser(
      [
        {
          assignments: { slot: { kind: 'base', playerId: 'other' } },
          club: { userId: 'u1', user: { wallet: '0x1' } },
        },
      ],
      [{ id: 'other', userId: 'u2', overwall: 800 }],
      [],
    );

    expect(power.size).toBe(0);
  });
});

import { describe, expect, it } from 'vitest';
import { buildRivalSlots, type LineupPlayerDTO } from '@mll/shared';
import { buildMatchActors, type MatchSlotView } from '../../../src/components/stadium/stadiumMatchFormation';

const home: MatchSlotView[] = ['GK','LAT','DEF','DEF','LAT','MID','MID','MID','FW','FW','FW'].map((role,i)=>({
  slot:{id:`s${i}`,role:role as 'GK'|'LAT'|'DEF'|'MID'|'FW',label:role,xPct:50,yPct:50},
  player:{id:`owned-${i}`,kind:'base',name:`Owned ${i}`,rarity:'common',position:role,overwall:500,imageUrl:`/uploads/items/catalog/comum-${i+1}.png`} as LineupPlayerDTO,
}));
describe('approved stadium presentation',()=>{
  it('keeps actual player identity, images and selectable slot ids',()=>{
    const actors=buildMatchActors(home,buildRivalSlots());
    expect(actors).toHaveLength(22);
    expect(actors.filter(a=>a.side==='home').map(a=>a.seed)).toEqual(home.map(r=>r.player!.id));
    expect(actors[0].imageUrl).toBe(home[0].player!.imageUrl);
    expect(actors[0].slotId).toBe('s0');
  });
  it('mirrors formations on the grass and anchors keepers next to the goals',()=>{
    const actors=buildMatchActors(home,buildRivalSlots());
    expect(actors[0].xPct).toBe(8);
    expect(actors.find(a=>a.side==='away' && a.slotRole==='GK')?.xPct).toBe(92);
    expect(actors.every(a=>a.yPct>=51 && a.yPct<=86)).toBe(true);
    expect(actors.filter(a=>a.side==='home').every(a=>a.xPct<=45)).toBe(true);
    expect(actors.filter(a=>a.side==='away').every(a=>a.xPct>=55)).toBe(true);
  });
  it('leaves unowned and decorative slots empty',()=>{
    expect(buildMatchActors([{...home[0],player:null},{...home[1],slot:{...home[1].slot,role:'DECOR'}}])).toEqual([]);
    expect(buildMatchActors([])).toEqual([]);
  });
});

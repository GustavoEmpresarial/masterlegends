import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PassRepository } from '../../../src/modules/pass/pass.service.js';
import { applyMgtDebit } from '../../../src/modules/wallet/mgt-ledger.js';

vi.mock('../../../src/modules/wallet/mgt-ledger.js', () => ({ applyMgtDebit: vi.fn(), applyMgtCredit: vi.fn() }));
function database({ xp = 2000, premium = false, price = 99 } = {}) {
  const season = { id: 1, name: 'Test', active: true, startsAt: new Date(Date.now()-1000), endsAt: new Date(Date.now()+60000), premiumPriceUsdc: price,
    levels: Array.from({length:20}, (_,i)=>({level:i+1,xpRequired:(i+1)*100,rewardType:'usdc',rewardLabel:'GMT',usdcAmount:1})), missions:[],rewardBlocks:[] };
  const progress = { xp, premium };
  const tx = { $queryRaw: vi.fn().mockResolvedValue([]), season:{findFirst:vi.fn().mockResolvedValue(season)},
    passProgress: { upsert:vi.fn().mockResolvedValue(progress), findUniqueOrThrow:vi.fn().mockImplementation(async()=>progress), update:vi.fn().mockImplementation(async()=>{progress.premium=true;return progress;}) } };
  const prisma = { $transaction:vi.fn((operation:any)=>operation(tx)) };
  return { prisma:prisma as any, tx, season };
}
beforeEach(()=>{ vi.mocked(applyMgtDebit).mockReset().mockResolvedValue({balanceAfter:10,transactionId:'tx'}); });
describe('Atomic progress-priced pass purchase',()=>{
  it('locks current progress and records the actual discounted charge before activation',async()=>{
    const {prisma,tx}=database();const result=await new PassRepository(prisma).purchasePremium('user',1);
    expect(result).toMatchObject({basePriceGmt:99,discountGmt:20,priceGmt:79});
    expect(applyMgtDebit).toHaveBeenCalledWith(tx,'user',79,'pass_premium',{seasonId:1,basePriceGmt:99,discountGmt:20,completedLevels:20,totalLevels:20});
    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(tx.$queryRaw.mock.calls.map(call=>call[0].join('?'))).toEqual(expect.arrayContaining([expect.stringContaining('FOR SHARE'),expect.stringContaining('FOR UPDATE')]));
    expect(tx.passProgress.update).toHaveBeenCalledWith({where:{userId_seasonId:{userId:'user',seasonId:1}},data:{premium:true,xp:2000}});
    expect(vi.mocked(applyMgtDebit).mock.invocationCallOrder[0]).toBeLessThan(tx.passProgress.update.mock.invocationCallOrder[0]);
  });
  it('charges full price for a user with no unlocked levels',async()=>{
    const {prisma,tx}=database({xp:0});await new PassRepository(prisma).purchasePremium('new-user',1);
    expect(tx.passProgress.upsert).toHaveBeenCalledWith(expect.objectContaining({create:{userId:'new-user',seasonId:1,xp:0}}));
    expect(applyMgtDebit).toHaveBeenCalledWith(tx,'new-user',99,'pass_premium',expect.objectContaining({discountGmt:0}));
    expect(tx.passProgress.update).toHaveBeenCalledWith({where:{userId_seasonId:{userId:'new-user',seasonId:1}},data:{premium:true,xp:2000}});
  });
  it('does not charge an already premium user or a repeated purchase',async()=>{
    const {prisma}=database();const repo=new PassRepository(prisma);await repo.purchasePremium('user',1);
    await expect(repo.purchasePremium('user',1)).rejects.toMatchObject({code:'PASS_ALREADY_PREMIUM'});
    expect(applyMgtDebit).toHaveBeenCalledOnce();
  });
  it('keeps the activation out of a failed debit transaction',async()=>{
    const {prisma,tx}=database();vi.mocked(applyMgtDebit).mockRejectedValue(new Error('insufficient balance'));
    await expect(new PassRepository(prisma).purchasePremium('user',1)).rejects.toThrow('insufficient balance');
    expect(tx.passProgress.update).not.toHaveBeenCalled();
  });
  it('activates a fully discounted pass without sending an invalid zero debit',async()=>{
    const {prisma,tx}=database({price:7});const pricing=await new PassRepository(prisma).purchasePremium('user',1);
    expect(pricing.priceGmt).toBe(0);expect(applyMgtDebit).not.toHaveBeenCalled();expect(tx.passProgress.update).toHaveBeenCalledOnce();
  });
  it.each(['expired','changed'])('refuses a %s season before charging',async condition=>{
    const {prisma,tx,season}=database();
    if(condition==='expired')season.endsAt=new Date(Date.now()-1000);else season.id=2;
    await expect(new PassRepository(prisma).purchasePremium('user',1)).rejects.toMatchObject({code:'PASS_NO_ACTIVE_SEASON'});
    expect(applyMgtDebit).not.toHaveBeenCalled();expect(tx.passProgress.update).not.toHaveBeenCalled();
  });
});

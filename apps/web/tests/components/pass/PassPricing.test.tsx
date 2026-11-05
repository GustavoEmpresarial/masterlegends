import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { PassPage } from '../../../src/app/pass/page';
import pt from '../../../src/i18n/locales/pt-BR/pass.json';

const fixture=vi.hoisted(()=>({progress:{} as any,buy:vi.fn()}));
vi.mock('../../../src/hooks/useApi',()=>({usePassProgress:()=>({data:fixture.progress,isLoading:false}),useClaimPassLevel:()=>({mutateAsync:vi.fn()}),useBuyPassPremium:()=>({mutateAsync:fixture.buy,isPending:false}),useWalletSummary:()=>({data:{gmtBalance:1000}})}));
vi.mock('../../../src/lib/apiError',()=>({translateError:()=> 'Erro'}));
vi.mock('react-i18next',()=>({useTranslation:()=>({i18n:{language:'pt-BR'},t:translate})}));
function translate(key:string,opts?:Record<string,unknown>){const value=key.replace('pass:','').split('.').reduce<any>((o,k)=>o?.[k],pt);return typeof value==='string'?value.replace(/\{\{(\w+)\}\}/g,(_,k)=>String(opts?.[k]??'')):key;}
const pricing={currency:'GMT',basePriceGmt:99,discountGmt:20,priceGmt:79,completedLevels:20,totalLevels:20,completionPct:100,milestones:[25,50,75,100].map((percent,i)=>({completionPct:percent,requiredLevels:(i+1)*5,discountGmt:(i+1)*5,reached:true}))};
beforeEach(()=>{fixture.buy.mockReset().mockResolvedValue({});fixture.progress={active:true,xp:5000,level:20,premium:false,premiumPriceUsdc:99,premiumPricing:pricing,seasonName:'Master',levels:[],missions:[]};});
afterEach(cleanup);
function renderPass(path = '/pass'){render(<MemoryRouter initialEntries={[path]}><Routes><Route path="pass" element={<PassPage/>}/><Route path="pass/:seasonId" element={<PassPage/>}/></Routes></MemoryRouter>);}
describe('Pass discounted purchase UI',()=>{
  it('uses the authoritative discounted price in the purchase button and shows the breakdown',()=>{
    renderPass();
    const button=screen.getByRole('button',{name:'⭐ PREMIUM (79 GMT)'});
    expect(screen.getByRole('region',{name:'Desconto por progresso'})).toBeTruthy();
    expect(screen.getByText('99 GMT')).toBeTruthy();expect(screen.getAllByText('−20 GMT').length).toBeGreaterThan(0);
    expect(screen.getByText('20 de 20 níveis liberados (100%)')).toBeTruthy();
    fireEvent.click(button);expect(fixture.buy).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('spend-confirm'));
    expect(fixture.buy).toHaveBeenCalledOnce();expect(fixture.buy.mock.calls[0]).toHaveLength(0);
  });
  it('does not offer another purchase or a refund to an already premium account',()=>{
    fixture.progress.premium=true;renderPass();
    expect(screen.queryByRole('button',{name:/PREMIUM/})).toBeNull();expect(screen.queryByRole('region',{name:'Desconto por progresso'})).toBeNull();
  });
  it('keeps the legacy base price while rolling out before the server provides the breakdown',()=>{
    fixture.progress.premiumPricing=undefined;renderPass();
    expect(screen.getByRole('button',{name:'⭐ PREMIUM (99 GMT)'})).toBeTruthy();
  });
  it('opens a chooser with one card per pass before the detail',()=>{
    const mini={...fixture.progress,seasonId:2,seasonName:'Mini passe Master',premiumPriceUsdc:29.9,premiumPricing:{...pricing,priceGmt:29.9,basePriceGmt:29.9}};
    fixture.progress={...fixture.progress,seasonId:1,seasonName:'Campeonato',passes:[
      {...fixture.progress,seasonId:1,seasonName:'Campeonato'},
      mini,
    ]};
    renderPass();
    expect(screen.getByRole('link',{name:/Campeonato/})).toBeTruthy();
    expect(screen.getByRole('link',{name:/Mini passe Master/})).toBeTruthy();
    expect(screen.queryByRole('heading',{name:'MISSÕES DIÁRIAS'})).toBeNull();
    fireEvent.click(screen.getByRole('link',{name:/Mini passe Master/}));
    expect(screen.getByRole('heading',{name:'MISSÕES DIÁRIAS'})).toBeTruthy();
    expect(screen.queryByRole('link',{name:/Campeonato/})).toBeNull();
  });
});

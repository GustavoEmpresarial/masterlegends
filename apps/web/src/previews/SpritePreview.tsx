import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { buildRivalSlots } from '@mll/shared';
import { StadiumMatchCanvas } from '../components/stadium/StadiumMatchCanvas';
import { StadiumPlayfieldLayer } from '../components/stadium/StadiumPlayfieldLayer';
import './sprite-preview.css';

// Full original Campinho image from the active stadium on the VM, with no cover crop.
const STADIUM = '/ui/stadiums/campinho-preview.png';
const roster = [
  ['comum-14', 'Mateus', 'GK', 8, 68],
  ['comum-01', 'Marquinho', 'LAT', 22, 51],
  ['comum-03', 'Dinho', 'DEF', 24, 62],
  ['comum-05', 'Maninho', 'DEF', 24, 75],
  ['comum-06', 'Keipopinho', 'LAT', 22, 86],
  ['comum-02', 'Martinha', 'MID', 35, 53],
  ['comum-07', 'Shyriuzinho', 'MID', 35, 68],
  ['comum-10', 'Paulinho', 'MID', 35, 83],
  ['comum-04', 'Jorginho', 'FW', 45, 55],
  ['comum-09', 'Motinha', 'FW', 46, 68],
  ['comum-11', 'Vladizinho', 'FW', 45, 81],
] as const;
const homeSlots = roster.map(([card, name, role, xPct, yPct], index) => ({
  slot: { id: `home-${index}`, role, xPct, yPct, label: role },
  player: { id: `preview-${card}`, kind: 'base' as const, imageUrl: `/uploads/items/catalog/${card}.png`, name, rarity: 'common', position: role, overwall: 500, stamina: 100 },
}));

function Preview() {
  const [tab, setTab] = useState<'stadium' | 'locker'>('stadium');
  const [paused, setPaused] = useState(false);
  const [labels, setLabels] = useState(false);
  return <div className="preview-app">
    <header className="preview-header"><div><span className="eyebrow">MASTER LEGENDS LEAGUE</span><h1>Os cards dentro do jogo</h1><p>Campinho original · 11 contra 11 · Formação 4–3–3</p></div>
      <nav aria-label="Ambiente"><button aria-pressed={tab === 'stadium'} onClick={() => setTab('stadium')}>Estádio</button><button aria-pressed={tab === 'locker'} onClick={() => setTab('locker')}>Vestiário</button></nav>
    </header>
    {tab === 'stadium' ? <>
      <div className="match-toolbar"><div className="teams"><span><i className="dot home" />Seu time <small>11 jogadores</small></span><b>×</b><span><i className="dot away" />Rival FC <small>11 jogadores</small></span></div><div className="controls"><label><input type="checkbox" checked={labels} onChange={e => setLabels(e.target.checked)} />Nomes</label><button onClick={() => setPaused(!paused)}>{paused ? 'Continuar' : 'Pausar'}</button></div></div>
      <StadiumMatchCanvas imageUrl={STADIUM} slots={homeSlots} opponents={buildRivalSlots()} paused={paused} labels={labels} />
      <footer>Goleiros junto aos gols · Defesa, meio e ataque distribuídos no gramado · Passe e chute sincronizados</footer>
    </> : <><div className="locker-stage"><img src="/ui/vestiario/vestiario-frente.jpg" alt="Vestiário MLL" /><div className="locker-actors"><StadiumPlayfieldLayer slots={homeSlots.map((s, i) => ({ ...s, slot: { ...s.slot, xPct: 9 + i * 8.2, yPct: 68 } }))} useGivenPositions plantOnFloor livePlay={false} nameplates={false} /></div></div><footer>Seu elenco com os personagens originais dos cards.</footer></>}
  </div>;
}
createRoot(document.getElementById('root')!).render(<Preview />);

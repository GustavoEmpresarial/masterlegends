import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { GearSprite } from '../components/gear/GearSprite';
import { GEAR_RARITIES, GEAR_SLOTS } from '../components/gear/gearMedia';
import './GearPreview.css';

const tiers = [
  { label: 'Comum', color: '#abb6c5', bonus: 1, price: 0.01 },
  { label: 'Incomum', color: '#80dc45', bonus: 2, price: 0.05 },
  { label: 'Raro', color: '#509bff', bonus: 4, price: 0.25 },
  { label: 'Super Raro', color: '#ff914c', bonus: 8, price: 1.25 },
  { label: 'Épico', color: '#bd8aff', bonus: 16, price: 6.25 },
  { label: 'Lendário', color: '#f6d565', bonus: 30, price: 31.25 },
];
const names = { boots: 'Chuteira', gloves: 'Luva', shinguards: 'Caneleira' };
function GearPreview() {
  const [playing, setPlaying] = useState(true);
  const [rarity, setRarity] = useState(-1);
  return <main>
    <header><div><p className="eyebrow">MASTER LEGENDS LEAGUE</p><h1>Equipamentos</h1><p className="intro">Um item por card. Todas as 18 artes refeitas e animadas.</p></div>
      <nav><a href="/club/shop">Abrir loja</a><button onClick={() => setPlaying(!playing)}>{playing ? 'Pausar animações' : 'Animar itens'}</button></nav>
    </header>
    <div className="filters" aria-label="Raridade">
      <button className={rarity === -1 ? 'selected' : ''} onClick={() => setRarity(-1)}>Todos · 18</button>
      {tiers.map((tier, i) => <button key={tier.label} className={rarity === i ? 'selected' : ''} style={{ color: tier.color }} onClick={() => setRarity(i)}>{tier.label}</button>)}
    </div>
    <section className="equipment-grid" aria-label="Equipamentos animados">
      {GEAR_RARITIES.flatMap((tier, i) => (rarity === -1 || rarity === i) ? GEAR_SLOTS.map(slot => <article key={`${slot}-${tier}`} style={{ '--accent': tiers[i].color } as React.CSSProperties}>
        <div className="equipment-art"><GearSprite src={`/ui/gear-v5/${slot}-${tier}.webp`} animate={playing} className="gear-media" /></div>
        <div className="equipment-info"><span className="tier">{tiers[i].label}</span><h2>{names[slot]}</h2><p>Bônus: +{tiers[i].bonus}% no poder do jogador <span>·</span> {tiers[i].price} GMT</p></div>
      </article>) : [])}
    </section>
  </main>;
}
createRoot(document.getElementById('root')!).render(<GearPreview />);

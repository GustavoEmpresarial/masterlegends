import { useRef, useState, type CSSProperties } from 'react';
import { createRoot } from 'react-dom/client';
import type { PenaltyShootResultDTO } from '@mll/shared';
import { PenaltyTopDown } from './components/minigames/PenaltyTopDown';
import './styles/globals.css';

const ATTEMPTS = 3;

function localShot(nx: number, ny: number, goals: number, left: number): PenaltyShootResultDTO {
  const corner = Math.abs(nx - 0.5) > 0.22 || Math.abs(ny - 0.42) > 0.22;
  const scored = corner;
  const nextGoals = goals + (scored ? 1 : 0);
  const attemptsLeft = Math.max(0, left - 1);
  const finished = attemptsLeft <= 0;
  return {
    scored,
    goals: nextGoals,
    attemptsLeft,
    finished,
    won: finished && nextGoals > 0,
  };
}

function PenaltyLab() {
  const [run, setRun] = useState(0);
  const tally = useRef({ goals: 0, left: ATTEMPTS });

  const restart = () => {
    tally.current = { goals: 0, left: ATTEMPTS };
    setRun((n) => n + 1);
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        padding: '16px 20px 28px',
        background: 'radial-gradient(ellipse at 50% 0%, #1a2a22 0%, #071018 55%)',
      }}
    >
      <div
        className="retro-text"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 14,
          color: '#fff',
          fontSize: 12,
        }}
      >
        <span>PÊNALTI 2D · canto = gol · meio = defesa</span>
        <button type="button" onClick={restart} style={btnStyle}>
          RECOMEÇAR
        </button>
      </div>
      <PenaltyTopDown
        key={run}
        attempts={ATTEMPTS}
        rarity="legendary"
        playerName="O Martelo"
        onShoot={async (nx, ny) => {
          const result = localShot(nx, ny, tally.current.goals, tally.current.left);
          tally.current = { goals: result.goals, left: result.attemptsLeft };
          return result;
        }}
        onClaim={restart}
      />
    </div>
  );
}

const btnStyle: CSSProperties = {
  color: '#071018',
  background: '#ffd400',
  border: '2px solid #ffd400',
  padding: '6px 12px',
  cursor: 'pointer',
  font: 'inherit',
};

const root = document.getElementById('root');
if (root) createRoot(root).render(<PenaltyLab />);

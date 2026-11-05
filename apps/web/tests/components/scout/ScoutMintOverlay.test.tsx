import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ScoutMintOverlay } from '../../../src/components/scout/ScoutMintOverlay';

const motionPrefs = vi.hoisted(() => ({ reduced: false }));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, number>) => {
      if (key === 'scoutAnimation.flight') {
        return `VOO ${opts?.current} DE ${opts?.total}`;
      }
      const labels: Record<string, string> = {
        'scoutAnimation.searching': 'OLHEIRO EM VOO...',
        'scoutAnimation.landing': 'ATLETA ENCONTRADO!',
        'scoutAnimation.retry': 'TENTAR DE NOVO',
      };
      return labels[key] ?? key;
    },
  }),
}));

vi.mock('framer-motion', async () => {
  const actual = await vi.importActual<typeof import('framer-motion')>('framer-motion');
  return {
    ...actual,
    useReducedMotion: () => motionPrefs.reduced,
  };
});

describe('ScoutMintOverlay', () => {
  const defaultProps = {
    open: true,
    phase: 'scouting' as const,
    quantity: 3,
    playerCount: 0,
    players: [] as never[],
    highlightColor: 'var(--gold)',
    positionSprites: {},
    onRevealStart: vi.fn(),
    onDismiss: vi.fn(),
    onRetry: vi.fn(),
  };

  beforeEach(() => {
    motionPrefs.reduced = false;
  });

  afterEach(() => {
    cleanup();
  });

  it('renders flight counter for multi-mint quantity', () => {
    render(<ScoutMintOverlay {...defaultProps} />);
    expect(screen.getByText('VOO 1 DE 3')).toBeTruthy();
  });

  it('renders without orbit when reduced motion is preferred', () => {
    motionPrefs.reduced = true;
    render(<ScoutMintOverlay {...defaultProps} />);
    expect(screen.getByText('VOO 1 DE 3')).toBeTruthy();
    expect(screen.getByText('OLHEIRO EM VOO...')).toBeTruthy();
  });

  it('renders scout flight scene during scouting', () => {
    const { container } = render(<ScoutMintOverlay {...defaultProps} />);
    expect(container.querySelector('.scout-flight-scene')).toBeTruthy();
  });
});

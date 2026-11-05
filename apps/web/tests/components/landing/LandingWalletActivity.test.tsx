import { beforeAll, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../../src/i18n';
import { LandingWalletActivity } from '../../../src/components/landing/LandingWalletActivity';

vi.mock('../../../src/hooks/usePublicWalletActivity', () => ({
  usePublicWalletActivity: () => ({
    isLoading: false,
    data: {
      deposits: [
        {
          id: 'd1',
          amountUsdc: 25,
          txHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
          walletMasked: '0xAbCd...Ef12',
          createdAt: new Date().toISOString(),
        },
      ],
      withdrawals: [],
    },
  }),
}));

beforeAll(() => {
  class MockIntersectionObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
});

describe('LandingWalletActivity', () => {
  it('renders deposit and withdrawal cards', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <LandingWalletActivity />
      </I18nextProvider>,
    );

    expect(screen.getByText(/ÚLTIMOS DEPÓSITOS|LATEST DEPOSITS/i)).toBeTruthy();
    expect(screen.getByText(/ÚLTIMOS SAQUES|LATEST WITHDRAWALS/i)).toBeTruthy();
    expect(screen.getByText(/25 USDC/)).toBeTruthy();
  });
});

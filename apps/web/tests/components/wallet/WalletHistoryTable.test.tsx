import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../../src/i18n';
import { WalletHistoryTable } from '../../../src/components/wallet/WalletHistoryTable';

function renderTable(items: Parameters<typeof WalletHistoryTable>[0]['items']) {
  return render(
    <I18nextProvider i18n={i18n}>
      <WalletHistoryTable items={items} ledgerStartedAt={null} />
    </I18nextProvider>,
  );
}

describe('WalletHistoryTable', () => {
  it('shows empty state when no items', () => {
    renderTable([]);
    expect(screen.getByText(/Nenhuma transação|No transactions/i)).toBeTruthy();
  });

  it('renders sponsorship claims with 8 fixed decimal places', () => {
    renderTable([
      {
        id: '2',
        source: 'game',
        type: 'mining_claim',
        amount: 0.00000007,
        status: 'confirmed',
        createdAt: '2026-06-12T22:20:00.000Z',
      },
    ]);
    expect(screen.getAllByText(/\+0\.00000007/).length).toBeGreaterThan(0);
  });

  it('renders other USDC amounts with up to 8 decimals', () => {
    renderTable([
      {
        id: '3',
        source: 'usdc',
        type: 'usdc_deposit',
        amount: 0.00001234,
        status: 'confirmed',
        createdAt: '2026-06-12T22:20:00.000Z',
      },
    ]);
    expect(screen.getAllByText(/\+0\.00001234/).length).toBeGreaterThan(0);
  });
});

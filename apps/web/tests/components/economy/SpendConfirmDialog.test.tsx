import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { SpendConfirmDialog, formatSpendGmt } from '../../../src/components/economy/SpendConfirmDialog';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { amount?: string }) => (opts?.amount ? `${key} ${opts.amount}` : key),
    i18n: { language: 'pt-BR', resolvedLanguage: 'pt-BR' },
  }),
}));

const base = {
  channel: 'p2p' as const,
  itemName: 'Ronaldo',
  amountGmt: 1250,
  onCancel: vi.fn(),
  onConfirm: vi.fn(),
};

describe('formatSpendGmt', () => {
  it('drops decimals on whole amounts and keeps cents', () => {
    expect(formatSpendGmt(1250, 'pt-BR')).toBe('1.250');
    expect(formatSpendGmt(10.5, 'pt-BR')).toBe('10,50');
  });
});

describe('SpendConfirmDialog', () => {
  afterEach(() => {
    cleanup();
    base.onCancel.mockClear();
    base.onConfirm.mockClear();
  });

  it('shows the spend in large type and only buys after confirm', () => {
    render(
      <SpendConfirmDialog
        {...base}
        mode="confirm"
        balanceGmt={5000}
      />,
    );

    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('Ronaldo')).toBeTruthy();
    expect(screen.getByTestId('spend-amount').textContent).toContain('1.250');
    expect(screen.getByText('5.000 GMT')).toBeTruthy();
    expect(screen.getByText('3.750 GMT')).toBeTruthy();

    fireEvent.click(screen.getByText('spendConfirm.cancel'));
    expect(base.onCancel).toHaveBeenCalledOnce();
    expect(base.onConfirm).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('spend-confirm'));
    expect(base.onConfirm).toHaveBeenCalledOnce();
  });

  it('blocks confirm when the balance cannot cover the price', () => {
    render(
      <SpendConfirmDialog
        {...base}
        mode="confirm"
        balanceGmt={100}
      />,
    );

    const confirm = screen.getByTestId('spend-confirm') as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    fireEvent.click(confirm);
    expect(base.onConfirm).not.toHaveBeenCalled();
  });

  it('shows a receipt with the amount that left the account', () => {
    render(
      <SpendConfirmDialog
        {...base}
        mode="receipt"
        channel="shop"
        balanceAfter={3750}
      />,
    );

    expect(screen.getByTestId('spend-amount').textContent).toContain('−1.250');
    expect(screen.getByText('3.750 GMT')).toBeTruthy();
    fireEvent.click(screen.getByText('spendConfirm.close'));
    expect(base.onConfirm).toHaveBeenCalledOnce();
  });
});

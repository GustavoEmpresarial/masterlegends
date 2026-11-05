import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import pt from '../../../src/i18n/locales/pt-BR/club.json';
import { OnboardingTutorial, requestTutorialReplay } from '../../../src/components/onboarding/OnboardingTutorial';

const state = vi.hoisted(() => ({
  user: { id: 'tutorial-test', emailVerified: true, tutorialCompleted: false },
  post: vi.fn(),
  patch: vi.fn(),
}));
vi.mock('../../../src/hooks/useAuth', () => ({
  useAuth: () => ({ user: state.user, isAuthenticated: true, patchUser: state.patch }),
}));
vi.mock('../../../src/lib/api/client', () => ({ apiClient: { post: state.post } }));
vi.mock('../../../src/lib/apiError', () => ({ translateError: () => 'Não foi possível salvar. Tente novamente.' }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: translate }),
}));
function translate(key: string, options?: Record<string, unknown>): string | string[] {
  const value = key.replace('club:', '').split('.').reduce<any>((obj, part) => obj?.[part], pt);
  if (typeof value !== 'string') return value ?? key;
  return value.replace(/\{\{(\w+)\}\}/g, (_, name) => String(options?.[name] ?? ''));
}

beforeEach(() => {
  state.user = { id: 'tutorial-test', emailVerified: true, tutorialCompleted: false };
  state.post.mockReset();
  state.patch.mockReset().mockImplementation(partial => { state.user = { ...state.user, ...partial }; });
  sessionStorage.clear();
});
afterEach(cleanup);

describe('Skip onboarding', () => {
  it('skips on the first step, persists through the account endpoint and stays closed on remount', async () => {
    state.post.mockResolvedValue({ data: { tutorialCompleted: true, emailVerified: true } });
    const view = render(<OnboardingTutorial />);
    expect(screen.getByText('Passo 1 de 10')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Pular tutorial' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Pular tutorial' })).toBeNull());
    expect(state.post).toHaveBeenCalledOnce();
    expect(state.post).toHaveBeenCalledWith('/auth/complete-tutorial');
    expect(state.patch).toHaveBeenCalledWith({ tutorialCompleted: true, emailVerified: true });
    expect(sessionStorage.getItem('mll:tutorial-step:tutorial-test')).toBeNull();
    view.unmount();
    render(<OnboardingTutorial />);
    expect(screen.queryByText('Passo 1 de 10')).toBeNull();
  });

  it('offers skipping after advancing and locks navigation until saving finishes', async () => {
    let resolve!: (value: unknown) => void;
    state.post.mockReturnValue(new Promise(r => { resolve = r; }));
    render(<OnboardingTutorial />);
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    await waitFor(() => expect(screen.getByText('Passo 2 de 10')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Pular tutorial' }));
    expect((screen.getByRole('button', { name: 'Salvando…' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Continuar' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Voltar' }) as HTMLButtonElement).disabled).toBe(true);
    await act(async () => resolve({ data: { tutorialCompleted: true, emailVerified: true } }));
    expect(state.post).toHaveBeenCalledTimes(1);
  });

  it('keeps the tutorial open and permits retry when saving fails', async () => {
    state.post.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce({ data: { tutorialCompleted: true, emailVerified: true } });
    render(<OnboardingTutorial />);
    fireEvent.click(screen.getByRole('button', { name: 'Pular tutorial' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(state.patch).not.toHaveBeenCalled();
    const skip = screen.getByRole('button', { name: 'Pular tutorial' }) as HTMLButtonElement;
    expect(skip.disabled).toBe(false);
    fireEvent.click(skip);
    await waitFor(() => expect(state.patch).toHaveBeenCalledOnce());
  });

  it('can be replayed after skipping and closed without another account request', async () => {
    state.user.tutorialCompleted = true;
    render(<OnboardingTutorial />);
    act(() => requestTutorialReplay());
    expect(screen.getByText('Passo 1 de 10')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Pular tutorial' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));
    await waitFor(() => expect(screen.queryByText('Passo 1 de 10')).toBeNull());
    expect(state.post).not.toHaveBeenCalled();
  });
});

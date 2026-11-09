import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import type { AuthResponse, AuthUserDTO, RegisterResponse } from '@mll/shared';
import { apiClient, LOGOUT_EVENT, primeCsrf, refreshAccessToken } from '../lib/api/client';
import { getAccessToken, setAccessToken, clearAccessToken } from '../lib/auth/storage';
import { extractErrorCode } from '../lib/apiError';

interface AuthContextType {
  user: AuthUserDTO | null;
  loading: boolean;
  login: (email: string, password: string, turnstileToken?: string) => Promise<void>;
  register: (
    email: string,
    username: string,
    password: string,
    options?: { referralCode?: string; turnstileToken?: string },
  ) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  patchUser: (partial: Partial<AuthUserDTO>) => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Provider de autenticação. Restaura a sessão via refresh token na montagem,
 * expõe o usuário autenticado e as ações de auth para toda a árvore de componentes.
 * Redireciona para `/login` ao receber o evento `LOGOUT_EVENT` do interceptor Axios.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUserDTO | null>(null);
  const [loading, setLoading] = useState(true);

  const patchUser = useCallback((partial: Partial<AuthUserDTO>) => {
    setUser((current) => (current ? { ...current, ...partial } : current));
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const { data } = await apiClient.get<AuthUserDTO>('/auth/me');
      setUser(data);
    } catch {
      /* interceptor handles fatal auth; avoid clearing a live session on transient /me errors */
    }
  }, []);

  const checkAuth = useCallback(async () => {
    await primeCsrf();

    if (!getAccessToken()) {
      try {
        const token = await refreshAccessToken();
        setAccessToken(token);
      } catch {
        setLoading(false);
        return;
      }
    }

    try {
      const { data } = await apiClient.get<AuthUserDTO>('/auth/me');
      setUser(data);
    } catch {
      clearAccessToken();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // No /admin a sessão de jogador não importa. Consultar /auth/* em manutenção
    // devolve 503 e cobria o painel com a tela "em manutenção".
    const path = typeof window !== 'undefined' ? window.location?.pathname ?? '' : '';
    if (path.startsWith('/admin')) {
      setLoading(false);
      return;
    }
    void checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    const handleLogout = () => {
      setUser(null);
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    };
    window.addEventListener(LOGOUT_EVENT, handleLogout);
    return () => window.removeEventListener(LOGOUT_EVENT, handleLogout);
  }, []);

  /**
   * Autentica o usuário, armazena o access token e popula o estado `user`.
   *
   * @param email - E-mail do usuário
   * @param password - Senha em texto puro
   * @param turnstileToken - Token do Cloudflare Turnstile (opcional)
   * @throws {Error} com o código de erro da API em `message`
   */
  const login = async (email: string, password: string, turnstileToken?: string) => {
    try {
      const { data } = await apiClient.post<AuthResponse>('/auth/login', {
        email,
        password,
        ...(turnstileToken ? { turnstileToken } : {}),
      });
      setAccessToken(data.accessToken);
      setUser(data.user);
    } catch (error) {
      throw new Error(extractErrorCode(error) || 'AUTH_LOGIN_FAILED');
    }
  };

  /**
   * Cria a conta e envia e-mail de verificação. Não inicia sessão —
   * o usuário deve confirmar o e-mail e então fazer login.
   */
  const register = async (
    email: string,
    username: string,
    password: string,
    options?: { referralCode?: string; turnstileToken?: string },
  ) => {
    try {
      await apiClient.post<RegisterResponse>('/auth/register', {
        email,
        username,
        password,
        acceptTerms: true,
        ...(options?.referralCode ? { referralCode: options.referralCode.toUpperCase() } : {}),
        ...(options?.turnstileToken ? { turnstileToken: options.turnstileToken } : {}),
      });
      // Never keep a prior session after signup — register does not issue tokens.
      clearAccessToken();
      setUser(null);
      try {
        await apiClient.post('/auth/logout');
      } catch {
        /* ignore — may have no refresh cookie */
      }
    } catch (error) {
      throw new Error(extractErrorCode(error) || 'AUTH_REGISTER_FAILED');
    }
  };

  const logout = async () => {
    try {
      await apiClient.post('/auth/logout');
    } catch {
      // ignore
    } finally {
      clearAccessToken();
      setUser(null);
      window.location.href = '/login';
    }
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, login, register, logout, refreshUser, patchUser, isAuthenticated: !!user }}
    >
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook para acessar o contexto de autenticação do usuário.
 * Deve ser usado dentro de `AuthProvider`.
 *
 * @returns Contexto com `user`, `loading`, `isAuthenticated` e ações de auth
 * @throws {Error} se usado fora de `AuthProvider`
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

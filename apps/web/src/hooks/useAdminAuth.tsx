import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useLocation } from 'react-router-dom';
import { adminHasPermission, AdminPermission, type AdminLoginChallengeResponse, type AdminRoleType, type AdminSessionResponse, type AdminUserDTO } from '@mll/shared';
import { adminClient, primeAdminCsrf } from '../lib/api/adminClient';
import {
  clearAdminAccessToken,
  getAdminAccessToken,
  setAdminAccessToken,
} from '../lib/auth/adminStorage';

interface AdminAuthContextValue {
  admin: AdminUserDTO | null;
  isLoading: boolean;
  login: (login: string, password: string) => Promise<AdminSessionResponse | AdminLoginChallengeResponse>;
  verify2fa: (challengeId: string, code: string) => Promise<void>;
  logout: () => Promise<void>;
  hasPermission: (permission: (typeof AdminPermission)[keyof typeof AdminPermission]) => boolean;
  canViewUsers: boolean;
  canManageUsers: boolean;
  canViewReports: boolean;
  canManageWithdrawals: boolean;
  canManageWalletConfig: boolean;
  canManageAnnouncements: boolean;
  canManageSupport: boolean;
  canViewAuditLogs: boolean;
  canViewBullBoard: boolean;
}

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith('/admin');
  const [admin, setAdmin] = useState<AdminUserDTO | null>(null);
  const [isLoading, setIsLoading] = useState(isAdminRoute);

  const loadMe = useCallback(async () => {
    if (!getAdminAccessToken()) {
      try {
        await primeAdminCsrf();
        const { data } = await adminClient.post<{ accessToken: string }>('/refresh', {});
        setAdminAccessToken(data.accessToken);
      } catch {
        setAdmin(null);
        setIsLoading(false);
        return;
      }
    }
    try {
      const { data } = await adminClient.get<{ admin: AdminUserDTO }>('/me');
      setAdmin(data.admin);
    } catch {
      clearAdminAccessToken();
      setAdmin(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdminRoute) {
      document.body.classList.add('admin-shell');
      document.documentElement.lang = 'pt-BR';
      return () => {
        document.body.classList.remove('admin-shell');
        document.documentElement.lang = 'pt-BR';
      };
    }
    document.body.classList.remove('admin-shell');
  }, [isAdminRoute]);

  useEffect(() => {
    if (!isAdminRoute) {
      setIsLoading(false);
      return;
    }
    void loadMe();
  }, [isAdminRoute, loadMe]);

  const login = useCallback(async (loginName: string, password: string) => {
    const { data } = await adminClient.post<AdminSessionResponse | AdminLoginChallengeResponse>('/login', {
      login: loginName,
      password,
    });
    if ('accessToken' in data) {
      setAdminAccessToken(data.accessToken);
      setAdmin(data.admin);
      await primeAdminCsrf();
      // Refresh with the effective permissions from /me (login response may omit them).
      await loadMe();
    }
    return data;
  }, [loadMe]);

  const verify2fa = useCallback(async (challengeId: string, code: string) => {
    const { data } = await adminClient.post<AdminSessionResponse>('/verify-2fa', {
      challengeId,
      code,
    });
    setAdminAccessToken(data.accessToken);
    setAdmin(data.admin);
    await primeAdminCsrf();
    // Refresh with the effective permissions from /me (verify response may omit them).
    await loadMe();
  }, [loadMe]);

  const logout = useCallback(async () => {
    try {
      await primeAdminCsrf();
      await adminClient.post('/logout', {});
    } catch {
      /* ignore */
    }
    clearAdminAccessToken();
    setAdmin(null);
  }, []);

  const hasPermission = useCallback(
    (permission: (typeof AdminPermission)[keyof typeof AdminPermission]) => {
      if (!admin) return false;
      // Prefer the effective permissions computed by the server (`/me`), which
      // already merge per-admin DB grants (AdminPermissionConfig) with the role
      // matrix. Fall back to the role matrix only when the list is unavailable
      // (e.g. right after login before /me has populated it).
      if (admin.permissions) return admin.permissions.includes(permission);
      return adminHasPermission(admin.role, permission);
    },
    [admin],
  );

  const value = useMemo<AdminAuthContextValue>(
    () => ({
      admin,
      isLoading,
      login,
      verify2fa,
      logout,
      hasPermission,
      canViewUsers: hasPermission(AdminPermission.VIEW_USERS),
      canManageUsers: hasPermission(AdminPermission.MANAGE_USERS),
      canViewReports: hasPermission(AdminPermission.VIEW_REPORTS),
      canManageWithdrawals: hasPermission(AdminPermission.MANAGE_WITHDRAWALS),
      canManageWalletConfig: hasPermission(AdminPermission.MANAGE_WALLET_CONFIG),
      canManageAnnouncements: hasPermission(AdminPermission.MANAGE_ANNOUNCEMENTS),
      canManageSupport: hasPermission(AdminPermission.MANAGE_SUPPORT),
      canViewAuditLogs: hasPermission(AdminPermission.VIEW_AUDIT),
      canViewBullBoard: hasPermission(AdminPermission.VIEW_BULL_BOARD),
    }),
    [admin, isLoading, login, verify2fa, logout, hasPermission],
  );

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth(): AdminAuthContextValue {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error('useAdminAuth must be used within AdminAuthProvider');
  return ctx;
}

export type { AdminRoleType };

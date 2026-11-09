import { useEffect, useMemo, useState } from 'react';
import { AppErrorBoundary } from '../errors/AppErrorBoundary';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { adminHasPermission, AdminPermission, type AdminPermissionType } from '@mll/shared';
import { useAdminAuth } from '../../hooks/useAdminAuth';
import { adminPt, adminRoleLabel } from '../../lib/admin/i18n';
import 'bootstrap-icons/font/bootstrap-icons.min.css';

interface NavItem {
  to: string;
  label: string;
  icon: string;
  permission: AdminPermissionType | null;
  end?: boolean;
  superOnly?: boolean;
}

interface NavSection {
  id: string;
  title: string;
  icon: string;
  items: NavItem[];
}

const sections: NavSection[] = [
  {
    id: 'overview',
    title: 'Visão Geral',
    icon: 'bi-speedometer2',
    items: [
      { to: '/admin', label: adminPt.nav.overview, end: true, permission: null, icon: 'bi-house' },
      { to: '/admin/reports', label: adminPt.nav.reports, permission: AdminPermission.VIEW_REPORTS, icon: 'bi-bar-chart-line' },
      { to: '/admin/roi', label: 'Patrocínios & ROI', permission: AdminPermission.VIEW_REPORTS, icon: 'bi-graph-up' },
      { to: '/admin/failures', label: 'Falhas dos Usuários', permission: AdminPermission.VIEW_REPORTS, icon: 'bi-exclamation-triangle' },
    ],
  },
  {
    id: 'community',
    title: 'Comunidade',
    icon: 'bi-people-fill',
    items: [
      { to: '/admin/users', label: adminPt.nav.users, permission: AdminPermission.VIEW_USERS, icon: 'bi-people' },
      { to: '/admin/support', label: adminPt.nav.support, permission: AdminPermission.MANAGE_SUPPORT, icon: 'bi-headset' },
      { to: '/admin/referrals', label: adminPt.nav.referrals, permission: AdminPermission.VIEW_REFERRALS, icon: 'bi-share' },
    ],
  },
  {
    id: 'finance',
    title: 'Financeiro',
    icon: 'bi-cash-stack',
    items: [
      { to: '/admin/withdrawals', label: adminPt.nav.withdrawals, permission: AdminPermission.MANAGE_WITHDRAWALS, icon: 'bi-cash-coin' },
      { to: '/admin/withdrawals/history', label: adminPt.nav.withdrawalsHistory, permission: AdminPermission.MANAGE_WITHDRAWALS, icon: 'bi-clock-history' },
      { to: '/admin/wallet', label: adminPt.nav.wallet, permission: AdminPermission.MANAGE_WALLET_CONFIG, icon: 'bi-wallet2' },
    ],
  },
  {
    id: 'content',
    title: 'Conteúdo do Jogo',
    icon: 'bi-controller',
    items: [
      { to: '/admin/items', label: adminPt.nav.items, permission: AdminPermission.MANAGE_ITEMS, icon: 'bi-box-seam' },
      { to: '/admin/stadiums', label: adminPt.nav.stadiums, permission: AdminPermission.MANAGE_STADIUMS, icon: 'bi-map' },
      { to: '/admin/vestiario', label: adminPt.nav.vestiario, permission: AdminPermission.MANAGE_STADIUMS, icon: 'bi-door-open' },
      { to: '/admin/escritorio', label: adminPt.nav.escritorio, permission: AdminPermission.MANAGE_STADIUMS, icon: 'bi-briefcase' },
      { to: '/admin/stadium-shop', label: adminPt.nav.stadiumShop, permission: AdminPermission.MANAGE_STADIUMS, icon: 'bi-shop' },
      { to: '/admin/pass', label: adminPt.nav.pass, permission: AdminPermission.MANAGE_PASS, icon: 'bi-ticket-perforated' },
      { to: '/admin/eventos', label: adminPt.nav.events ?? 'Eventos', permission: AdminPermission.MANAGE_EVENTS, icon: 'bi-calendar-event' },
      { to: '/admin/warehouse', label: 'Almoxarifado', permission: AdminPermission.MANAGE_ITEMS, icon: 'bi-archive' },
      { to: '/admin/offerwall', label: 'Offerwall', permission: AdminPermission.VIEW_REPORTS, icon: 'bi-currency-exchange' },
    ],
  },
  {
    id: 'engagement',
    title: 'Engajamento',
    icon: 'bi-megaphone-fill',
    items: [
      { to: '/admin/comunicados', label: 'Comunicados', permission: AdminPermission.MANAGE_ANNOUNCEMENTS, icon: 'bi-megaphone' },
      { to: '/admin/telegram', label: 'Telegram', permission: AdminPermission.MANAGE_ANNOUNCEMENTS, icon: 'bi-telegram' },
      { to: '/admin/email', label: 'E-mail', permission: AdminPermission.MANAGE_ANNOUNCEMENTS, icon: 'bi-envelope' },
      { to: '/admin/transparency', label: adminPt.nav.transparency, permission: AdminPermission.MANAGE_ANNOUNCEMENTS, icon: 'bi-bar-chart-line' },
      { to: '/admin/roadmap', label: 'Roadmap', permission: AdminPermission.MANAGE_ANNOUNCEMENTS, icon: 'bi-map' },
      { to: '/admin/social', label: adminPt.nav.social, permission: AdminPermission.MANAGE_SOCIAL, icon: 'bi-youtube' },
    ],
  },
  {
    id: 'ops',
    title: 'Operações & Segurança',
    icon: 'bi-shield-lock-fill',
    items: [
      { to: '/admin/settings', label: adminPt.nav.settings, permission: AdminPermission.MANAGE_PLATFORM, icon: 'bi-gear' },
      { to: '/admin/security', label: adminPt.nav.security, permission: AdminPermission.MANAGE_PLATFORM, icon: 'bi-shield-lock' },
      { to: '/admin/logs', label: adminPt.nav.logs, permission: AdminPermission.MANAGE_PLATFORM, icon: 'bi-card-list' },
      { to: '/admin/audit', label: adminPt.nav.audit, permission: AdminPermission.VIEW_AUDIT, icon: 'bi-journal-text' },
      { to: '/admin/admins', label: adminPt.nav.admins, permission: null, icon: 'bi-person-badge', superOnly: true },
    ],
  },
];

const COLLAPSED_KEY = 'admin.nav.collapsed';

function findPageTitle(pathname: string): string {
  for (const section of sections) {
    for (const item of section.items) {
      if (item.end && pathname === item.to) return item.label;
      if (!item.end && pathname.startsWith(item.to)) return item.label;
    }
  }
  if (pathname.match(/^\/admin\/users\/[^/]+/)) return adminPt.nav.users;
  if (pathname.startsWith('/admin/withdrawals/history')) return adminPt.nav.withdrawalsHistory;
  if (pathname.startsWith('/admin/warehouse')) return 'Almoxarifado';
  if (pathname.startsWith('/admin/offerwall')) return 'Offerwall';
  return adminPt.nav.overview;
}

export function AdminLayout() {
  const { admin, logout, canViewBullBoard } = useAdminAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(COLLAPSED_KEY);
      return new Set(raw ? (JSON.parse(raw) as string[]) : []);
    } catch {
      return new Set();
    }
  });

  const pageTitle = useMemo(() => findPageTitle(location.pathname), [location.pathname]);

  useEffect(() => {
    setMobileOpen(false);
    window.scrollTo(0, 0);
  }, [location.pathname]);

  useEffect(() => {
    const activeSection = sections.find((s) =>
      s.items.some((it) => location.pathname === it.to || location.pathname.startsWith(it.to + '/')),
    );
    if (activeSection && collapsed.has(activeSection.id)) {
      const next = new Set(collapsed);
      next.delete(activeSection.id);
      setCollapsed(next);
    }
  }, [location.pathname]);

  useEffect(() => {
    localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...collapsed]));
  }, [collapsed]);

  function toggleSection(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const hasPerm = (perm: AdminPermissionType) => {
    if (!admin) return false;
    if (admin.role === 'super') return true;
    if (admin.permissions) return admin.permissions.includes(perm);
    return adminHasPermission(admin.role, perm);
  };

  const visibleSections = sections
    .map((s) => ({
      ...s,
      items: s.items.filter(
        (it) =>
          (!it.superOnly || admin?.role === 'super') &&
          (!it.permission || hasPerm(it.permission)),
      ),
    }))
    .filter((s) => s.items.length > 0);

  return (
    <div className="admin-shell min-h-screen bg-[#070b14] text-slate-100 flex">
      {mobileOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          aria-label="Fechar menu"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={`admin-sidebar fixed inset-y-0 left-0 z-50 flex w-[17.5rem] flex-col border-r border-white/[0.06] bg-[#0c1220] transition-transform duration-200 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="border-b border-white/[0.06] px-5 py-5">
          <div className="flex items-center gap-3">
            <div className="admin-brand-mark flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-black">
              ML
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                {adminPt.login.title}
              </p>
              <p className="truncate text-sm font-semibold text-white">{admin?.login}</p>
              <p className="text-[11px] font-medium text-emerald-400/90">
                {admin ? adminRoleLabel(admin.role) : ''}
              </p>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {visibleSections.map((section) => {
            const isCollapsed = collapsed.has(section.id);
            return (
              <div key={section.id} className="mb-1">
                <button
                  type="button"
                  onClick={() => toggleSection(section.id)}
                  className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500 transition-colors hover:text-slate-300"
                >
                  <span className="flex items-center gap-2">
                    <i className={`bi ${section.icon} text-sm opacity-70`} aria-hidden />
                    <span>{section.title}</span>
                  </span>
                  <i
                    className={`bi bi-chevron-down text-xs transition-transform duration-200 ${
                      isCollapsed ? '-rotate-90' : 'rotate-0'
                    }`}
                    aria-hidden
                  />
                </button>
                {!isCollapsed && (
                  <div className="mt-1 space-y-0.5 pl-1">
                    {section.items.map((item) => (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        end={item.end}
                        className={({ isActive }) =>
                          `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-all ${
                            isActive
                              ? 'bg-emerald-500/15 text-emerald-300 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.25)]'
                              : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200'
                          }`
                        }
                      >
                        <i className={`bi ${item.icon} shrink-0 text-[15px] opacity-90`} aria-hidden />
                        <span className="truncate">{item.label}</span>
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="space-y-2 border-t border-white/[0.06] p-4">
          {canViewBullBoard && (
            <a
              href="/admin/queues"
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs text-slate-300 transition-colors hover:bg-white/[0.06] hover:text-white"
            >
              <i className="bi bi-list-task shrink-0" aria-hidden />
              {adminPt.nav.bullBoard}
            </a>
          )}
          <button
            type="button"
            onClick={() => void logout()}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-white/[0.05] px-3 py-2 text-xs text-slate-300 transition-colors hover:bg-red-500/15 hover:text-red-300"
          >
            <i className="bi bi-box-arrow-right shrink-0" aria-hidden />
            {adminPt.nav.logout}
          </button>
        </div>
      </aside>

      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-[#070b14]/80 backdrop-blur-xl">
          <div className="flex h-14 items-center gap-3 px-4 sm:px-6 lg:px-8">
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-slate-300 transition-colors hover:bg-white/[0.06] lg:hidden"
              aria-label="Abrir menu"
              onClick={() => setMobileOpen(true)}
            >
              <i className="bi bi-list text-lg" aria-hidden />
            </button>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Painel administrativo
              </p>
              <h1 className="truncate text-base font-semibold text-white sm:text-lg">{pageTitle}</h1>
            </div>
            <div className="hidden items-center gap-2 sm:flex">
              <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1 text-xs text-slate-400">
                {admin?.login}
              </span>
            </div>
          </div>
        </header>

        <main className="admin-main-bg flex-1 overflow-auto">
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
            <AppErrorBoundary fallbackTitle="Erro no painel admin">
              <Outlet />
            </AppErrorBoundary>
          </div>
        </main>
      </div>
    </div>
  );
}

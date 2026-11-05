import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useMobileSidebar } from './MobileSidebarContext';
import { useSidebarNavItems, type SidebarNavItem } from './sidebarNavItems';
import { requestTutorialReplay } from '../onboarding/OnboardingTutorial';

function runSidebarAction(action: NonNullable<SidebarNavItem['action']>) {
  if (action === 'replay-tutorial') {
    requestTutorialReplay();
  }
}

function SidebarNavRow({
  item,
  isActive,
}: {
  item: SidebarNavItem;
  isActive: boolean;
}) {
  return (
    <motion.div
      className="flex items-center gap-3 px-3 py-2.5 sm:px-4 sm:py-3 transition-pixel w-full text-left"
      style={{
        background: isActive ? 'var(--bg-light)' : 'transparent',
        borderLeft: isActive ? `4px solid ${item.color}` : '4px solid transparent',
        boxShadow: isActive ? 'inset 2px 2px 0 rgba(0, 0, 0, 0.2)' : 'none',
      }}
      whileHover={{ x: 4, backgroundColor: 'var(--bg-light)' }}
      whileTap={{ scale: 0.98 }}
    >
      <i className={`${item.icon} w-8 shrink-0 text-center text-lg`} style={{ color: item.color }} />
      <span
        className="ui-label-sm leading-snug"
        style={{
          color: 'var(--text-primary)',
          opacity: isActive ? 1 : 0.92,
        }}
      >
        {item.label}
      </span>
      {isActive && <span className="ml-auto animate-blink text-green">◀</span>}
    </motion.div>
  );
}

function SidebarNav({
  onNavigate,
}: {
  onNavigate?: () => void;
}) {
  const location = useLocation();
  const groups = useSidebarNavItems();

  return (
    <nav className="min-h-0 flex-1 overflow-y-auto p-3 pt-2 pb-4">
      {groups.map((group) => (
        <div key={group.label}>
          <div className="px-3 pt-5 pb-1">
            <span
              className="pixel-text text-xs tracking-widest"
              style={{ color: group.color }}
            >
              — {group.label}
            </span>
          </div>
          <div className="space-y-0.5">
            {group.items.map((item) => {
              if (item.action) {
                return (
                  <button
                    key={`action:${item.action}`}
                    type="button"
                    className="block w-full"
                    onClick={() => {
                      runSidebarAction(item.action!);
                      onNavigate?.();
                    }}
                  >
                    <SidebarNavRow item={item} isActive={false} />
                  </button>
                );
              }

              const path = item.path!;
              const isActive =
                location.pathname === path ||
                (path !== '/club' && location.pathname.startsWith(`${path}/`));
              return (
                <Link key={path} to={path} className="block" onClick={onNavigate}>
                  <SidebarNavRow item={item} isActive={isActive} />
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

export function Sidebar() {
  const { t } = useTranslation('common');
  const { enabled, isOpen, close } = useMobileSidebar();
  const asideRef = useRef<HTMLElement>(null);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const sync = () => setIsDesktop(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  const hideFromAssistiveTech = enabled && !isOpen && !isDesktop;

  useEffect(() => {
    if (!hideFromAssistiveTech || !asideRef.current) return;
    const active = document.activeElement;
    if (active instanceof HTMLElement && asideRef.current.contains(active)) {
      active.blur();
    }
  }, [hideFromAssistiveTech]);

  return (
    <>
      {enabled && isOpen && (
        <button
          type="button"
          aria-label={t('nav.closeMenu')}
          className="fixed inset-0 z-[94] bg-black/65 lg:hidden"
          style={{ top: 'var(--app-header-h)' }}
          onClick={close}
        />
      )}

      <aside
        ref={asideRef}
        className={`fixed left-0 z-[95] flex flex-col overflow-hidden transition-transform duration-200 ease-out lg:z-30 lg:translate-x-0 ${
          enabled && isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
        style={{
          top: 'var(--app-header-h)',
          width: 'min(var(--app-sidebar-w), 88vw)',
          height: 'calc(100dvh - var(--app-header-h))',
          background: 'var(--bg-medium)',
          borderRight: '4px solid var(--bg-lighter)',
          boxShadow: '4px 0 0 rgba(0, 0, 0, 0.2)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
        aria-hidden={hideFromAssistiveTech || undefined}
        inert={hideFromAssistiveTech || undefined}
      >
        {enabled && (
          <div className="flex items-center justify-between border-b border-[var(--bg-lighter)] px-4 py-3 lg:hidden">
            <span className="ui-label text-green">{t('nav.menu')}</span>
            <button
              type="button"
              className="pixel-btn pixel-btn-sm"
              style={{ background: 'var(--bg-light)', borderColor: 'var(--bg-lighter)' }}
              onClick={close}
            >
              <i className="bi bi-x-lg" aria-hidden />
            </button>
          </div>
        )}
        <SidebarNav onNavigate={enabled ? close : undefined} />
      </aside>
    </>
  );
}

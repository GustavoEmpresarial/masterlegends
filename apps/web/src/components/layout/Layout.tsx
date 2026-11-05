import { useEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Header } from './Header';
import { Footer } from './Footer';
import { AreaNav } from './AreaNav';
import { useAuth } from '../../hooks/useAuth';
import { isMarketingRoute } from './marketingRoutes';
import { AnnouncementModal } from '../announcements/AnnouncementModal';
import { LoginPopup } from '../notices/LoginPopup';
import { PlayerLifetimePopup } from '../notices/PlayerLifetimePopup';
import { OnboardingTutorial } from '../onboarding/OnboardingTutorial';
import { SupportReplyPopup } from '../support/SupportReplyPopup';
import { isStadiumLiveWidget } from '../../lib/stadiumLiveWidget';
import { StadiumLiveTitleBar } from '../stadium/StadiumLiveTitleBar';

export function Layout() {
  const { isAuthenticated, user } = useAuth();
  const { pathname } = useLocation();
  const pageScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    pageScrollRef.current?.scrollTo(0, 0);
    window.scrollTo(0, 0);
  }, [pathname]);
  const widgetShell = isStadiumLiveWidget();
  const appShell = isAuthenticated && !isMarketingRoute(pathname) && !widgetShell;
  const isClubHome = pathname === '/club';
  const tutorialPending = Boolean(user && user.emailVerified && !user.tutorialCompleted);

  if (widgetShell) {
    return (
      <div className="stadium-live-shell" data-mll-widget="stadium-live">
        <StadiumLiveTitleBar />
        <main className="flex min-h-0 flex-1 flex-col">
          <Outlet />
        </main>
      </div>
    );
  }

  return (
    <div
      className={`crt flex flex-col ${appShell ? 'game-cabinet h-dvh max-h-dvh' : 'min-h-dvh'}`}
      style={{ background: 'var(--bg-dark)' }}
    >
      {appShell ? (
        <div className="game-pitch" aria-hidden />
      ) : (
        <div
          className="pointer-events-none fixed inset-0 opacity-5"
          style={{
            backgroundImage: `
            linear-gradient(45deg, var(--green) 25%, transparent 25%),
            linear-gradient(-45deg, var(--green) 25%, transparent 25%),
            linear-gradient(45deg, transparent 75%, var(--green) 75%),
            linear-gradient(-45deg, transparent 75%, var(--green) 75%)
          `,
            backgroundSize: '20px 20px',
            backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
          }}
        />
      )}

      <Header />

      {isAuthenticated && <OnboardingTutorial />}
      {isAuthenticated && appShell && isClubHome && !tutorialPending && <AnnouncementModal />}
      {isAuthenticated && user && isClubHome && !tutorialPending && (
        <SupportReplyPopup userId={user.id} />
      )}
      {isAuthenticated && user && isClubHome && !tutorialPending && (
        <PlayerLifetimePopup userId={user.id} />
      )}
      {isAuthenticated && user && <LoginPopup userId={user.id} />}

      {appShell ? (
        <>
          <div className="relative z-10 flex min-h-0 flex-1 overflow-hidden">
            <AreaNav placement="side" />
            <div
              ref={pageScrollRef}
              className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto pb-[var(--app-mobile-nav-h)] lg:pb-0"
            >
              <main className="min-w-0 flex-1 w-full p-2 sm:p-3 md:p-4">
                <Outlet />
              </main>
              <Footer variant="content" />
            </div>
          </div>
          <AreaNav placement="bottom" />
        </>
      ) : (
        <>
          <div className="relative z-10 flex flex-1 flex-col min-w-0">
            <main className="flex-1 w-full min-w-0 px-4 sm:px-6 py-6 pb-8">
              <Outlet />
            </main>
          </div>
          <Footer variant="full" />
        </>
      )}
    </div>
  );
}

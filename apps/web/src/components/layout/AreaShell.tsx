import { Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { isMarketingRoute } from './marketingRoutes';
import { HubSubnav } from './HubSubnav';
import type { AreaId } from './primaryAreas';

export function AreaShell({ area }: { area: AreaId }) {
  const { isAuthenticated } = useAuth();
  const { pathname } = useLocation();
  const showSubnav = isAuthenticated && !isMarketingRoute(pathname);

  return (
    <div className="area-shell" data-area={area}>
      {showSubnav && <HubSubnav area={area} />}
      <Outlet />
    </div>
  );
}

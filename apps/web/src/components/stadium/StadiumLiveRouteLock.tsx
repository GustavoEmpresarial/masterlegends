import { Navigate, useLocation } from 'react-router-dom';
import {
  isStadiumLiveAllowedPath,
  isStadiumLiveWidget,
  stadiumLiveHref,
} from '../../lib/stadiumLiveWidget';

/** Keeps the desktop/Android shell on the live pitch and the login flow. */
export function StadiumLiveRouteLock() {
  const { pathname } = useLocation();
  if (!isStadiumLiveWidget()) return null;
  if (isStadiumLiveAllowedPath(pathname)) return null;
  return <Navigate to={stadiumLiveHref(true)} replace />;
}

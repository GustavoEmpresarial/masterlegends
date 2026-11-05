/** Routes that render without app header/sidebar (landing, auth, legal). */
export function isMarketingRoute(pathname: string): boolean {
  if (pathname === '/') return true;
  if (pathname === '/login' || pathname === '/register') return true;
  if (pathname.startsWith('/auth/')) return true;
  if (pathname.startsWith('/legal/')) return true;
  return false;
}

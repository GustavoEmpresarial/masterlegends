import type { ErrorSurface } from './failureKinds';
import { getCurrentPageTab } from './TabContext';

interface RouteMeta {
  area: string;
  tab: string;
}

/** Player routes — static labels (PT defaults). */
const PLAYER_ROUTES: { prefix: string; area: string; tab: string }[] = [
  { prefix: '/club/stadium', area: 'MEU CLUBE', tab: 'Estádio' },
  { prefix: '/club/vestiario', area: 'VESTIÁRIO', tab: 'Vestiário' },
  { prefix: '/club/stake', area: 'STAKE', tab: 'Stake' },
  { prefix: '/club/checkin', area: 'MEU CLUBE', tab: 'Presença Diária' },
  { prefix: '/club/ct', area: 'CT', tab: 'CT' },
  { prefix: '/club/escritorio', area: 'MEU CLUBE', tab: 'Escritório' },
  { prefix: '/club/gestao', area: 'MEU CLUBE', tab: 'Gestão' },
  { prefix: '/club/inventory', area: 'INVENTÁRIO', tab: 'Elenco' },
  { prefix: '/club/museum', area: 'MEU CLUBE', tab: 'Museu' },
  { prefix: '/club/shop', area: 'MERCADO', tab: 'Lojinha' },
  { prefix: '/club/warehouse', area: 'MERCADO', tab: 'Almoxarifado' },
  { prefix: '/club', area: 'INÍCIO', tab: 'Início' },
  { prefix: '/scout', area: 'MERCADO', tab: 'Olheiro' },
  { prefix: '/marketplace', area: 'MERCADO', tab: 'Mercado' },
  { prefix: '/boneco', area: 'MERCADO', tab: 'Personalize seu boneco' },
  { prefix: '/club/merger', area: 'MERCADO', tab: 'Fusão' },
  { prefix: '/ranking', area: 'TEMPORADA', tab: 'Tabela' },
  { prefix: '/pvp', area: 'TEMPORADA', tab: 'PvP' },
  { prefix: '/pass', area: 'TEMPORADA', tab: 'Passe' },
  { prefix: '/eventos', area: 'TEMPORADA', tab: 'Eventos' },
  { prefix: '/admin/eventos', area: 'Conteúdo do Jogo', tab: 'Eventos' },
  { prefix: '/wallet', area: 'ECONOMIA', tab: 'Carteira' },
  { prefix: '/patrocinios', area: 'ECONOMIA', tab: 'Patrocínios' },
  { prefix: '/offerwall', area: 'ECONOMIA', tab: 'Zerads' },
  { prefix: '/referrals', area: 'ECONOMIA', tab: 'Indicações' },
  { prefix: '/avisos', area: 'CONFIGURAÇÕES', tab: 'Avisos' },
  { prefix: '/support', area: 'CONFIGURAÇÕES', tab: 'Suporte' },
  { prefix: '/settings', area: 'CONFIGURAÇÕES', tab: 'Configurações' },
  { prefix: '/roadmap', area: 'CONFIGURAÇÕES', tab: 'Roadmap' },
  { prefix: '/whitepaper', area: 'CONFIGURAÇÕES', tab: 'Whitepaper' },
  { prefix: '/transparencia', area: 'CONFIGURAÇÕES', tab: 'Transparência' },
  { prefix: '/login', area: 'AUTH', tab: 'Login' },
  { prefix: '/register', area: 'AUTH', tab: 'Registro' },
];

/** Admin routes — mirrors AdminLayout sections. */
const ADMIN_ROUTES: { prefix: string; area: string; tab: string }[] = [
  { prefix: '/admin/users/', area: 'Comunidade', tab: 'Usuário' },
  { prefix: '/admin/users', area: 'Comunidade', tab: 'Usuários' },
  { prefix: '/admin/reports', area: 'Visão Geral', tab: 'Relatórios' },
  { prefix: '/admin/failures', area: 'Visão Geral', tab: 'Falhas' },
  { prefix: '/admin/support', area: 'Comunidade', tab: 'Suporte' },
  { prefix: '/admin/referrals', area: 'Comunidade', tab: 'Indicações' },
  { prefix: '/admin/withdrawals', area: 'Financeiro', tab: 'Saques' },
  { prefix: '/admin/wallet', area: 'Financeiro', tab: 'Carteira' },
  { prefix: '/admin/items', area: 'Conteúdo do Jogo', tab: 'Itens' },
  { prefix: '/admin/stadiums', area: 'Conteúdo do Jogo', tab: 'Estádios' },
  { prefix: '/admin/vestiario', area: 'Conteúdo do Jogo', tab: 'Vestiário' },
  { prefix: '/admin/escritorio', area: 'Conteúdo do Jogo', tab: 'Escritório' },
  { prefix: '/admin/stadium-shop', area: 'Conteúdo do Jogo', tab: 'Loja do Estádio' },
  { prefix: '/admin/pass', area: 'Conteúdo do Jogo', tab: 'Passe' },
  { prefix: '/admin/comunicados', area: 'Engajamento', tab: 'Comunicados' },
  { prefix: '/admin/telegram', area: 'Engajamento', tab: 'Telegram' },
  { prefix: '/admin/email', area: 'Engajamento', tab: 'E-mail' },
  { prefix: '/admin/transparency', area: 'Engajamento', tab: 'Transparência' },
  { prefix: '/admin/roadmap', area: 'Engajamento', tab: 'Roadmap' },
  { prefix: '/admin/social', area: 'Engajamento', tab: 'Social' },
  { prefix: '/admin/settings', area: 'Operações & Segurança', tab: 'Configurações' },
  { prefix: '/admin/security', area: 'Operações & Segurança', tab: 'Segurança' },
  { prefix: '/admin/logs', area: 'Operações & Segurança', tab: 'Logs' },
  { prefix: '/admin/audit', area: 'Operações & Segurança', tab: 'Auditoria' },
  { prefix: '/admin/admins', area: 'Operações & Segurança', tab: 'Admins' },
  { prefix: '/admin/login', area: 'AUTH', tab: 'Login Admin' },
  { prefix: '/admin/verify-2fa', area: 'AUTH', tab: '2FA Admin' },
  { prefix: '/admin', area: 'Visão Geral', tab: 'Overview' },
];

function matchRoute(pathname: string, routes: typeof PLAYER_ROUTES): RouteMeta | null {
  const sorted = [...routes].sort((a, b) => b.prefix.length - a.prefix.length);
  for (const r of sorted) {
    if (pathname === r.prefix || pathname.startsWith(`${r.prefix}/`)) {
      return { area: r.area, tab: r.tab };
    }
  }
  return null;
}

export function detectSurface(pathname: string): ErrorSurface {
  if (pathname.startsWith('/admin')) {
    if (pathname === '/admin/login' || pathname === '/admin/verify-2fa') {
      return 'public';
    }
    return 'admin';
  }
  if (
    pathname === '/login' ||
    pathname === '/register' ||
    pathname.startsWith('/auth/') ||
    pathname.startsWith('/legal/') ||
    pathname === '/'
  ) {
    return 'public';
  }
  return 'player';
}

export function getRouteContext(pathname?: string): {
  route: string;
  surface: ErrorSurface;
  area: string | null;
  tab: string | null;
} {
  const route =
    pathname ??
    (typeof window !== 'undefined' ? window.location.pathname : '/');
  const surface = detectSurface(route);
  const table = surface === 'admin' ? ADMIN_ROUTES : PLAYER_ROUTES;
  const meta = matchRoute(route, table);
  const pageTab = getCurrentPageTab();

  return {
    route,
    surface,
    area: meta?.area ?? null,
    tab: pageTab ?? meta?.tab ?? null,
  };
}

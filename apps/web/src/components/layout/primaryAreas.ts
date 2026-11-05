import type { PixelGlyphName } from './PixelGlyph';

export type AreaId =
  | 'inicio'
  | 'clube'
  | 'vestiario'
  | 'stake'
  | 'ct'
  | 'mercado'
  | 'temporada'
  | 'inventario'
  | 'economia'
  | 'config';

export interface SubNavItem {
  path: string;
  labelKey: string;
  defaultLabel: string;
  /** Solid button color for the shortcut bar. */
  accent?: string;
}

export interface PrimaryArea {
  id: AreaId;
  path: string;
  icon: PixelGlyphName;
  labelKey: string;
  defaultLabel: string;
  match: (pathname: string) => boolean;
  subnav?: SubNavItem[];
}

function hit(pathname: string, prefixes: string[]): boolean {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export const PRIMARY_AREAS: PrimaryArea[] = [
  {
    id: 'inicio',
    path: '/club',
    icon: 'home',
    labelKey: 'nav.areas.home',
    defaultLabel: 'INÍCIO',
    match: (pathname) => pathname === '/club',
  },
  {
    id: 'clube',
    path: '/club/gestao',
    icon: 'shield',
    labelKey: 'nav.areas.club',
    defaultLabel: 'CLUBE',
    match: (pathname) =>
      hit(pathname, [
        '/club/gestao',
        '/club/stadium',
        '/club/checkin',
        '/club/escritorio',
        '/club/museum',
        '/club/perfil',
        '/club/treasurer',
        '/club/trophies',
      ]),
    subnav: [
      { path: '/club/perfil', labelKey: 'nav.profile', defaultLabel: 'PERFIL', accent: '#4338ca' },
      { path: '/club/gestao', labelKey: 'nav.areas.club', defaultLabel: 'MEU CLUBE', accent: '#15803d' },
      { path: '/club/stadium', labelKey: 'nav.stadium', defaultLabel: 'ESTÁDIO', accent: '#1d4ed8' },
      { path: '/club/checkin', labelKey: 'nav.dailyPresence', defaultLabel: 'PRESENÇA', accent: '#c2410c' },
      { path: '/club/escritorio', labelKey: 'nav.office', defaultLabel: 'ESCRITÓRIO', accent: '#6d28d9' },
      { path: '/club/museum', labelKey: 'nav.museum', defaultLabel: 'MUSEU', accent: '#be123c' },
    ],
  },
  {
    id: 'vestiario',
    path: '/club/vestiario',
    icon: 'shirt',
    labelKey: 'nav.areas.locker',
    defaultLabel: 'VESTIÁRIO',
    match: (pathname) => hit(pathname, ['/club/vestiario']),
  },
  {
    id: 'stake',
    path: '/club/stake',
    icon: 'coin',
    labelKey: 'nav.areas.stake',
    defaultLabel: 'STAKE',
    match: (pathname) => hit(pathname, ['/club/stake']),
  },
  {
    id: 'ct',
    path: '/club/ct',
    icon: 'weights',
    labelKey: 'nav.areas.ct',
    defaultLabel: 'CT',
    match: (pathname) => hit(pathname, ['/club/ct']),
  },
  {
    id: 'mercado',
    path: '/marketplace',
    icon: 'shop',
    labelKey: 'nav.areas.market',
    defaultLabel: 'MERCADO',
    match: (pathname) => hit(pathname, ['/marketplace', '/boneco', '/scout', '/club/merger', '/club/shop', '/club/warehouse']),
    subnav: [
      { path: '/marketplace', labelKey: 'nav.market', defaultLabel: 'MERCADO', accent: '#0f766e' },
      { path: '/boneco', labelKey: 'nav.boneco', defaultLabel: 'PERSONALIZE SEU JOGADOR', accent: '#be123c' },
      { path: '/scout', labelKey: 'nav.scout', defaultLabel: 'OLHEIRO', accent: '#0369a1' },
      { path: '/club/merger', labelKey: 'nav.merger', defaultLabel: 'FUSÃO', accent: '#6d28d9' },
      { path: '/club/shop', labelKey: 'nav.shop', defaultLabel: 'LOJINHA', accent: '#a16207' },
      { path: '/club/warehouse', labelKey: 'nav.warehouse', defaultLabel: 'ALMOXARIFADO', accent: '#3f6212' },
    ],
  },
  {
    id: 'temporada',
    path: '/ranking',
    icon: 'trophy',
    labelKey: 'nav.areas.season',
    defaultLabel: 'TEMPORADA',
    match: (pathname) => hit(pathname, ['/pass', '/ranking', '/pvp', '/eventos']),
    subnav: [
      { path: '/pass', labelKey: 'nav.pass', defaultLabel: 'PASSE', accent: '#86198f' },
      { path: '/ranking', labelKey: 'nav.ranking', defaultLabel: 'TABELA', accent: '#155e75' },
      { path: '/pvp', labelKey: 'nav.pvp', defaultLabel: 'PVP', accent: '#b91c1c' },
      { path: '/eventos', labelKey: 'nav.events', defaultLabel: 'EVENTOS', accent: '#9a3412' },
    ],
  },
  {
    id: 'inventario',
    path: '/club/inventory',
    icon: 'chest',
    labelKey: 'nav.areas.inventory',
    defaultLabel: 'ITENS',
    match: (pathname) => hit(pathname, ['/club/inventory']),
  },
  {
    id: 'economia',
    path: '/wallet',
    icon: 'coin',
    labelKey: 'nav.areas.economy',
    defaultLabel: 'ECONOMIA',
    match: (pathname) => hit(pathname, ['/wallet', '/patrocinios', '/offerwall', '/referrals', '/mining']),
    subnav: [
      { path: '/wallet', labelKey: 'nav.wallet', defaultLabel: 'SALDOS', accent: '#92400e' },
      { path: '/patrocinios', labelKey: 'nav.sponsorships', defaultLabel: 'PATROCÍNIOS', accent: '#1e3a8a' },
      { path: '/offerwall', labelKey: 'nav.offerwall', defaultLabel: 'ZERADS', accent: '#9d174d' },
      { path: '/referrals', labelKey: 'nav.referrals', defaultLabel: 'INDICAÇÕES', accent: '#065f46' },
    ],
  },
  {
    id: 'config',
    path: '/settings',
    icon: 'gear',
    labelKey: 'nav.areas.settings',
    defaultLabel: 'CONFIG',
    match: (pathname) =>
      hit(pathname, ['/settings', '/avisos', '/support', '/roadmap', '/whitepaper', '/transparencia']),
    subnav: [
      { path: '/settings', labelKey: 'nav.settings', defaultLabel: 'CONTA', accent: '#334155' },
      { path: '/avisos', labelKey: 'nav.notices', defaultLabel: 'AVISOS', accent: '#c2410c' },
      { path: '/support', labelKey: 'nav.support', defaultLabel: 'SUPORTE', accent: '#075985' },
      { path: '/roadmap', labelKey: 'nav.roadmap', defaultLabel: 'ROADMAP', accent: '#5b21b6' },
      { path: '/whitepaper', labelKey: 'nav.whitepaper', defaultLabel: 'WHITEPAPER', accent: '#44403c' },
      { path: '/transparencia', labelKey: 'nav.transparency', defaultLabel: 'TRANSPARÊNCIA', accent: '#115e59' },
    ],
  },
];

export function areaById(id: AreaId): PrimaryArea {
  const area = PRIMARY_AREAS.find((item) => item.id === id);
  if (!area) throw new Error(`Unknown area ${id}`);
  return area;
}

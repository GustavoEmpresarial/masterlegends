import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { usePassProgress } from '../../hooks/useApi';

export type SidebarNavAction = 'replay-tutorial';

export interface SidebarNavItem {
  /** Route path for Link items. Omit when using `action`. */
  path?: string;
  label: string;
  icon: string;
  color: string;
  /** Non-navigation action (e.g. open tutorial replay). */
  action?: SidebarNavAction;
}

export interface SidebarNavGroup {
  label: string;
  color: string;
  items: SidebarNavItem[];
}

export function useSidebarNavItems(): SidebarNavGroup[] {
  const { t } = useTranslation('common');
  const { data: passProgress } = usePassProgress();

  return useMemo(() => {
    const groups: SidebarNavGroup[] = [
      {
        label: t('nav.groups.myClub', { defaultValue: 'MEU CLUBE' }),
        color: 'var(--green)',
        items: [
          { path: '/club', label: t('nav.myClub'), icon: 'bi bi-house-door-fill', color: 'var(--green)' },
          { path: '/club/stadium', label: t('nav.stadium', { defaultValue: 'Estádio' }), icon: 'bi bi-buildings-fill', color: 'var(--green)' },
          { path: '/club/vestiario', label: t('nav.vestiario', { defaultValue: 'Vestiário' }), icon: 'bi bi-person-lines-fill', color: 'var(--blue)' },
          { path: '/club/checkin', label: t('nav.dailyPresence'), icon: 'bi bi-calendar-check-fill', color: 'var(--gold)' },
          { path: '/club/ct', label: t('nav.ct', { defaultValue: 'CT' }), icon: 'bi bi-lightning-charge-fill', color: 'var(--gold)' },
          { path: '/club/escritorio', label: t('nav.office', { defaultValue: 'Escritório' }), icon: 'bi bi-briefcase-fill', color: 'var(--purple)' },
          { path: '/club/inventory', label: t('nav.squad'), icon: 'bi bi-people-fill', color: 'var(--blue)' },
          { path: '/club/museum', label: t('nav.museum', { defaultValue: 'Museu' }), icon: 'bi bi-bank2', color: 'var(--gold)' },
        ],
      },
      {
        label: t('nav.groups.market', { defaultValue: 'MERCADO' }),
        color: 'var(--purple)',
        items: [
          { path: '/scout', label: t('nav.scout'), icon: 'bi bi-binoculars-fill', color: 'var(--green)' },
          { path: '/marketplace', label: t('nav.marketplace'), icon: 'bi bi-shop-window', color: 'var(--purple)' },
          { path: '/boneco', label: t('nav.boneco', { defaultValue: 'Personalize seu jogador' }), icon: 'bi bi-person-bounding-box', color: 'var(--red)' },
          { path: '/club/shop', label: t('nav.shop', { defaultValue: 'Lojinha' }), icon: 'bi bi-bag-fill', color: 'var(--gold)' },
          { path: '/club/warehouse', label: t('nav.warehouse', { defaultValue: 'Almoxarifado' }), icon: 'bi bi-box-seam-fill', color: 'var(--purple)' },
        ],
      },
      {
        label: t('nav.groups.competition', { defaultValue: 'COMPETIÇÃO' }),
        color: 'var(--gold)',
        items: [
          { path: '/ranking', label: t('nav.ranking', { defaultValue: 'Tabela' }), icon: 'bi bi-trophy-fill', color: 'var(--gold)' },
          { path: '/pvp', label: t('nav.pvp', { defaultValue: 'PvP ⚔️' }), icon: 'bi bi-controller', color: 'var(--red)' },
          { path: '/eventos', label: t('nav.events', { defaultValue: 'Eventos' }), icon: 'bi bi-calendar-event-fill', color: 'var(--green)' },
          ...(passProgress?.active
            ? [{ path: '/pass', label: t('nav.pass'), icon: 'bi bi-ticket-perforated-fill', color: 'var(--gold)' }]
            : []),
        ],
      },
      {
        label: t('nav.groups.economy', { defaultValue: 'ECONOMIA' }),
        color: 'var(--cyan)',
        items: [
          { path: '/wallet', label: t('nav.wallet'), icon: 'bi bi-wallet2', color: 'var(--purple)' },
          { path: '/patrocinios', label: t('nav.sponsorships', { defaultValue: 'Patrocínios' }), icon: 'bi bi-cash-coin', color: 'var(--gold)' },
          { path: '/offerwall', label: t('nav.offerwall', { defaultValue: 'Zerads 🎁' }), icon: 'bi bi-gift-fill', color: 'var(--cyan)' },
          { path: '/referrals', label: t('nav.referrals'), icon: 'bi bi-share-fill', color: 'var(--green)' },
        ],
      },
      {
        label: t('nav.groups.info', { defaultValue: 'INFO' }),
        color: 'var(--text-secondary)',
        items: [
          {
            action: 'replay-tutorial',
            label: t('nav.tutorials', { defaultValue: 'Tutoriais' }),
            icon: 'bi bi-mortarboard-fill',
            color: 'var(--gold)',
          },
          { path: '/avisos', label: t('nav.notices', { defaultValue: 'Avisos' }), icon: 'bi bi-bell-fill', color: 'var(--gold)' },
          { path: '/support', label: t('nav.support', { defaultValue: 'Suporte' }), icon: 'bi bi-chat-dots-fill', color: 'var(--blue)' },
          { path: '/settings', label: t('nav.settings', { defaultValue: 'Config' }), icon: 'bi bi-gear-fill', color: 'var(--text-secondary)' },
          { path: '/roadmap', label: t('nav.roadmap', { defaultValue: 'Roadmap' }), icon: 'bi bi-map-fill', color: 'var(--blue)' },
          { path: '/whitepaper', label: t('nav.whitepaper', { defaultValue: 'Whitepaper' }), icon: 'bi bi-file-earmark-text-fill', color: 'var(--text-secondary)' },
          { path: '/transparencia', label: t('nav.transparency', { defaultValue: 'Transparência' }), icon: 'bi bi-eye-fill', color: 'var(--green)' },
        ],
      },
    ];

    return groups;
  }, [passProgress?.active, t]);
}

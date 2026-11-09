import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import enCommon from './locales/en/common.json';
import enAuth from './locales/en/auth.json';
import enLanding from './locales/en/landing.json';
import enClub from './locales/en/club.json';
import enScout from './locales/en/scout.json';
import enMarket from './locales/en/market.json';
import enPvp from './locales/en/pvp.json';
import enPass from './locales/en/pass.json';
import enEvents from './locales/en/events.json';
import enReferrals from './locales/en/referrals.json';
import enErrors from './locales/en/errors.json';
import enInventory from './locales/en/inventory.json';
import enMerger from './locales/en/merger.json';
import enLegal from './locales/en/legal.json';
import enWhitepaper from './locales/en/whitepaper.json';

import ptCommon from './locales/pt-BR/common.json';
import ptAuth from './locales/pt-BR/auth.json';
import ptLanding from './locales/pt-BR/landing.json';
import ptClub from './locales/pt-BR/club.json';
import ptScout from './locales/pt-BR/scout.json';
import ptMarket from './locales/pt-BR/market.json';
import ptPvp from './locales/pt-BR/pvp.json';
import ptPass from './locales/pt-BR/pass.json';
import ptEvents from './locales/pt-BR/events.json';
import ptReferrals from './locales/pt-BR/referrals.json';
import ptErrors from './locales/pt-BR/errors.json';
import ptInventory from './locales/pt-BR/inventory.json';
import ptMerger from './locales/pt-BR/merger.json';
import ptLegal from './locales/pt-BR/legal.json';
import ptWhitepaper from './locales/pt-BR/whitepaper.json';

import esCommon from './locales/es/common.json';
import esAuth from './locales/es/auth.json';
import esLanding from './locales/es/landing.json';
import esClub from './locales/es/club.json';
import esScout from './locales/es/scout.json';
import esMarket from './locales/es/market.json';
import esPvp from './locales/es/pvp.json';
import esPass from './locales/es/pass.json';
import esEvents from './locales/es/events.json';
import esReferrals from './locales/es/referrals.json';
import esErrors from './locales/es/errors.json';
import esInventory from './locales/es/inventory.json';
import esMerger from './locales/es/merger.json';
import esLegal from './locales/es/legal.json';
import esWhitepaper from './locales/es/whitepaper.json';

export const SUPPORTED_LANGUAGES = ['en', 'pt-BR', 'es'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

const resources = {
  en: {
    common: enCommon,
    auth: enAuth,
    landing: enLanding,
    club: enClub,
    scout: enScout,
    market: enMarket,
    pvp: enPvp,
    pass: enPass,
    events: enEvents,
    referrals: enReferrals,
    inventory: enInventory,
    merger: enMerger,
    errors: enErrors,
    legal: enLegal,
    whitepaper: enWhitepaper,
  },
  'pt-BR': {
    common: ptCommon,
    auth: ptAuth,
    landing: ptLanding,
    club: ptClub,
    scout: ptScout,
    market: ptMarket,
    pvp: ptPvp,
    pass: ptPass,
    events: ptEvents,
    referrals: ptReferrals,
    inventory: ptInventory,
    merger: ptMerger,
    errors: ptErrors,
    legal: ptLegal,
    whitepaper: ptWhitepaper,
  },
  es: {
    common: esCommon,
    auth: esAuth,
    landing: esLanding,
    club: esClub,
    scout: esScout,
    market: esMarket,
    pvp: esPvp,
    pass: esPass,
    events: esEvents,
    referrals: esReferrals,
    inventory: esInventory,
    merger: esMerger,
    errors: esErrors,
    legal: esLegal,
    whitepaper: esWhitepaper,
  },
} as const;

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    supportedLngs: SUPPORTED_LANGUAGES as unknown as string[],
    ns: ['common', 'auth', 'landing', 'club', 'scout', 'market', 'pvp', 'pass', 'events', 'referrals', 'inventory', 'merger', 'errors', 'legal', 'whitepaper'],
    defaultNS: 'common',
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
      lookupLocalStorage: 'mll_lang',
    },
  });

function syncHtmlLang(lng: string) {
  document.documentElement.lang = lng;
}

syncHtmlLang(i18n.resolvedLanguage ?? 'en');
i18n.on('languageChanged', syncHtmlLang);

export default i18n;

import 'intl-pluralrules';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import { I18nManager } from 'react-native';

import common from '../locales/en/common.json';
import sessions from '../locales/en/sessions.json';
import terminal from '../locales/en/terminal.json';
import settings from '../locales/en/settings.json';
import servers from '../locales/en/servers.json';
import onboarding from '../locales/en/onboarding.json';
import conversation from '../locales/en/conversation.json';
import browse from '../locales/en/browse.json';
import queue from '../locales/en/queue.json';
import pair from '../locales/en/pair.json';
import shared from '../locales/en/shared.json';

import './i18n.types';

const locales = getLocales();
const deviceLocale = locales[0]?.languageCode ?? 'en';
const isRTL = locales[0]?.textDirection === 'rtl';

I18nManager.forceRTL(isRTL);

i18n.use(initReactI18next).init({
  lng: deviceLocale,
  fallbackLng: 'en',
  defaultNS: 'common',
  resources: {
    en: { common, sessions, terminal, settings, servers, onboarding, conversation, browse, queue, pair, shared },
  },
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;

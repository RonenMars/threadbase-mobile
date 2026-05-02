import 'intl-pluralrules';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import common from '../locales/en/common.json';
import sessions from '../locales/en/sessions.json';
import terminal from '../locales/en/terminal.json';
import settings from '../locales/en/settings.json';
import servers from '../locales/en/servers.json';
import onboarding from '../locales/en/onboarding.json';

i18n.use(initReactI18next).init({
  lng: 'en',
  fallbackLng: 'en',
  defaultNS: 'common',
  resources: {
    en: { common, sessions, terminal, settings, servers, onboarding },
  },
  interpolation: { escapeValue: false },
});

export default i18n;

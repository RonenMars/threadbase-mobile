import 'intl-pluralrules';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

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
import feedback from '../locales/en/feedback.json';
import onboardingHe from '../locales/he/onboarding.json';
import sessionsHe from '../locales/he/sessions.json';
import settingsHe from '../locales/he/settings.json';
import serversHe from '../locales/he/servers.json';
import onboardingAr from '../locales/ar/onboarding.json';
import sessionsAr from '../locales/ar/sessions.json';
import settingsAr from '../locales/ar/settings.json';
import serversAr from '../locales/ar/servers.json';
import onboardingRu from '../locales/ru/onboarding.json';
import sessionsRu from '../locales/ru/sessions.json';
import settingsRu from '../locales/ru/settings.json';
import serversRu from '../locales/ru/servers.json';

i18n.use(initReactI18next).init({
  lng: 'en',
  fallbackLng: 'en',
  defaultNS: 'common',
  resources: {
    en: { common, sessions, terminal, settings, servers, onboarding, conversation, browse, queue, pair, shared, feedback },
    he: { onboarding: onboardingHe, sessions: sessionsHe, settings: settingsHe, servers: serversHe },
    ar: { onboarding: onboardingAr, sessions: sessionsAr, settings: settingsAr, servers: serversAr },
    ru: { onboarding: onboardingRu, sessions: sessionsRu, settings: settingsRu, servers: serversRu },
  },
  interpolation: { escapeValue: false },
});

export default i18n;

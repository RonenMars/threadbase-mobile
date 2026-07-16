import 'intl-pluralrules';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import { I18nManager } from 'react-native';

import common_en from '../locales/en/common.json';
import sessions_en from '../locales/en/sessions.json';
import terminal_en from '../locales/en/terminal.json';
import settings_en from '../locales/en/settings.json';
import servers_en from '../locales/en/servers.json';
import onboarding_en from '../locales/en/onboarding.json';
import conversation_en from '../locales/en/conversation.json';
import browse_en from '../locales/en/browse.json';
import queue_en from '../locales/en/queue.json';
import pair_en from '../locales/en/pair.json';
import shared_en from '../locales/en/shared.json';
import feedback_en from '../locales/en/feedback.json';

import common_he from '../locales/he/common.json';
import sessions_he from '../locales/he/sessions.json';
import terminal_he from '../locales/he/terminal.json';
import settings_he from '../locales/he/settings.json';
import servers_he from '../locales/he/servers.json';
import onboarding_he from '../locales/he/onboarding.json';
import conversation_he from '../locales/he/conversation.json';
import browse_he from '../locales/he/browse.json';
import queue_he from '../locales/he/queue.json';
import pair_he from '../locales/he/pair.json';
import shared_he from '../locales/he/shared.json';
import feedback_he from '../locales/he/feedback.json';

import common_ar from '../locales/ar/common.json';
import sessions_ar from '../locales/ar/sessions.json';
import terminal_ar from '../locales/ar/terminal.json';
import settings_ar from '../locales/ar/settings.json';
import servers_ar from '../locales/ar/servers.json';
import onboarding_ar from '../locales/ar/onboarding.json';
import conversation_ar from '../locales/ar/conversation.json';
import browse_ar from '../locales/ar/browse.json';
import queue_ar from '../locales/ar/queue.json';
import pair_ar from '../locales/ar/pair.json';
import shared_ar from '../locales/ar/shared.json';
import feedback_ar from '../locales/ar/feedback.json';

import common_ru from '../locales/ru/common.json';
import sessions_ru from '../locales/ru/sessions.json';
import terminal_ru from '../locales/ru/terminal.json';
import settings_ru from '../locales/ru/settings.json';
import servers_ru from '../locales/ru/servers.json';
import onboarding_ru from '../locales/ru/onboarding.json';
import conversation_ru from '../locales/ru/conversation.json';
import browse_ru from '../locales/ru/browse.json';
import queue_ru from '../locales/ru/queue.json';
import pair_ru from '../locales/ru/pair.json';
import shared_ru from '../locales/ru/shared.json';
import feedback_ru from '../locales/ru/feedback.json';

import './i18n.types';

const locales = getLocales();
const deviceLocale = locales[0]?.languageCode ?? 'en';

i18n.use(initReactI18next).init({
  lng: deviceLocale,
  fallbackLng: 'en',
  defaultNS: 'common',
  resources: {
    en: { common: common_en, sessions: sessions_en, terminal: terminal_en, settings: settings_en, servers: servers_en, onboarding: onboarding_en, conversation: conversation_en, browse: browse_en, queue: queue_en, pair: pair_en, shared: shared_en, feedback: feedback_en },
    he: { common: common_he, sessions: sessions_he, terminal: terminal_he, settings: settings_he, servers: servers_he, onboarding: onboarding_he, conversation: conversation_he, browse: browse_he, queue: queue_he, pair: pair_he, shared: shared_he, feedback: feedback_he },
    ar: { common: common_ar, sessions: sessions_ar, terminal: terminal_ar, settings: settings_ar, servers: servers_ar, onboarding: onboarding_ar, conversation: conversation_ar, browse: browse_ar, queue: queue_ar, pair: pair_ar, shared: shared_ar, feedback: feedback_ar },
    ru: { common: common_ru, sessions: sessions_ru, terminal: terminal_ru, settings: settings_ru, servers: servers_ru, onboarding: onboarding_ru, conversation: conversation_ru, browse: browse_ru, queue: queue_ru, pair: pair_ru, shared: shared_ru, feedback: feedback_ru },
  },
  interpolation: {
    escapeValue: false,
  },
});

// Update RTL based on current language
i18n.on('languageChanged', (lng) => {
  const isRTL = lng === 'he' || lng === 'ar';
  I18nManager.forceRTL(isRTL);
});

export default i18n;

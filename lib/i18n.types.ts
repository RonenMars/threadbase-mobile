import type common from '../locales/en/common.json';
import type sessions from '../locales/en/sessions.json';
import type terminal from '../locales/en/terminal.json';
import type settings from '../locales/en/settings.json';
import type servers from '../locales/en/servers.json';
import type onboarding from '../locales/en/onboarding.json';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    resources: {
      common: typeof common;
      sessions: typeof sessions;
      terminal: typeof terminal;
      settings: typeof settings;
      servers: typeof servers;
      onboarding: typeof onboarding;
    };
  }
}

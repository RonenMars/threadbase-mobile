import type common from '../locales/en/common.json';
import type sessions from '../locales/en/sessions.json';
import type terminal from '../locales/en/terminal.json';
import type settings from '../locales/en/settings.json';
import type servers from '../locales/en/servers.json';
import type onboarding from '../locales/en/onboarding.json';
import type conversation from '../locales/en/conversation.json';
import type browse from '../locales/en/browse.json';
import type queue from '../locales/en/queue.json';
import type pair from '../locales/en/pair.json';
import type shared from '../locales/en/shared.json';

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
      conversation: typeof conversation;
      browse: typeof browse;
      queue: typeof queue;
      pair: typeof pair;
      shared: typeof shared;
    };
  }
}

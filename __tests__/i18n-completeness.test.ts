import enCommon from '../locales/en/common.json';
import enSessions from '../locales/en/sessions.json';
import enTerminal from '../locales/en/terminal.json';
import enSettings from '../locales/en/settings.json';
import enServers from '../locales/en/servers.json';
import enOnboarding from '../locales/en/onboarding.json';

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- scaffolding for second-locale completeness test (see below)
const enResources = { enCommon, enSessions, enTerminal, enSettings, enServers, enOnboarding };

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- scaffolding for second-locale completeness test
function getAllKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) => {
    const key = prefix ? `${prefix}.${k}` : k;
    return typeof v === 'object' && v !== null
      ? getAllKeys(v as Record<string, unknown>, key)
      : [key];
  });
}

// When Hebrew (or any locale) is added, import its resources here and
// uncomment the test below. It will fail CI if any English key is missing.

// import heCommon from '../locales/he/common.json';
// ...

describe.skip('i18n key completeness (enable when a second locale is added)', () => {
  it('Hebrew has all English keys', () => {
    // const heResources = { heCommon, ... };
    // Object.entries(enResources).forEach(([ns, enNs]) => {
    //   const enKeys = getAllKeys(enNs as Record<string, unknown>);
    //   const heKeys = getAllKeys(heResources[ns] as Record<string, unknown>);
    //   enKeys.forEach(key => expect(heKeys).toContain(key));
    // });
  });
});

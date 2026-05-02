import i18n from '../test-utils/i18n-setup';

describe('i18n', () => {
  it('returns English string for a common key', () => {
    expect(i18n.t('common:button.cancel')).toBe('Cancel');
  });

  it('returns singular session count', () => {
    expect(i18n.t('sessions:list.sessionCount', { count: 1 })).toBe('1 session');
  });

  it('returns plural session count', () => {
    expect(i18n.t('sessions:list.sessionCount', { count: 3 })).toBe('3 sessions');
  });

  it('interpolates server name', () => {
    expect(i18n.t('sessions:card.connectedTo', { server: 'My Mac' })).toBe('My Mac');
  });

  it('falls back to key when translation is missing', () => {
    expect(i18n.t('common:nonexistent.key')).toBe('nonexistent.key');
  });

  it.skip('runtime locale switch re-renders with new strings (implement when runtime switching is added)', () => {
    // assert: changing i18n.changeLanguage('he') triggers re-render with Hebrew strings
  });
});

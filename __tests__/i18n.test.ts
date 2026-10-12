import i18n from '../test-utils/i18n-setup';

describe('i18n', () => {
  it('returns English string for a common key', () => {
    expect(i18n.t('common:button.cancel')).toBe('Cancel');
  });

  it('returns singular message count', () => {
    expect(i18n.t('sessions:card.messages', { count: 1 })).toBe('1 message');
  });

  it('returns plural message count', () => {
    expect(i18n.t('sessions:card.messages', { count: 3 })).toBe('3 messages');
  });

  it('interpolates server name', () => {
    expect(i18n.t('servers:dialog.removeMessage', { server: 'My Mac' })).toContain('My Mac');
  });

  it('falls back to key when translation is missing', () => {
    // Intentionally missing key to verify fallback — bypass strict key typing.
    expect(i18n.t('nonexistent.key' as never, { ns: 'common' })).toBe('nonexistent.key');
  });

  it.skip('runtime locale switch re-renders with new strings (implement when runtime switching is added)', () => {
    // assert: changing i18n.changeLanguage('he') triggers re-render with Hebrew strings
  });
});

import i18n from '@/test-utils/i18n-setup'
import {
  getSlowLoadingTitle,
  type SlowLoadingTitleVariant,
} from '@/components/conversation/slowLoadingTitle'

describe('getSlowLoadingTitle', () => {
  it.each<[SlowLoadingTitleVariant, string]>([
    [0, 'Untangling a long thread…'],
    [1, 'Messages are fashionably late…'],
    [2, 'Your messages hit some traffic…'],
  ])('translates semantic variant %s', (variant, expected) => {
    expect(
      getSlowLoadingTitle(variant, i18n.getFixedT('en', ['conversation', 'common'])),
    ).toBe(expected)
  })
})

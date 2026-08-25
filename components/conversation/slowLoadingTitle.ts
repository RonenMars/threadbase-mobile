import type { TFunction } from 'i18next'

export type SlowLoadingTitleVariant = 0 | 1 | 2

export function getSlowLoadingTitle(
  variant: SlowLoadingTitleVariant,
  t: TFunction<['conversation', 'common']>,
): string {
  switch (variant) {
    case 0:
      return t('conversation:slowLoading.title1')
    case 1:
      return t('conversation:slowLoading.title2')
    case 2:
      return t('conversation:slowLoading.title3')
  }
}

import type { TFunction } from 'i18next'
import type { EarlierBucket } from '@/components/sessions/hub/hubUtils'

export const DAY_BUCKET_ORDER: EarlierBucket[] = ['last7Days', 'last14Days', 'lastMonth', 'earlier']

export function dayBucketLabel(bucket: EarlierBucket, t: TFunction<'sessions'>): string {
  switch (bucket) {
    case 'last7Days':
      return t('live.headerLast7Days')
    case 'last14Days':
      return t('live.headerLast14Days')
    case 'lastMonth':
      return t('live.headerLastMonth')
    case 'earlier':
      return t('live.headerEarlier')
  }
}

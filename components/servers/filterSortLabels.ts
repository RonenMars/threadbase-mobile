import type { TFunction } from 'i18next'
import type { SortBy, SortOrder } from '@/types/ui'
import type { ActiveWithin } from '@/lib/sessionFilters'

type T = TFunction<['servers', 'settings', 'sessions']>

export function getSortByLabel(sortBy: SortBy, t: T): string {
  switch (sortBy) {
    case 'state':
      return t('servers:filter.sortStateFirst')
    case 'lastActivity':
      return t('servers:filter.sortRecent')
    case 'projectName':
      return t('servers:filter.sortProjectName')
  }
}

export function getSortOrderLabel(sortOrder: SortOrder, t: T): string {
  switch (sortOrder) {
    case 'desc':
      return t('servers:filter.newestFirst')
    case 'asc':
      return t('servers:filter.oldestFirst')
  }
}

export function getActiveWithinLabel(within: ActiveWithin, t: T): string {
  switch (within) {
    case 'any':
      return t('servers:filter.anyTime')
    case 'today':
      return t('servers:filter.today')
    case '7d':
      return t('servers:filter.sevenDays')
    case '30d':
      return t('servers:filter.thirtyDays')
  }
}

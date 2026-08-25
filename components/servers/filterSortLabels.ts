import type { TFunction } from 'i18next'
import type { SortBy, SortOrder, SessionsLayout } from '@/types/ui'

export function getSessionsLayoutLabel(
  layout: SessionsLayout,
  t: TFunction<['servers', 'settings', 'sessions']>,
): string {
  switch (layout) {
    case 'tree':
      return t('settings:appearance.layoutTree')
    case 'hub':
      return t('settings:appearance.layoutHub')
    case 'classic':
      return t('settings:appearance.layoutClassic')
  }
}

export function getSortByLabel(
  sortBy: SortBy,
  t: TFunction<['servers', 'settings', 'sessions']>,
): string {
  switch (sortBy) {
    case 'lastActivity':
      return t('servers:filter.sortLastMessage')
    case 'projectName':
      return t('servers:filter.sortProjectName')
    case 'startedAt':
      return t('servers:filter.sortCreatedDate')
    case 'status':
      return t('servers:filter.status')
  }
}

export function getSortOrderLabel(
  sortOrder: SortOrder,
  t: TFunction<['servers', 'settings', 'sessions']>,
): string {
  switch (sortOrder) {
    case 'desc':
      return t('servers:filter.newestFirst')
    case 'asc':
      return t('servers:filter.oldestFirst')
  }
}

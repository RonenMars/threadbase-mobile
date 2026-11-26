import { PencilSimpleLine } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import { View } from 'react-native'
import { useTheme } from '@/contexts/ThemeContext'
import { useHasDraft } from '@/stores/drafts'

const MARK_SIZE = 14

type SessionDraftMarkProps = {
  serverId: string
  sessionId: string
  /** The parent already announces the draft in its own label, so the mark stays out of the accessibility tree. */
  decorative?: boolean
}

/** The pencil chat apps show on an unsent message; renders nothing without one. */
export function SessionDraftMark({ serverId, sessionId, decorative = false }: SessionDraftMarkProps) {
  const { t } = useTranslation('sessions')
  const theme = useTheme()
  const hasDraft = useHasDraft(serverId, sessionId)

  if (!hasDraft) return null

  return (
    <View
      accessible={!decorative}
      accessibilityRole="image"
      accessibilityLabel={decorative ? undefined : t('row.hasDraft')}
      importantForAccessibility={decorative ? 'no-hide-descendants' : 'auto'}
      testID={`session-draft-mark-${sessionId}`}
    >
      <PencilSimpleLine size={MARK_SIZE} color={theme.text.secondary} weight="regular" />
    </View>
  )
}

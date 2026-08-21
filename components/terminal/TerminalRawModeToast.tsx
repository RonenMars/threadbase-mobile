import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useToastSync } from '@/hooks/useToastSync'
import type { AlertSpec } from '@/types/alerts'

const VIEWPORT = 'terminal'
const TOAST_ID = 'terminal-raw'

export function TerminalRawModeToast({ visible }: { visible: boolean }) {
  const { t } = useTranslation('terminal')

  const spec = useMemo((): AlertSpec | null => {
    if (!visible) return null
    return {
      level: 'warning',
      title: t('session.rawModeNote'),
      message: t('session.rawModeDetails'),
      timeout: null,
      hideCloseButton: true,
      testID: 'terminal-raw-mode-note',
    }
  }, [visible, t])

  useToastSync(TOAST_ID, spec, VIEWPORT)
  return null
}

import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useAlertSync } from '@/hooks/useAlertSync'
import { CAUSE_TERMINAL_RAW_MODE, type AlertSpec } from '@/types/alerts'

const VIEWPORT = 'terminal'
const TOAST_ID = 'terminal-raw'

export function TerminalRawModeToast({ visible }: { visible: boolean }) {
  const { t } = useTranslation('terminal')

  const spec = useMemo((): AlertSpec | null => {
    if (!visible) return null
    return {
      cause: CAUSE_TERMINAL_RAW_MODE,
      level: 'warning',
      title: t('session.rawModeNote'),
      message: t('session.rawModeDetails'),
      timeout: null,
      hideCloseButton: true,
      testID: 'terminal-raw-mode-note',
    }
  }, [visible, t])

  useAlertSync(TOAST_ID, spec, VIEWPORT)
  return null
}

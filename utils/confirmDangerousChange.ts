import { Alert } from 'react-native'
import * as LocalAuthentication from 'expo-local-authentication'
import i18n from '@/lib/i18n'

/**
 * Confirm a change that disables Claude's permission prompts.
 *
 * Two tiers, by design:
 *   - Biometrics enrolled  → the OS prompt (Face/Touch ID or device passcode)
 *     gates the change, so someone holding an unlocked phone still can't flip it.
 *   - Not enrolled         → a plain Approve/Cancel alert. Weaker, but the only
 *     thing available; the point is that it can never happen without an
 *     explicit, informed tap.
 *
 * Returns true only on an affirmative confirmation. Any error, cancel or
 * dismissal returns false — this must fail closed.
 */
export async function confirmDangerousChange(message: string): Promise<boolean> {
  const title = i18n.t('servers:claudeFlags.confirmTitle')

  let enrolled = false
  try {
    enrolled = await LocalAuthentication.isEnrolledAsync()
  } catch {
    // Treat a failing biometric stack as "not enrolled" and fall through to the
    // alert, rather than blocking the user out of the setting entirely.
    enrolled = false
  }

  if (enrolled) {
    const acknowledged = await new Promise<boolean>((resolve) => {
      Alert.alert(title, message, [
        { text: i18n.t('common:button.cancel'), style: 'cancel', onPress: () => resolve(false) },
        {
          text: i18n.t('servers:claudeFlags.confirmContinue'),
          style: 'destructive',
          onPress: () => resolve(true),
        },
      ])
    })
    if (!acknowledged) return false

    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: title,
        cancelLabel: i18n.t('common:button.cancel'),
        disableDeviceFallback: false,
      })
      return result.success
    } catch {
      return false
    }
  }

  return await new Promise<boolean>((resolve) => {
    Alert.alert(title, message, [
      { text: i18n.t('common:button.cancel'), style: 'cancel', onPress: () => resolve(false) },
      {
        text: i18n.t('servers:claudeFlags.confirmApprove'),
        style: 'destructive',
        onPress: () => resolve(true),
      },
    ])
  })
}

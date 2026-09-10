import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { NetworkError } from '@/services/api-client'
import { useServersStore } from '@/stores/servers'
import type { useSessionActions } from '@/hooks/useSessionActions'
import type { QuestionBlock } from '@/utils/parseQuestionBlock'

type SessionActions = ReturnType<typeof useSessionActions>

interface Params {
  serverId: string
  activeQuestion: QuestionBlock | null
  clearQuestion: (expectedKey?: string) => void
  sendKeys: SessionActions['sendKeys']
  sendRawKey: SessionActions['sendRawKey']
}

function isRawKeyStaleError(err: Error | null): boolean {
  return err instanceof NetworkError && err.code === 'raw_key_stale'
}

/**
 * Cancel on a live question card. Dismissing one card is not the same intent as
 * interrupting the agent (stopResponse, the raw keyboard's Escape), although all
 * three once wrote the same byte: a blind Escape that lands after the gate has
 * already closed interrupts the turn the user is waiting on, silently. So where
 * the card carries a registry promptId, the Escape goes through /raw-key bound
 * to it, and the card comes down on the server's verdict rather than on the tap.
 *
 * Honest limit: a streamer that has `rawKeys` but predates binding escape to a
 * promptId still writes it blind and answers 200. That is no worse than the old
 * path, and becomes correct once the server binds it. Without `rawKeys`, or on a
 * card with no promptId, this is the old blind write + immediate dismiss.
 */
export function useQuestionCancel({ serverId, activeQuestion, clearQuestion, sendKeys, sendRawKey }: Params) {
  const { t } = useTranslation('terminal')
  const rawKeysSupported = useServersStore((s) => s.servers?.[serverId]?.serverInfo?.rawKeys === true)

  const cancelQuestion = useCallback(() => {
    // Only the provider-neutral card has a registry promptId. A legacy gateId or
    // toolUseId is a different namespace and must not be passed off as one.
    const promptId = activeQuestion?.source === 'prompt' ? activeQuestion.promptId : undefined
    if (!rawKeysSupported || promptId === undefined) {
      sendKeys.mutate('\x1b')
      clearQuestion()
      return
    }
    // A second tap would be a second Escape, which a streamer that still writes
    // escape blind delivers to whatever follows the closed gate.
    if (sendRawKey.isPending) return
    sendRawKey.mutate({ action: 'escape', promptId }, {
      onSuccess: () => clearQuestion(promptId),
      // Stale means the gate had already gone and nothing was written — the
      // outcome the user asked for, so the card comes down as a notice.
      onError: (err) => {
        if (isRawKeyStaleError(err)) clearQuestion(promptId)
      },
    })
  }, [activeQuestion, clearQuestion, rawKeysSupported, sendKeys, sendRawKey])

  const isStale = isRawKeyStaleError(sendRawKey.error)
  // /raw-key refuses with `{ ok: false, code }` and no text, so a coded error's
  // message is only "Server returned <status>" — not something to show a user.
  const failure = sendRawKey.error && !isStale ? sendRawKey.error : null
  const cancelErrorMessage = failure
    ? failure instanceof NetworkError && failure.code !== undefined
      ? t('rawKeyboard.failedBody')
      : failure.message
    : null
  return {
    cancelQuestion,
    cancelNoticeMessage: isStale ? t('answer.questionClosed') : null,
    cancelErrorMessage,
  }
}

import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { isPermissionClosedError, isQuestionClosedError } from '@/services/api-client'
import { useActiveQuestion } from '@/hooks/useActiveQuestion'
import type { useSessionActions } from '@/hooks/useSessionActions'
import { permissionAnswerKeys } from '@/utils/permissionAnswerKeys'

type SessionActions = ReturnType<typeof useSessionActions>

interface Params {
  serverId: string
  sessionId: string
  /**
   * Taken as arguments rather than by calling useSessionActions() here, and the
   * distinction is load-bearing rather than stylistic. Both views already hold
   * their own instance for sendInput/sendKeys; a second one created in here
   * would carry its own mutation state, so `answerBusy` would read `isPending`
   * off the instance the answer did NOT go through. The rows would unlock while
   * the request was still out, or stay locked after it landed — and neither
   * looks wrong on screen, which is the failure shape this whole feature keeps
   * producing.
   */
  respondToQuestion: SessionActions['respondToQuestion']
  answerPermission: SessionActions['answerPermission']
}

/**
 * The answer half of a live session's question card: which card is up, what
 * phase it is in, and what a tap does to it.
 *
 * This lived as a byte-identical copy in both live views, which is a defect
 * this pair has already shipped once (#803 fixed the permission handler in
 * ThinkingBubble and left TerminalOutput stale, with nothing catching it until
 * #807). One copy also means the end-to-end seam test covers both views by
 * construction rather than by 120 lines of duplicated mock scaffolding.
 */
export function useQuestionAnswer({ serverId, sessionId, respondToQuestion, answerPermission }: Params) {
  const { t } = useTranslation('terminal')
  const {
    question: activeQuestion,
    clear: clearQuestion,
    markPending,
    phase: answerPhase,
    questionKey,
  } = useActiveQuestion(serverId, sessionId)

  // The gate's identity is captured here, at tap time, and handed back to
  // markPending so the confirmation binds to the gate it was given for. The
  // POST is not instant — the server re-scrapes the screen before accepting —
  // so a second gate can arrive while this is in flight, and confirming
  // "whatever is active now" would ghost one the user never answered.
  //
  // The key, not the block: a repaint that only moves the cursor replaces the
  // block while the gate stays the same one, and rejecting that confirmation
  // strands the card in `active` with send disabled.
  const handleAnswerPermission = useCallback(async (optionIndex: number) => {
    const answered = activeQuestion
    const answeredKey = questionKey
    if (!answered) return
    try {
      await answerPermission.mutateAsync({
        contentKey: answered.permissionContentKey,
        gateId: answered.permissionGateId,
        optionIndex,
        keys: permissionAnswerKeys(answered, optionIndex),
      })
      markPending(answeredKey)
    } catch (err) {
      if (isPermissionClosedError(err instanceof Error ? err : null)) clearQuestion()
    }
  }, [activeQuestion, answerPermission, clearQuestion, markPending, questionKey])

  const handleAnswerQuestion = useCallback(async (toolUseId: string, answers: Record<string, string | string[]>) => {
    const answeredKey = questionKey
    if (!activeQuestion) return
    try {
      await respondToQuestion.mutateAsync({ toolUseId, answers })
      markPending(answeredKey)
    } catch (err) {
      if (isQuestionClosedError(err instanceof Error ? err : null)) clearQuestion()
    }
  }, [activeQuestion, clearQuestion, markPending, questionKey, respondToQuestion])

  const isQuestionGoneError = isQuestionClosedError(respondToQuestion.error)
  // Same split for the gate route, and the same reason: a gate the server says
  // is closed is not a failure the user must act on, it is the prompt going
  // away. Everything else is a real error and keeps the card up to retry.
  const isGateClosedError = isPermissionClosedError(answerPermission.error)
  const answerFailure = respondToQuestion.isError && !isQuestionGoneError
    ? respondToQuestion.error
    : answerPermission.isError && !isGateClosedError
      ? answerPermission.error
      : null
  const answerErrorMessage = answerFailure
    ? answerFailure instanceof Error
      ? answerFailure.message
      : t('answer.failed')
    : null
  const answerNoticeMessage =
    (respondToQuestion.isError && isQuestionGoneError) || isGateClosedError ? t('answer.questionClosed') : null

  return {
    activeQuestion,
    answerPhase,
    answerBusy: answerPermission.isPending || respondToQuestion.isPending,
    clearQuestion,
    handleAnswerPermission,
    handleAnswerQuestion,
    answerErrorMessage,
    answerNoticeMessage,
  }
}

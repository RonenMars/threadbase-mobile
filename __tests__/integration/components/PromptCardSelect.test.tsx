import { render, fireEvent } from '@testing-library/react-native'
import React from 'react'
import { ThinkingBubble } from '@/components/conversation/ThinkingBubble'
import { TerminalOutput } from '@/components/terminal/TerminalOutput'
import { mapPromptToBlock } from '@/utils/mapPromptToBlock'
import { renderWithI18n } from '@/test-utils/render'
import type { Prompt } from '@/types/api'
import type { QuestionBlock } from '@/utils/parseQuestionBlock'

const PROMPT: Prompt = {
  schemaVersion: 1,
  sessionId: 's1',
  promptId: 'prompt-1',
  revision: 1,
  state: 'open',
  intent: 'approval',
  title: 'Approval',
  message: 'Do you want to proceed?',
  detail: 'Bash command\ngit push',
  questions: [
    {
      questionId: 'q-1',
      text: 'Do you want to proceed?',
      header: 'Approval',
      inputMode: 'single',
      options: [
        { optionId: 'opt-yes', label: 'Yes' },
        { optionId: 'opt-no', label: 'No' },
      ],
      allowOther: false,
      secret: 'unknown',
    },
  ],
  answerRequirement: 'unknown',
  expiresAt: null,
  provenance: { source: 'screen', confidence: 'inferred' },
}

/**
 * The provider-neutral card on both live surfaces. They hold separate copies of
 * the select handler, which is how the permission handler once drifted between
 * them (#803 / #807), so both are driven here.
 */
describe.each([
  ['ThinkingBubble', (block: QuestionBlock, onAnswerPrompt: jest.Mock, onAnswerPermission: jest.Mock) => (
    <ThinkingBubble lines={[]} isStreaming={false} activeQuestion={block} onSendKeys={jest.fn()} onAnswerPrompt={onAnswerPrompt} onAnswerPermission={onAnswerPermission} />
  )],
  ['TerminalOutput', (block: QuestionBlock, onAnswerPrompt: jest.Mock, onAnswerPermission: jest.Mock) => (
    <TerminalOutput lines={[]} isStreaming={false} activeQuestion={block} onSendKeys={jest.fn()} onAnswerPrompt={onAnswerPrompt} onAnswerPermission={onAnswerPermission} />
  )],
])('%s — provider-neutral prompt card', (_name, renderWith) => {
  it('routes a tap to onAnswerPrompt with the row position, never to the permission handler', async () => {
    const onAnswerPrompt = jest.fn()
    const onAnswerPermission = jest.fn()
    const { getByLabelText } = await render(renderWith(mapPromptToBlock(PROMPT), onAnswerPrompt, onAnswerPermission))

    await fireEvent.press(getByLabelText('No'))

    expect(onAnswerPrompt).toHaveBeenCalledWith(1)
    expect(onAnswerPermission).not.toHaveBeenCalled()
  })

  it('shows the terminal guidance and no rows for an unsupported shape, keeping dismiss', async () => {
    const multi: Prompt = { ...PROMPT, questions: [{ ...PROMPT.questions[0], inputMode: 'multi' }] }
    const { getByTestId, queryByLabelText, getAllByLabelText, getByText } = await renderWithI18n(
      renderWith(mapPromptToBlock(multi), jest.fn(), jest.fn()),
    )

    expect(getByTestId('question-card-unsupported')).toBeTruthy()
    expect(getByText('Do you want to proceed?')).toBeTruthy()
    expect(queryByLabelText('Yes')).toBeNull()
    expect(queryByLabelText('No')).toBeNull()
    // QuestionCard renders dismiss twice (icon and text button); both must survive.
    expect(getAllByLabelText('Cancel').length).toBeGreaterThan(0)
  })
})

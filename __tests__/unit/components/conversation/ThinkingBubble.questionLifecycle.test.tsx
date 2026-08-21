import { render, fireEvent, waitFor } from '@testing-library/react-native'
import React from 'react'
import { ThinkingBubble } from '@/components/conversation/ThinkingBubble'
import type { QuestionBlock } from '@/utils/parseQuestionBlock'

// A question puts the session in `waiting_input`, which is the same edge that
// retires the thinking bubble — so the bubble's fade-then-unmount used to take
// the freshly-arrived QuestionCard down with it ~350ms later. Observed as "the
// question card is sometimes unclickable / not there at all".

/** Mirrors the fade duration in ThinkingBubble. */
const FADE_MS = 350

const aq: QuestionBlock = {
  source: 'structured',
  toolUseId: 't1',
  questions: [
    {
      question: 'Q?',
      header: 'H',
      multiSelect: false,
      options: [
        { label: 'A', description: 'a' },
        { label: 'B', description: 'b' },
      ],
    },
  ],
}

describe('ThinkingBubble question lifecycle', () => {
  it('keeps the card mounted and answerable while the bubble is fading out', async () => {
    const onAnswer = jest.fn()
    const onFadeOutComplete = jest.fn()
    const { getByLabelText } = await render(
      <ThinkingBubble
        lines={[]}
        isStreaming={false}
        fadingOut
        onFadeOutComplete={onFadeOutComplete}
        activeQuestion={aq}
        onAnswer={onAnswer}
      />,
    )

    await fireEvent.press(getByLabelText('B'))
    expect(onAnswer).toHaveBeenCalledWith('t1', { 'Q?': 'B' })

    // Wait past the 350ms fade before judging it: completing the fade is what
    // tells the parent to unmount the footer, and the card lives inside it.
    await new Promise((resolve) => setTimeout(resolve, FADE_MS + 150))
    expect(onFadeOutComplete).not.toHaveBeenCalled()
  })

  it('still fades when there is no card to protect', async () => {
    const onFadeOutComplete = jest.fn()
    await render(
      <ThinkingBubble
        lines={[]}
        isStreaming={false}
        fadingOut
        onFadeOutComplete={onFadeOutComplete}
        subStatus="thinking"
      />,
    )
    await waitFor(() => expect(onFadeOutComplete).toHaveBeenCalled())
  })

  it('dismissing sends Esc AND drops the card locally', async () => {
    const onSendKeys = jest.fn()
    const onDismissQuestion = jest.fn()
    const { getAllByLabelText } = await render(
      <ThinkingBubble
        lines={[]}
        isStreaming={false}
        activeQuestion={aq}
        onSendKeys={onSendKeys}
        onDismissQuestion={onDismissQuestion}
      />,
    )

    // Esc closes the menu on the host, but nothing tells the server, so without
    // the local clear the card lingers and stays tappable against a dead menu.
    await fireEvent.press(getAllByLabelText('Cancel')[0])
    expect(onSendKeys).toHaveBeenCalledWith('\x1b')
    expect(onDismissQuestion).toHaveBeenCalled()
  })

  // The server closes a permission gate only when its PTY detector sees the box
  // gone — the end of the turn, tens of seconds after the tap. The answer is
  // the user's own action, so the card goes on their input, not on the echo.
  it('hands a tapped gate option to the answer route by position, and does not dismiss the card', async () => {
    const onAnswerPermission = jest.fn()
    const onDismissQuestion = jest.fn()
    const gate: QuestionBlock = {
      source: 'permission',
      questions: [{
        question: 'Do you want to proceed?',
        multiSelect: false,
        options: [{ label: 'Yes' }, { label: 'No' }],
      }],
      permissionIndices: [1, 2],
    }
    const { getByLabelText } = await render(
      <ThinkingBubble
        lines={[]}
        isStreaming={false}
        activeQuestion={gate}
        onSendKeys={jest.fn()}
        onAnswerPermission={onAnswerPermission}
        onDismissQuestion={onDismissQuestion}
      />,
    )

    await fireEvent.press(getByLabelText('Yes'))
    // The position in the broadcast options array, not the on-screen number.
    expect(onAnswerPermission).toHaveBeenCalledWith(0)
    // The card outlives the tap: it moves only once the answer has been taken,
    // so a tap on a gate that already closed can clear it with a notice rather
    // than leave the user looking at nothing.
    expect(onDismissQuestion).not.toHaveBeenCalled()
    expect(getByLabelText('Yes')).toBeTruthy()
  })

  it('answers a structured question without dismissing the card', async () => {
    const onAnswer = jest.fn()
    const onDismissQuestion = jest.fn()
    const { getByLabelText } = await render(
      <ThinkingBubble
        lines={[]}
        isStreaming={false}
        activeQuestion={aq}
        onAnswer={onAnswer}
        onDismissQuestion={onDismissQuestion}
      />,
    )

    await fireEvent.press(getByLabelText('B'))
    expect(onAnswer).toHaveBeenCalledWith('t1', { 'Q?': 'B' })
    expect(onDismissQuestion).not.toHaveBeenCalled()
  })
})

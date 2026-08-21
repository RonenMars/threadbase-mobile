/**
 * The ghost card and what it is allowed to block.
 *
 * A card that is answered but not yet confirmed stays on screen so the user can
 * see what they chose, and blocks nothing at all — that is what makes the whole
 * design safe: an answer the server never confirms costs the user nothing, so
 * the exits from `active` are a safety net rather than the only thing between
 * them and a locked app.
 *
 * Both card surfaces are covered because they hold separate copies of the
 * handler, and the composer gate is asserted for what it must NOT touch as much
 * as for what it must.
 */
import React from 'react'
import { fireEvent, screen } from '@testing-library/react-native'
import { ThinkingBubble } from '@/components/conversation/ThinkingBubble'
import { TerminalOutput } from '@/components/terminal/TerminalOutput'
import { ChatComposer, type ChatComposerProps } from '@/components/conversation/ChatComposer'
import { mapPermissionToBlock } from '@/utils/mapPermissionToBlock'
import { renderWithI18n } from '@/test-utils/render'
import type { PermissionOption } from '@/types/api'
import type { QuestionPhase } from '@/hooks/useActiveQuestion'

const OPTIONS: PermissionOption[] = [
  { index: 1, label: 'Yes' },
  { index: 2, label: 'No' },
]

const block = () => mapPermissionToBlock('Do you want to proceed?', OPTIONS, undefined, 'Bash command')

type CardProps = { phase: QuestionPhase | null; busy?: boolean; onAnswerPermission: jest.Mock }

describe.each([
  ['ThinkingBubble', ({ phase, busy, onAnswerPermission }: CardProps) => (
    <ThinkingBubble
      lines={[]}
      isStreaming={false}
      activeQuestion={block()}
      onSendKeys={jest.fn()}
      onAnswerPermission={onAnswerPermission}
      answerPhase={phase}
      answerBusy={busy}
    />
  )],
  ['TerminalOutput', ({ phase, busy, onAnswerPermission }: CardProps) => (
    <TerminalOutput
      lines={[]}
      isStreaming={false}
      activeQuestion={block()}
      onSendKeys={jest.fn()}
      onAnswerPermission={onAnswerPermission}
      answerPhase={phase}
      answerBusy={busy}
    />
  )],
])('%s — ghost card', (_name, renderWith) => {
  it('is tappable while the gate is active', async () => {
    const onAnswerPermission = jest.fn()
    await renderWithI18n(renderWith({ phase: 'active', onAnswerPermission }))

    await fireEvent.press(screen.getByLabelText('Yes'))
    expect(onAnswerPermission).toHaveBeenCalledWith(0)
  })

  it('keeps the prompt on screen once answered, so the user can see what they chose', async () => {
    await renderWithI18n(renderWith({ phase: 'pending', onAnswerPermission: jest.fn() }))

    expect(screen.getByTestId('question-card-ghost')).toBeTruthy()
    expect(screen.getByLabelText('Yes')).toBeTruthy()
  })

  it('ignores taps once answered', async () => {
    const onAnswerPermission = jest.fn()
    await renderWithI18n(renderWith({ phase: 'pending', onAnswerPermission }))

    await fireEvent.press(screen.getByLabelText('No'))
    expect(onAnswerPermission).not.toHaveBeenCalled()
  })

  // The window between the tap and the 200 is still `active`, so nothing else
  // locks the row. A second tap there sends a second answer, which the server
  // then rejects as a mismatch and which clears the card out from under a user
  // who only meant to tap once.
  it('ignores a second tap while the first answer is still in flight', async () => {
    const onAnswerPermission = jest.fn()
    await renderWithI18n(renderWith({ phase: 'active', busy: true, onAnswerPermission }))

    await fireEvent.press(screen.getByLabelText('Yes'))
    expect(onAnswerPermission).not.toHaveBeenCalled()
  })
})

function composerProps(overrides: Partial<ChatComposerProps> = {}): ChatComposerProps {
  return {
    value: 'a message in progress',
    onChangeText: jest.fn(),
    onSend: jest.fn(),
    onAttach: jest.fn(),
    attachments: [],
    onRemoveAttachment: jest.fn(),
    isUploading: false,
    attachError: null,
    sendError: null,
    disabled: false,
    voice: { listening: false, start: jest.fn(), stop: jest.fn() },
    micGranted: false,
    onToggleMic: jest.fn(),
    ...overrides,
  }
}

describe('composer gating while a gate is active', () => {
  it('refuses to send', async () => {
    const props = composerProps({ sendDisabled: true })
    await renderWithI18n(<ChatComposer {...props} />)

    await fireEvent.press(screen.getByTestId('chat-send-button'))
    expect(props.onSend).not.toHaveBeenCalled()
  })

  it('still sends once the gate is answered', async () => {
    const props = composerProps({ sendDisabled: false })
    await renderWithI18n(<ChatComposer {...props} />)

    await fireEvent.press(screen.getByTestId('chat-send-button'))
    expect(props.onSend).toHaveBeenCalled()
  })

  // The composer has a SECOND send button, in the full-screen expand modal.
  // Gating only the inline one leaves a fully working send path one tap away,
  // and nothing about the inline gate would look wrong.
  it('refuses to send from the full-screen composer too', async () => {
    const props = composerProps({ sendDisabled: true })
    await renderWithI18n(<ChatComposer {...props} />)

    await fireEvent.press(screen.getByTestId('expand-input-button'))
    const expandedSend = screen.getAllByLabelText('Send Input').at(-1)!
    await fireEvent.press(expandedSend)

    expect(props.onSend).not.toHaveBeenCalled()
  })

  // Everything below is the half that must NOT be blocked. Disabling the whole
  // composer would turn every stuck card into a total lockout — strictly worse
  // than the bug — and would punish someone drafting their next message.
  it('keeps what the user has already typed', async () => {
    await renderWithI18n(<ChatComposer {...composerProps({ sendDisabled: true })} />)
    expect(screen.getByTestId('chat-message-input').props.value).toBe('a message in progress')
  })

  it('keeps typing live, so a gate arriving mid-sentence does not eat the rest of it', async () => {
    const props = composerProps({ sendDisabled: true })
    await renderWithI18n(<ChatComposer {...props} />)

    await fireEvent.changeText(screen.getByTestId('chat-message-input'), 'still typing')
    expect(props.onChangeText).toHaveBeenCalledWith('still typing')
  })

  it('keeps attachments live', async () => {
    const props = composerProps({ sendDisabled: true })
    await renderWithI18n(<ChatComposer {...props} />)

    await fireEvent.press(screen.getByTestId('chat-attach-button'))
    expect(props.onAttach).toHaveBeenCalled()
  })

  it('keeps the mic live', async () => {
    const props = composerProps({ sendDisabled: true, value: '', micGranted: true })
    await renderWithI18n(<ChatComposer {...props} />)

    await fireEvent.press(screen.getByTestId('chat-mic-button'))
    expect(props.onToggleMic).toHaveBeenCalled()
  })
})

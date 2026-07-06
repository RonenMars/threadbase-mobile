/**
 * ChatComposer — extracted bubble-chat composer.
 *
 * Covers feature parity with the old terminal composer plus PR #141's
 * full-screen expand modal: text input, send, attach, mic, and expand/minimize.
 */
import React from 'react'
import { fireEvent, screen } from '@testing-library/react-native'
import { ChatComposer, type ChatComposerProps } from '@/components/conversation/ChatComposer'
import { renderWithI18n } from '@/test-utils/render'

function makeProps(overrides: Partial<ChatComposerProps> = {}): ChatComposerProps {
  return {
    value: '',
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

async function renderComposer(overrides?: Partial<ChatComposerProps>) {
  const props = makeProps(overrides)
  return { props, ...(await renderWithI18n(<ChatComposer {...props} />)) }
}

describe('ChatComposer', () => {
  it('renders the text input and forwards typing', async () => {
    const { props } = await renderComposer()
    const input = screen.getByTestId('chat-message-input')
    await fireEvent.changeText(input, 'hi')
    expect(props.onChangeText).toHaveBeenCalledWith('hi')
  })

  it('calls onSend when the send button is pressed with text present', async () => {
    const { props } = await renderComposer({ value: 'hello' })
    await fireEvent.press(screen.getByTestId('chat-send-button'))
    expect(props.onSend).toHaveBeenCalled()
  })

  it('calls onAttach when the attach button is pressed', async () => {
    const { props } = await renderComposer()
    await fireEvent.press(screen.getByTestId('chat-attach-button'))
    expect(props.onAttach).toHaveBeenCalled()
  })

  it('shows the mic button and toggles it when no text and mic granted', async () => {
    const { props } = await renderComposer({ micGranted: true })
    await fireEvent.press(screen.getByTestId('chat-mic-button'))
    expect(props.onToggleMic).toHaveBeenCalled()
  })

  it('opens and closes the full-screen expand modal', async () => {
    await renderComposer({ value: 'draft' })
    expect(screen.queryByTestId('message-input-expanded')).toBeNull()
    await fireEvent.press(screen.getByTestId('expand-input-button'))
    expect(screen.getByTestId('message-input-expanded')).toBeTruthy()
    await fireEvent.press(screen.getByTestId('minimize-input-button'))
    expect(screen.queryByTestId('message-input-expanded')).toBeNull()
  })

  it('disables controls when disabled (waking up)', async () => {
    const { props } = await renderComposer({ disabled: true, value: 'x' })
    await fireEvent.press(screen.getByTestId('chat-send-button'))
    expect(props.onSend).not.toHaveBeenCalled()
  })
})

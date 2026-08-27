/**
 * ChatComposer — extracted bubble-chat composer.
 *
 * Covers feature parity with the old terminal composer plus PR #141's
 * full-screen expand modal: text input, send, attach, mic, and expand/minimize.
 */
import React from 'react'
import { StyleSheet, type ViewStyle } from 'react-native'
import { fireEvent, screen, cleanup } from '@testing-library/react-native'
import { ChatComposer, type ChatComposerProps } from '@/components/conversation/ChatComposer'
import { renderWithI18n } from '@/test-utils/render'
import i18n from '@/test-utils/i18n-setup'

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
  afterEach(async () => {
    await i18n.changeLanguage('en')
  })
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

  it('shows sendNotice text when set', async () => {
    await renderComposer({ sendNotice: 'That question isn\'t open anymore.' })
    expect(screen.getByText('That question isn\'t open anymore.')).toBeTruthy()
  })

  it('does not render a sendNotice element when null', async () => {
    await renderComposer({ sendNotice: null })
    expect(screen.queryByText('That question isn\'t open anymore.')).toBeNull()
  })

  it('mirrors the send plane and follows locale writing direction on the input', async () => {
    function isMirrored(element: { props: { style?: ViewStyle | ViewStyle[] } }): boolean {
      const style = StyleSheet.flatten(element.props.style)
      const transform = style.transform
      if (!Array.isArray(transform)) return false
      return transform.some((entry) => 'scaleX' in entry && entry.scaleX === -1)
    }

    await renderComposer({ value: 'hello' })
    const ltrPlane = screen.getByTestId('phosphor-react-native-paper-plane-right-undefined')
    expect(isMirrored(ltrPlane)).toBe(false)
    expect(StyleSheet.flatten(screen.getByTestId('chat-message-input').props.style)).toEqual(
      expect.objectContaining({ direction: 'ltr', writingDirection: 'ltr', textAlign: 'auto' }),
    )

    cleanup()
    await i18n.changeLanguage('he')
    await renderComposer({ value: 'שלום' })
    const rtlPlane = screen.getByTestId('phosphor-react-native-paper-plane-right-undefined')
    expect(isMirrored(rtlPlane)).toBe(true)
    expect(StyleSheet.flatten(screen.getByTestId('chat-message-input').props.style)).toEqual(
      expect.objectContaining({ direction: 'rtl', writingDirection: 'rtl', textAlign: 'auto' }),
    )
  })
})

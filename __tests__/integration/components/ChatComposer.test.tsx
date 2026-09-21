/**
 * ChatComposer — extracted bubble-chat composer.
 *
 * Covers feature parity with the old terminal composer plus PR #141's
 * full-screen expand modal: text input, send, attach, mic, and expand/minimize.
 */
import React from 'react'
import { AppState, Keyboard, Platform, StyleSheet, TextInput, type ViewStyle } from 'react-native'
import { fireEvent, screen, cleanup } from '@testing-library/react-native'
import { ChatComposer, type ChatComposerProps } from '@/components/conversation/ChatComposer'
import { DirectionRoot } from '@/lib/direction-root'
import { renderWithI18n } from '@/test-utils/render'
import i18n from '@/test-utils/i18n-setup'

// Capture every AppState 'change' listener so a test can drive a background →
// active transition, mirroring SessionScreen.holdOnBackground.test.tsx.
let appStateListeners: ((s: string) => void)[] = []
const fireAppState = (s: string) => appStateListeners.forEach((l) => l(s))

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
  return { props, ...(await renderWithI18n(
    <DirectionRoot>
      <ChatComposer {...props} />
    </DirectionRoot>,
  )) }
}

describe('ChatComposer', () => {
  beforeEach(() => {
    appStateListeners = []
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, cb) => {
      appStateListeners.push(cb as (s: string) => void)
      return { remove: jest.fn() } as ReturnType<typeof AppState.addEventListener>
    })
  })

  afterEach(async () => {
    jest.restoreAllMocks()
    await i18n.changeLanguage('en')
  })

  it('refocuses the input on return to foreground if it was focused when backgrounded', async () => {
    await renderComposer()
    const input = screen.getByTestId('chat-message-input')
    fireEvent(input, 'focus')

    // TextInput's jest mock shares one `focus` jest.fn() across every
    // instance (assigned onto the mock class prototype), so clear any calls
    // picked up during render/focus before asserting the foreground nudge.
    const focusSpy = TextInput.prototype.focus as jest.Mock
    focusSpy.mockClear()
    fireAppState('background')
    fireAppState('active')
    expect(focusSpy).toHaveBeenCalled()
  })

  it('does not refocus on return to foreground if the input was never focused', async () => {
    await renderComposer()
    const focusSpy = TextInput.prototype.focus as jest.Mock
    focusSpy.mockClear()
    fireAppState('background')
    fireAppState('active')
    expect(focusSpy).not.toHaveBeenCalled()
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

  // Keyboard decision D1 (docs/audits/composer-keyboard/): sending is part of
  // composing, so the keyboard stays and the user can type the next message.
  it('keeps the keyboard up when a message is sent', async () => {
    const dismiss = jest.spyOn(Keyboard, 'dismiss')
    const { props } = await renderComposer({ value: 'hello' })
    await fireEvent.press(screen.getByTestId('chat-send-button'))
    expect(props.onSend).toHaveBeenCalled()
    expect(dismiss).not.toHaveBeenCalled()
  })

  describe('sending from the expanded editor', () => {
    async function openExpanded({ focused }: { focused: boolean }) {
      const rendered = await renderComposer({ value: 'draft' })
      await fireEvent.press(screen.getByTestId('expand-input-button'))
      if (focused) await fireEvent(screen.getByTestId('message-input-expanded'), 'focus')
      // The jest Modal renders nothing once hidden, so keep the handler iOS
      // calls when the slide-out finishes.
      const onDismiss: () => void = screen.getByTestId('expanded-composer-modal').props.onDismiss
      const focusSpy = TextInput.prototype.focus as jest.Mock
      focusSpy.mockClear()
      await fireEvent.press(screen.getByTestId('expanded-send-button'))
      return { ...rendered, onDismiss, focusSpy }
    }

    it('hands focus to the inline input once the editor has closed (iOS)', async () => {
      const { props, onDismiss, focusSpy } = await openExpanded({ focused: true })
      expect(props.onSend).toHaveBeenCalled()
      expect(screen.queryByTestId('message-input-expanded')).toBeNull()
      expect(focusSpy).not.toHaveBeenCalled()
      onDismiss()
      expect(focusSpy).toHaveBeenCalledTimes(1)
    })

    it('hands focus to the inline input as soon as the editor closes (Android)', async () => {
      jest.replaceProperty(Platform, 'OS', 'android')
      const { focusSpy } = await openExpanded({ focused: true })
      expect(focusSpy).toHaveBeenCalledTimes(1)
    })

    it('does not summon the keyboard when the editor was not focused', async () => {
      const { onDismiss, focusSpy } = await openExpanded({ focused: false })
      onDismiss()
      expect(focusSpy).not.toHaveBeenCalled()
    })
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

  it('mirrors the send plane, follows locale writing direction, and pins iOS chrome LTR', async () => {
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
    expect(StyleSheet.flatten(screen.getByTestId('chat-send-button').parent?.props.style)).toEqual(
      expect.objectContaining({ direction: 'ltr', flexDirection: 'row' }),
    )
  })
})

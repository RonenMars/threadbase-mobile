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
import { lendComposerFocus, returnComposerFocus } from '@/hooks/useComposerFocus'
import { DirectionRoot } from '@/lib/direction-root'
import { renderWithI18n } from '@/test-utils/render'
import i18n from '@/test-utils/i18n-setup'

// Capture every AppState 'change' listener so a test can drive a background →
// active transition, mirroring SessionScreen.holdOnBackground.test.tsx.
let appStateListeners: ((s: string) => void)[] = []
const fireAppState = (s: string) => appStateListeners.forEach((l) => l(s))

// useKeyboardInset reads the keyboard height; a mutable mock lets a test open
// the keyboard under the expanded editor.
const mockKeyboardHeight = { value: 0 }
// The keyboard's progress drives the composer's bottom gap; a mutable mock lets a
// test read the gap part-way through the animation. Safe-area bottom is non-zero
// so the resting pad and the open gap are distinguishable.
const mockKeyboardProgress = { value: 0 }
jest.mock('react-native-keyboard-controller', () => ({
  useReanimatedKeyboardAnimation: () => ({ height: mockKeyboardHeight, progress: mockKeyboardProgress }),
}))
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: unknown }) => children,
  useSafeAreaInsets: () => ({ top: 0, bottom: 34, left: 0, right: 0 }),
}))

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
    mockKeyboardProgress.value = 0
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

  // Decision D2: a composer sub-flow gives focus back; a separate task does not.
  it('takes focus back when a composer sub-flow closes', async () => {
    await renderComposer()
    fireEvent(screen.getByTestId('chat-message-input'), 'focus')
    lendComposerFocus('attach')
    const focusSpy = TextInput.prototype.focus as jest.Mock
    focusSpy.mockClear()

    returnComposerFocus('attach')
    expect(focusSpy).toHaveBeenCalledTimes(1)
  })

  it('leaves focus alone when a separate task closes', async () => {
    await renderComposer()
    fireEvent(screen.getByTestId('chat-message-input'), 'focus')
    lendComposerFocus('rename')
    const focusSpy = TextInput.prototype.focus as jest.Mock
    focusSpy.mockClear()

    returnComposerFocus('rename')
    expect(focusSpy).not.toHaveBeenCalled()
  })

  it('does not refocus while the composer is disabled', async () => {
    await renderComposer({ disabled: true })
    const focusSpy = TextInput.prototype.focus as jest.Mock
    focusSpy.mockClear()
    fireAppState('background')
    fireAppState('active')
    expect(focusSpy).not.toHaveBeenCalled()
  })

  it('does not refocus on return to foreground if the input was never focused', async () => {
    await renderComposer()
    const focusSpy = TextInput.prototype.focus as jest.Mock
    focusSpy.mockClear()
    fireAppState('background')
    fireAppState('active')
    expect(focusSpy).not.toHaveBeenCalled()
  })
  // The editor opens from a focused composer, so it mounts under an already-open
  // keyboard — the case RN's KeyboardAvoidingView had no metrics for.
  it('lifts the expanded editor by the keyboard height', async () => {
    mockKeyboardHeight.value = -300
    await renderComposer({ value: 'draft' })
    await fireEvent.press(screen.getByTestId('expand-input-button'))
    const container = screen.getByTestId('expanded-composer-container')
    expect(StyleSheet.flatten(container.props.style).paddingBottom).toBe(300)
    mockKeyboardHeight.value = 0
  })
  // The gap used to switch discretely on keyboard visibility, jumping 26 pt at
  // the start of every open and the end of every close while the lift animated.
  describe('bottom gap', () => {
    const padOf = () =>
      StyleSheet.flatten(screen.getByTestId('composer-input-area').props.style).paddingBottom

    it('clears the home indicator while the keyboard is away', async () => {
      mockKeyboardProgress.value = 0
      await renderComposer()
      expect(padOf()).toBe(34)
    })

    it('shrinks to a small gap once the keyboard is fully open', async () => {
      mockKeyboardProgress.value = 1
      await renderComposer()
      expect(padOf()).toBe(8)
    })

    it('moves with the keyboard rather than snapping', async () => {
      mockKeyboardProgress.value = 0.5
      await renderComposer()
      expect(padOf()).toBe(21)
    })
  })
  // The raw-keys row is handed in as an accessory so it shares the composer's
  // lift instead of sitting below it as a competing bottom surface.
  it('renders an accessory inside the composer', async () => {
    const { Text: RNText } = jest.requireActual('react-native')
    await renderComposer({ accessory: <RNText testID="composer-accessory">keys</RNText> })
    expect(screen.getByTestId('composer-accessory')).toBeTruthy()
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

  describe('leaving the expanded editor', () => {
    async function openExpanded({
      focused,
      closeWith = 'expanded-send-button',
    }: {
      focused: boolean
      closeWith?: 'expanded-send-button' | 'minimize-input-button'
    }) {
      const rendered = await renderComposer({ value: 'draft' })
      await fireEvent.press(screen.getByTestId('expand-input-button'))
      // The editor's input autofocuses, so it always starts focused; `focused:
      // false` is the user putting the keyboard away again before sending.
      await fireEvent(screen.getByTestId('message-input-expanded'), 'focus')
      if (!focused) await fireEvent(screen.getByTestId('message-input-expanded'), 'blur')
      // The jest Modal renders nothing once hidden, so keep the handler iOS
      // calls when the slide-out finishes.
      const onDismiss: () => void = screen.getByTestId('expanded-composer-modal').props.onDismiss
      // iOS blurs the editor's input during the slide-out, before onDismiss.
      const blurOnClose: () => void = screen.getByTestId('message-input-expanded').props.onBlur
      const focusSpy = TextInput.prototype.focus as jest.Mock
      focusSpy.mockClear()
      await fireEvent.press(screen.getByTestId(closeWith))
      return { ...rendered, onDismiss, blurOnClose, focusSpy }
    }

    it('hands focus to the inline input once the editor has closed (iOS)', async () => {
      const { props, onDismiss, blurOnClose, focusSpy } = await openExpanded({ focused: true })
      expect(props.onSend).toHaveBeenCalled()
      expect(screen.queryByTestId('message-input-expanded')).toBeNull()
      expect(focusSpy).not.toHaveBeenCalled()
      blurOnClose()
      onDismiss()
      expect(focusSpy).toHaveBeenCalledTimes(1)
    })

    it('hands focus to the inline input as soon as the editor closes (Android)', async () => {
      jest.replaceProperty(Platform, 'OS', 'android')
      const { focusSpy } = await openExpanded({ focused: true })
      expect(focusSpy).toHaveBeenCalledTimes(1)
    })

    it('does not summon the keyboard when the editor no longer had focus', async () => {
      const { onDismiss, focusSpy } = await openExpanded({ focused: false })
      onDismiss()
      expect(focusSpy).not.toHaveBeenCalled()
    })

    // Minimize is the same hand-off as send. Calling it while the editor was
    // still on screen reached nothing on device: the keyboard went away and the
    // inline input stayed unfocused.
    it('hands focus back after minimize only once the editor has closed (iOS)', async () => {
      const { props, onDismiss, blurOnClose, focusSpy } = await openExpanded({ focused: true, closeWith: 'minimize-input-button' })
      expect(props.onSend).not.toHaveBeenCalled()
      expect(focusSpy).not.toHaveBeenCalled()
      blurOnClose()
      onDismiss()
      expect(focusSpy).toHaveBeenCalledTimes(1)
    })

    it('hands focus back after minimize as soon as the editor closes (Android)', async () => {
      jest.replaceProperty(Platform, 'OS', 'android')
      const { focusSpy } = await openExpanded({ focused: true, closeWith: 'minimize-input-button' })
      expect(focusSpy).toHaveBeenCalledTimes(1)
    })

    // The hand-off goes through the focus machine, not a local ref: after the
    // editor closes the machine must believe the *inline* input is the one
    // typing, or the next sub-flow would hand focus back to an unmounted editor.
    it('leaves the machine pointing at the inline input', async () => {
      const { onDismiss, focusSpy } = await openExpanded({ focused: true })
      onDismiss()
      expect(focusSpy).toHaveBeenCalledTimes(1)

      lendComposerFocus('attach')
      focusSpy.mockClear()
      returnComposerFocus('attach')
      expect(focusSpy).toHaveBeenCalledTimes(1)
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

  // Dictation owns the input while it listens (keyboard decision D4): a
  // transcript that overwrites the field must not look typeable, and Stop has to
  // stay reachable once the first words make hasContent true.
  describe('while dictating', () => {
    const listening = { listening: true, start: jest.fn(), stop: jest.fn() }

    it('offers stop rather than send, even with a transcript present', async () => {
      const { props } = await renderComposer({ value: 'dictated words', micGranted: true, voice: listening })
      expect(screen.queryByTestId('chat-send-button')).toBeNull()
      await fireEvent.press(screen.getByTestId('chat-mic-button'))
      expect(props.onToggleMic).toHaveBeenCalled()
    })

    it('makes the input read-only', async () => {
      await renderComposer({ value: 'dictated words', micGranted: true, voice: listening })
      expect(screen.getByTestId('chat-message-input').props.editable).toBe(false)
    })

    it('leaves the input editable once dictation stops', async () => {
      await renderComposer({ value: 'dictated words', micGranted: true })
      expect(screen.getByTestId('chat-message-input').props.editable).toBe(true)
      expect(screen.getByTestId('chat-send-button')).toBeTruthy()
    })
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

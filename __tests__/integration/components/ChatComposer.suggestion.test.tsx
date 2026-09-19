/**
 * ChatComposer — prompt suggestion chip. Kept apart from ChatComposer.test.tsx
 * because that file's locale-switching test leaves state that hides later
 * renders in the same file.
 */
import React from 'react'
import { TextInput } from 'react-native'
import { fireEvent, screen } from '@testing-library/react-native'
import { ChatComposer, type ChatComposerProps } from '@/components/conversation/ChatComposer'
import { DirectionRoot } from '@/lib/direction-root'
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
  await renderWithI18n(
    <DirectionRoot>
      <ChatComposer {...props} />
    </DirectionRoot>,
  )
  return props
}

describe('prompt suggestion chip', () => {
  const suggestion = 'add type hints and a docstring'

  it('renders nothing for a null suggestion', async () => {
    await renderComposer({ promptSuggestion: null, onSendSuggestion: jest.fn(), onFillSuggestion: jest.fn() })
    expect(screen.queryByTestId('prompt-suggestion-chip')).toBeNull()
  })

  it('renders nothing when the suggestion props are absent (old server)', async () => {
    await renderComposer()
    expect(screen.queryByTestId('prompt-suggestion-chip')).toBeNull()
  })

  it('tap sends the suggestion text and does not fill the input', async () => {
    const onSendSuggestion = jest.fn()
    const onFillSuggestion = jest.fn()
    await renderComposer({ promptSuggestion: suggestion, onSendSuggestion, onFillSuggestion })
    const chip = screen.getByTestId('prompt-suggestion-chip')
    expect(chip.props.accessibilityRole).toBe('button')
    expect(chip.props.accessibilityLabel).toContain(suggestion)
    expect(chip.props.accessibilityHint).toBeTruthy()
    await fireEvent.press(chip)
    expect(onSendSuggestion).toHaveBeenCalledWith(suggestion)
    expect(onFillSuggestion).not.toHaveBeenCalled()
  })

  it('long-press fills the composer, focuses it and does not send', async () => {
    const onSendSuggestion = jest.fn()
    const onFillSuggestion = jest.fn()
    await renderComposer({ promptSuggestion: suggestion, onSendSuggestion, onFillSuggestion })
    const focusSpy = TextInput.prototype.focus as jest.Mock
    focusSpy.mockClear()
    await fireEvent(screen.getByTestId('prompt-suggestion-chip'), 'longPress')
    expect(onFillSuggestion).toHaveBeenCalledWith(suggestion)
    expect(onSendSuggestion).not.toHaveBeenCalled()
    expect(focusSpy).toHaveBeenCalled()
  })

  const handlers = { promptSuggestion: suggestion, onSendSuggestion: jest.fn(), onFillSuggestion: jest.fn() }

  it('is hidden while the composer holds text', async () => {
    await renderComposer({ ...handlers, value: 'typing' })
    expect(screen.queryByTestId('prompt-suggestion-chip')).toBeNull()
  })

  it('is hidden while an attachment is staged', async () => {
    await renderComposer({
      ...handlers,
      attachments: [{ id: 'a1', originalName: 'a.png', path: '/tmp/a.png', mimeType: 'image/png', sizeBytes: 1 }],
    })
    expect(screen.queryByTestId('prompt-suggestion-chip')).toBeNull()
  })

  it('is hidden while the composer is disabled', async () => {
    await renderComposer({ ...handlers, disabled: true })
    expect(screen.queryByTestId('prompt-suggestion-chip')).toBeNull()
  })

  it('is hidden while an open question card blocks sending', async () => {
    await renderComposer({ ...handlers, sendDisabled: true })
    expect(screen.queryByTestId('prompt-suggestion-chip')).toBeNull()
  })

  it('treats whitespace-only text as empty', async () => {
    await renderComposer({ ...handlers, value: '   ' })
    expect(screen.getByTestId('prompt-suggestion-chip')).toBeTruthy()
  })
})

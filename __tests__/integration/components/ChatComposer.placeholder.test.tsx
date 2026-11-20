/**
 * ChatComposer — a host-supplied placeholder and focus request, used to carry
 * a question the user chose to "Chat about this" into the composer without
 * typing it into their message.
 */
import React from 'react'
import { TextInput } from 'react-native'
import { screen } from '@testing-library/react-native'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/test-utils/i18n-setup'
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

const composer = (props: ChatComposerProps) => (
  <DirectionRoot>
    <ChatComposer {...props} />
  </DirectionRoot>
)

describe('ChatComposer — host placeholder', () => {
  it('shows the host placeholder instead of the default', async () => {
    await renderWithI18n(composer(makeProps({ placeholder: 'Which store should hold sessions?' })))
    expect(screen.getByTestId('chat-message-input').props.placeholder).toBe('Which store should hold sessions?')
  })

  it('keeps the default without one, and leaves the value empty', async () => {
    await renderWithI18n(composer(makeProps({ placeholder: null })))
    const input = screen.getByTestId('chat-message-input')
    expect(input.props.placeholder).not.toBe('Which store should hold sessions?')
    expect(input.props.placeholder).toBeTruthy()
  })

  it('still says the session is starting while disabled', async () => {
    await renderWithI18n(composer(makeProps({ placeholder: 'Which store should hold sessions?', disabled: true })))
    expect(screen.getByTestId('chat-message-input').props.placeholder).not.toBe('Which store should hold sessions?')
  })
})

describe('ChatComposer — focus request', () => {
  const focusSpy = TextInput.prototype.focus as jest.Mock

  it('does not take focus on mount', async () => {
    focusSpy.mockClear()
    await renderWithI18n(composer(makeProps()))
    expect(focusSpy).not.toHaveBeenCalled()
  })

  it('focuses the input each time the request changes', async () => {
    focusSpy.mockClear()
    const { rerender } = await renderWithI18n(composer(makeProps({ focusRequest: 0 })))
    expect(focusSpy).not.toHaveBeenCalled()

    // rerender replaces the whole tree, so it must carry the provider too or the composer remounts.
    const again = (focusRequest: number) => rerender(<I18nextProvider i18n={i18n}>{composer(makeProps({ focusRequest }))}</I18nextProvider>)
    await again(1)
    expect(focusSpy).toHaveBeenCalledTimes(1)

    await again(2)
    expect(focusSpy).toHaveBeenCalledTimes(2)
  })
})

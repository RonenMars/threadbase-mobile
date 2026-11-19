import { fireEvent, render } from '@testing-library/react-native'
import * as Clipboard from 'expo-clipboard'
import { MessageBubble } from '@/components/conversation/MessageBubble'
import { MessageQuoteContext } from '@/components/conversation/MessageContextMenu'
import type { Message } from '@/types/api'
import '@/test-utils/i18n-setup'

const message = (text: string): Message => ({
  id: 'm1',
  role: 'assistant',
  content: [{ type: 'text', text }],
  timestamp: '2026-11-19T00:00:00Z',
})

const WITH_CODE = 'Try **this**:\n```sh\nnpm test\n```'

async function renderMenu(text: string, onQuote?: (t: string) => void) {
  const screen = await render(
    <MessageQuoteContext.Provider value={onQuote ?? null}>
      <MessageBubble message={message(text)} />
    </MessageQuoteContext.Provider>,
  )
  const menu = screen.getByTestId('message-context-menu')
  const titles: string[] = menu.props.actions.map((a: { title: string }) => a.title)
  const pick = async (title: string) => {
    fireEvent(menu, 'press', { nativeEvent: { index: titles.indexOf(title), indexPath: [], name: title } })
    await Promise.resolve()
  }
  return { screen, titles, pick }
}

describe('MessageContextMenu', () => {
  beforeEach(() => jest.clearAllMocks())

  it('offers Copy Code only when the message has a fence, and Quote only with a handler', async () => {
    expect((await renderMenu('plain words')).titles).toEqual(['Copy Message', 'Select Text', 'Copy as Markdown'])
    expect((await renderMenu(WITH_CODE, jest.fn())).titles).toEqual([
      'Copy Message',
      'Select Text',
      'Copy as Markdown',
      'Copy Code',
      'Quote Message',
    ])
  })

  it('copies plain text, markdown source and code', async () => {
    const { pick } = await renderMenu(WITH_CODE)
    await pick('Copy Message')
    expect(Clipboard.setStringAsync).toHaveBeenLastCalledWith('Try this:\nnpm test')
    await pick('Copy as Markdown')
    expect(Clipboard.setStringAsync).toHaveBeenLastCalledWith(WITH_CODE)
    await pick('Copy Code')
    expect(Clipboard.setStringAsync).toHaveBeenLastCalledWith('npm test')
  })

  it('quotes the plain text', async () => {
    const onQuote = jest.fn()
    const { pick } = await renderMenu(WITH_CODE, onQuote)
    await pick('Quote Message')
    expect(onQuote).toHaveBeenCalledWith('Try this:\nnpm test')
  })

  it('opens the select sheet with the plain text', async () => {
    const { screen, pick } = await renderMenu(WITH_CODE)
    await pick('Select Text')
    expect(screen.getByTestId('message-select-text').props.value).toBe('Try this:\nnpm test')
  })
})

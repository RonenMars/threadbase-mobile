import React from 'react'
import { StyleSheet } from 'react-native'
import { fireEvent, render } from '@testing-library/react-native'
import { TerminalOutput } from '@/components/terminal/TerminalOutput'
import type { QuestionBlock } from '@/utils/parseQuestionBlock'
import i18n from '@/test-utils/i18n-setup'

describe('TerminalOutput – rendering', () => {
  it('renders provided lines', async () => {
    const { getByText } = await render(
      <TerminalOutput lines={['hello world', 'second line']} isStreaming={false} />
    )
    expect(getByText('hello world')).toBeTruthy()
    expect(getByText('second line')).toBeTruthy()
  })

  it('renders empty state without crash', async () => {
    await render(<TerminalOutput lines={[]} isStreaming={false} />)
  })

  it('pins PTY lines to LTR while the chrome follows the selected language', async () => {
    await i18n.changeLanguage('he')
    const { getByText, getByTestId } = await render(
      <TerminalOutput lines={['❯ npm run build']} isStreaming={false} />
    )
    expect(StyleSheet.flatten(getByTestId('terminal-output').props.style).direction).toBeUndefined()
    expect(StyleSheet.flatten(getByTestId('terminal-line-row').props.style)).toEqual(
      expect.objectContaining({ direction: 'ltr' }),
    )
    expect(StyleSheet.flatten(getByText('❯ npm run build').props.style)).toEqual(
      expect.objectContaining({ direction: 'ltr', writingDirection: 'ltr' }),
    )
    await i18n.changeLanguage('en')
  })

  it('styles user transcript lines (❯-prefixed) with the accent colour', async () => {
    const { getByText } = await render(
      <TerminalOutput lines={['❯ Howdy', 'plain output']} isStreaming={false} />
    )
    const userLine = getByText('❯ Howdy')
    const flat = StyleSheet.flatten(userLine.props.style)
    expect(flat.color).toBe('#58a6ff')
    expect(flat.fontWeight).toBe('600')
    const plainLine = getByText('plain output')
    expect(StyleSheet.flatten(plainLine.props.style).color).toBe('#e6edf3')
  })
})

describe('TerminalOutput – ANSI stripping', () => {
  it('strips ANSI colour codes from lines', async () => {
    const { getByText } = await render(
      <TerminalOutput lines={['\x1b[32mGreen text\x1b[0m']} isStreaming={false} />
    )
    expect(getByText('Green text')).toBeTruthy()
  })

  it('strips bold/dim ANSI codes', async () => {
    const { getByText } = await render(
      <TerminalOutput lines={['\x1b[1mBold text\x1b[0m']} isStreaming={false} />
    )
    expect(getByText('Bold text')).toBeTruthy()
  })

  it('strips cursor movement codes', async () => {
    const { getByText } = await render(
      <TerminalOutput lines={['\x1b[2Kclean line']} isStreaming={false} />
    )
    expect(getByText('clean line')).toBeTruthy()
  })
})

describe('TerminalOutput – streaming indicator', () => {
  it('renders without crash when isStreaming=true', async () => {
    await render(<TerminalOutput lines={[]} isStreaming={true} />)
  })

  it('renders without crash when isStreaming=false', async () => {
    await render(<TerminalOutput lines={[]} isStreaming={false} />)
  })
})

describe('TerminalOutput – controls', () => {
  it('renders jump-to-bottom button', async () => {
    const { getByLabelText } = await render(
      <TerminalOutput lines={['line']} isStreaming={false} />
    )
    expect(getByLabelText('Scroll to bottom')).toBeTruthy()
  })

  it('renders jump-to-top button', async () => {
    const { getByLabelText } = await render(
      <TerminalOutput lines={['line']} isStreaming={false} />
    )
    expect(getByLabelText('Scroll to top')).toBeTruthy()
  })
})

describe('TerminalOutput – ground-truth user ownership', () => {
  const USER = '#58a6ff'
  const PLAIN = '#e6edf3'
  type TextNode = ReturnType<Awaited<ReturnType<typeof render>>['getByText']>
  const colorOf = (node: TextNode) => StyleSheet.flatten(node.props.style).color

  it('styles only ❯ lines confirmed by userMessageTexts', async () => {
    const { getByText } = await render(
      <TerminalOutput
        lines={['❯ real prompt', '❯ agent echo', 'plain output']}
        isStreaming={false}
        userMessageTexts={new Set(['real prompt'])}
      />
    )
    expect(colorOf(getByText('❯ real prompt'))).toBe(USER)
    // A ❯ line NOT in the set is agent-owned once ground truth is present.
    expect(colorOf(getByText('❯ agent echo'))).toBe(PLAIN)
    expect(colorOf(getByText('plain output'))).toBe(PLAIN)
  })

  it('falls back to the ❯ heuristic when the set is empty (old streamer)', async () => {
    const { getByText } = await render(
      <TerminalOutput
        lines={['❯ anything']}
        isStreaming={false}
        userMessageTexts={new Set()}
      />
    )
    expect(colorOf(getByText('❯ anything'))).toBe(USER)
  })
})

describe('TerminalOutput – wrapped prompt collapsing', () => {
  it('collapses a wrapped user prompt into one highlighted row', async () => {
    const wrappedLines = [
      '❯ this is a long prompt that got',
      'wrapped across multiple',
      'terminal rows',
    ]
    const userMessageTexts = new Set([
      'this is a long prompt that got wrapped across multiple terminal rows',
    ])

    const { queryByText } = await render(
      <TerminalOutput
        lines={wrappedLines}
        isStreaming={false}
        userMessageTexts={userMessageTexts}
      />
    )

    expect(
      queryByText('❯ this is a long prompt that got wrapped across multiple terminal rows')
    ).toBeTruthy()
    expect(queryByText('wrapped across multiple')).toBeNull()
  })
})

describe('TerminalOutput – row testIDs', () => {
  it('renders LineRow with testID for each line', async () => {
    const { queryAllByTestId } = await render(
      <TerminalOutput lines={['hello', 'world']} isStreaming={false} />
    )
    expect(queryAllByTestId('terminal-line-row')).toHaveLength(2)
  })
})

describe('TerminalOutput – resumed scrollback notice', () => {
  it('does not render the notice without onViewResumedConversation', async () => {
    const { queryByTestId } = await render(
      <TerminalOutput lines={[]} isStreaming={false} />
    )
    expect(queryByTestId('terminal-resumed-scrollback-notice')).toBeNull()
  })

  it('renders the split view/search/history links when the callback is set', async () => {
    const onView = jest.fn()
    const onSearch = jest.fn()
    const { getByTestId, getByText } = await render(
      <TerminalOutput
        lines={['startup']}
        isStreaming={false}
        onViewResumedConversation={onView}
        onSearchResumedConversation={onSearch}
      />
    )
    expect(getByTestId('terminal-resumed-scrollback-notice')).toBeTruthy()
    expect(getByText("Earlier output isn't available for a resumed session.")).toBeTruthy()
    expect(getByText('View')).toBeTruthy()
    expect(getByText('search')).toBeTruthy()
    expect(getByText('the conversation history →')).toBeTruthy()
  })

  it('invokes onViewResumedConversation from View and history tail', async () => {
    const onView = jest.fn()
    const onSearch = jest.fn()
    const { getByTestId } = await render(
      <TerminalOutput
        lines={[]}
        isStreaming={false}
        onViewResumedConversation={onView}
        onSearchResumedConversation={onSearch}
      />
    )
    await fireEvent.press(getByTestId('terminal-resumed-history-view'))
    await fireEvent.press(getByTestId('terminal-resumed-history-tail'))
    expect(onView).toHaveBeenCalledTimes(2)
    expect(onSearch).not.toHaveBeenCalled()
  })

  it('invokes onSearchResumedConversation from search', async () => {
    const onView = jest.fn()
    const onSearch = jest.fn()
    const { getByTestId } = await render(
      <TerminalOutput
        lines={[]}
        isStreaming={false}
        onViewResumedConversation={onView}
        onSearchResumedConversation={onSearch}
      />
    )
    await fireEvent.press(getByTestId('terminal-resumed-history-search'))
    expect(onSearch).toHaveBeenCalledTimes(1)
    expect(onView).not.toHaveBeenCalled()
  })
})

describe('TerminalOutput – resume first paint', () => {
  it('keeps prompt lines visible when the composer unlocks after wake', async () => {
    const lines = ['hello from pty', 'prompt ready']
    const { getByText, rerender } = await render(
      <TerminalOutput lines={lines} isStreaming={false} disabled />,
    )
    expect(getByText('hello from pty')).toBeTruthy()
    rerender(
      <TerminalOutput lines={lines} isStreaming={false} disabled={false} />,
    )
    expect(getByText('hello from pty')).toBeTruthy()
    expect(getByText('prompt ready')).toBeTruthy()
  })
})

// The Terminal tab renders its own QuestionCard through a handler duplicated
// from ThinkingBubble. Both were fixed together in #803 — the chat copy has
// tests, this one did not, so deleting the local clear here used to leave the
// whole suite green.
describe('TerminalOutput – answering a question', () => {
  const gate: QuestionBlock = {
    source: 'permission',
    questions: [{
      question: 'Do you want to proceed?',
      multiSelect: false,
      options: [{ label: 'Yes' }, { label: 'No' }],
    }],
    permissionIndices: [1, 2],
  }

  const structured: QuestionBlock = {
    source: 'structured',
    toolUseId: 't1',
    questions: [{
      question: 'Which one?',
      multiSelect: false,
      options: [{ label: 'A' }, { label: 'B' }],
    }],
  }

  it('hands a tapped gate option to the answer route by position, and does not dismiss the card', async () => {
    const onAnswerPermission = jest.fn()
    const onDismissQuestion = jest.fn()
    const { getByLabelText } = await render(
      <TerminalOutput
        lines={[]}
        isStreaming={false}
        activeQuestion={gate}
        onSendKeys={jest.fn()}
        onAnswerPermission={onAnswerPermission}
        onDismissQuestion={onDismissQuestion}
      />
    )

    await fireEvent.press(getByLabelText('Yes'))
    // Position in the options array, not the on-screen number — the server owns
    // that mapping now, and getting it wrong writes the wrong bytes AND stops
    // the gate recognising the answer, so nothing ever closes it.
    expect(onAnswerPermission).toHaveBeenCalledWith(0)
    // The card outlives the tap: it moves only once the answer has been taken.
    expect(onDismissQuestion).not.toHaveBeenCalled()
    expect(getByLabelText('Yes')).toBeTruthy()
  })

  it('answers a structured question without dismissing the card', async () => {
    const onAnswer = jest.fn()
    const onDismissQuestion = jest.fn()
    const { getByLabelText } = await render(
      <TerminalOutput
        lines={[]}
        isStreaming={false}
        activeQuestion={structured}
        onSendKeys={jest.fn()}
        onAnswer={onAnswer}
        onDismissQuestion={onDismissQuestion}
      />
    )

    await fireEvent.press(getByLabelText('B'))
    expect(onAnswer).toHaveBeenCalledWith('t1', { 'Which one?': 'B' })
    expect(onDismissQuestion).not.toHaveBeenCalled()
  })

  // The block carrying nothing for the tapped option used to be decided here,
  // by permissionAnswerKeys returning null. The position is still well defined,
  // so the component reports it and the answer route decides there is nothing
  // to send — see useSessionActions.answerPermission.
  it('still reports the tapped position when the gate carries no keys', async () => {
    const onAnswerPermission = jest.fn()
    const onSendKeys = jest.fn()
    const { getByLabelText } = await render(
      <TerminalOutput
        lines={[]}
        isStreaming={false}
        activeQuestion={{ ...gate, permissionIndices: undefined }}
        onSendKeys={onSendKeys}
        onAnswerPermission={onAnswerPermission}
      />
    )

    await fireEvent.press(getByLabelText('Yes'))
    expect(onAnswerPermission).toHaveBeenCalledWith(0)
    expect(onSendKeys).not.toHaveBeenCalled()
    expect(getByLabelText('Yes')).toBeTruthy()
  })
})

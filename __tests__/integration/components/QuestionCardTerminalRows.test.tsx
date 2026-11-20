/**
 * Claude's two terminal-only rows, answered from the app.
 *
 * Both card surfaces hold their own copy of the answer handler, so both are
 * covered: "Type something." sends `{ other }`, "Chat about this" sends the
 * row's label and hands the question to the composer only once it landed.
 */
import React from 'react'
import { fireEvent, screen, waitFor } from '@testing-library/react-native'
import { ThinkingBubble } from '@/components/conversation/ThinkingBubble'
import { TerminalOutput } from '@/components/terminal/TerminalOutput'
import { mapAskQuestionToBlock } from '@/utils/mapAskQuestionToBlock'
import { renderWithI18n } from '@/test-utils/render'

const QUESTION = 'Which store should hold sessions?'

const block = () => mapAskQuestionToBlock('screen:7', [{
  question: QUESTION,
  header: 'Store',
  multiSelect: false,
  options: [
    { label: 'SQLite', description: '' },
    { label: 'Files', description: '' },
    { label: 'Type something.', description: '', terminalRow: 'other' },
    { label: 'Chat about this', description: '', terminalRow: 'chat' },
  ],
}])

type HostProps = { onAnswer: jest.Mock; onChatAbout?: jest.Mock }

describe.each([
  ['ThinkingBubble', ({ onAnswer, onChatAbout }: HostProps) => (
    <ThinkingBubble lines={[]} activeQuestion={block()} onAnswer={onAnswer} onChatAbout={onChatAbout} answerPhase="active" />
  )],
  ['TerminalOutput', ({ onAnswer, onChatAbout }: HostProps) => (
    <TerminalOutput lines={[]} isStreaming={false} activeQuestion={block()} onAnswer={onAnswer} onChatAbout={onChatAbout} answerPhase="active" />
  )],
])('%s — terminal rows', (_name, renderWith) => {
  it('sends typed text as the free-text answer', async () => {
    const onAnswer = jest.fn().mockResolvedValue(true)
    await renderWithI18n(renderWith({ onAnswer, onChatAbout: jest.fn() }))

    await fireEvent.press(screen.getAllByLabelText('Type something.')[0])
    await fireEvent.changeText(screen.getAllByTestId('question-other-input')[0], 'Postgres')
    await fireEvent.press(screen.getAllByRole('button', { name: 'Send' })[0])

    expect(onAnswer).toHaveBeenCalledWith('screen:7', { [QUESTION]: { other: 'Postgres' } })
  })

  it('forwards the chat row and then hands the question to the composer', async () => {
    const onAnswer = jest.fn().mockResolvedValue(true)
    const onChatAbout = jest.fn()
    await renderWithI18n(renderWith({ onAnswer, onChatAbout }))

    await fireEvent.press(screen.getAllByLabelText('Chat about this')[0])

    expect(onAnswer).toHaveBeenCalledWith('screen:7', { [QUESTION]: 'Chat about this' })
    await waitFor(() => expect(onChatAbout).toHaveBeenCalledWith(QUESTION))
  })

  it('leaves the composer alone when the chat answer did not land', async () => {
    const onAnswer = jest.fn().mockResolvedValue(false)
    const onChatAbout = jest.fn()
    await renderWithI18n(renderWith({ onAnswer, onChatAbout }))

    await fireEvent.press(screen.getAllByLabelText('Chat about this')[0])

    await waitFor(() => expect(onAnswer).toHaveBeenCalled())
    expect(onChatAbout).not.toHaveBeenCalled()
  })

  // An older server declines the whole question on either row.
  it('offers neither row when the view did not opt in', async () => {
    await renderWithI18n(renderWith({ onAnswer: jest.fn() }))

    expect(screen.queryAllByLabelText('Type something.')).toHaveLength(0)
    expect(screen.queryAllByLabelText('Chat about this')).toHaveLength(0)
    expect(screen.getAllByLabelText('SQLite').length).toBeGreaterThan(0)
  })
})

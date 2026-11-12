import { act, render } from '@testing-library/react-native'
import React from 'react'
import { MODAL_DISMISS_FALLBACK_MS, ThinkingBubble, useHoldQuestionHost } from '@/components/conversation/ThinkingBubble'
import type { QuestionBlock } from '@/utils/parseQuestionBlock'

// On iOS a Modal going visible is a presentViewController, going hidden (or
// unmounting) an animated dismiss. A present issued while that dismiss is still
// animating left the app on a black, untouchable window. Jest cannot reproduce
// UIKit's timing; it can only record which native transitions the JS tree asks
// for and in what order, and that is what these tests pin.
const modalLog: string[] = []
let completeDismiss: (() => void) | undefined
jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native')
  const { useEffect, useRef } = jest.requireActual('react')
  function Modal({ visible, children, onDismiss }: { visible: boolean; children: React.ReactNode; onDismiss?: () => void }) {
    const shownRef = useRef(false)
    useEffect(() => { completeDismiss = onDismiss })
    useEffect(() => {
      if (visible === shownRef.current) return
      shownRef.current = visible
      modalLog.push(visible ? 'present' : 'dismiss')
    }, [visible])
    useEffect(() => () => { modalLog.push('unmount') }, [])
    return visible ? children : null
  }
  return new Proxy(RN, { get: (target, key) => (key === 'Modal' ? Modal : target[key]) })
})

const block = (id: string, label: string, n: number): QuestionBlock => ({
  source: 'prompt',
  toolUseId: id,
  questions: [{
    question: `${label}?`,
    header: 'H',
    multiSelect: false,
    options: Array.from({ length: n }, (_, i) => ({ label: `${label}${i}`, description: '' })),
  }],
})

const base = { lines: ['working'], onAnswerPrompt: jest.fn() }
const A = () => block('a', 'A', 3)
const B = () => block('b', 'B', 5)

beforeEach(() => {
  modalLog.length = 0
  completeDismiss = undefined
})

describe('ThinkingBubble full-screen Modal across an answer and the next card', () => {
  it('replayed, content-identical cards present once', async () => {
    const { rerender } = await render(<ThinkingBubble {...base} activeQuestion={A()} answerPhase="active" />)
    for (let i = 0; i < 3; i++) {
      await rerender(<ThinkingBubble {...base} activeQuestion={A()} answerPhase="active" />)
    }
    expect(modalLog).toEqual(['present'])
  })

  // The server publishes A → resolved before it writes the 200, so the card
  // usually clears before markPending can ghost it. 67ms later B opens.
  it('WS-first: holds B until the dismiss of A completes', async () => {
    const { rerender, getByTestId, queryByTestId } = await render(<ThinkingBubble {...base} activeQuestion={A()} answerPhase="active" />)
    await rerender(<ThinkingBubble {...base} activeQuestion={null} answerPhase={null} />)
    await rerender(<ThinkingBubble {...base} activeQuestion={B()} answerPhase="active" />)
    expect(modalLog).toEqual(['present', 'dismiss'])
    expect(queryByTestId('question-fullscreen')).toBeNull()
    expect(getByTestId('question-open-fullscreen')).toBeTruthy()

    await act(() => completeDismiss?.())
    expect(modalLog).toEqual(['present', 'dismiss', 'present'])
    expect(getByTestId('question-fullscreen')).toBeTruthy()
  })

  it('200-first: ghost, clear, next card — B still waits for the dismiss', async () => {
    const { rerender } = await render(<ThinkingBubble {...base} activeQuestion={A()} answerPhase="active" />)
    await rerender(<ThinkingBubble {...base} activeQuestion={A()} answerPhase="pending" />)
    await rerender(<ThinkingBubble {...base} activeQuestion={null} answerPhase={null} />)
    await rerender(<ThinkingBubble {...base} activeQuestion={B()} answerPhase="active" />)
    expect(modalLog).toEqual(['present', 'dismiss'])
    await act(() => completeDismiss?.())
    expect(modalLog).toEqual(['present', 'dismiss', 'present'])
  })

  it('presents B after the fallback when iOS never reports the dismiss', async () => {
    jest.useFakeTimers()
    try {
      const { rerender } = await render(<ThinkingBubble {...base} activeQuestion={A()} answerPhase="active" />)
      await rerender(<ThinkingBubble {...base} activeQuestion={null} answerPhase={null} />)
      await rerender(<ThinkingBubble {...base} activeQuestion={B()} answerPhase="active" />)
      await act(() => jest.advanceTimersByTime(MODAL_DISMISS_FALLBACK_MS - 1))
      expect(modalLog).toEqual(['present', 'dismiss'])
      await act(() => jest.advanceTimersByTime(1))
      expect(modalLog).toEqual(['present', 'dismiss', 'present'])
    } finally {
      jest.useRealTimers()
    }
  })

  it('A replaced by B in one commit: no native transition at all', async () => {
    const { rerender } = await render(<ThinkingBubble {...base} activeQuestion={A()} answerPhase="active" />)
    await rerender(<ThinkingBubble {...base} activeQuestion={B()} answerPhase="active" />)
    expect(modalLog).toEqual(['present'])
  })
})

// LiveConversationView mounts the bubble as the list footer only while a
// question or the thinking animation needs it. A question arrives on the edge
// that retires the animation, so an answer usually unmounts the whole bubble,
// Modal included, while that Modal is still presented, and the next card mounts
// a fresh bubble with no memory of the dismiss in flight.
function FooterHost({ activeQuestion }: { activeQuestion: QuestionBlock | null }) {
  const holding = useHoldQuestionHost(activeQuestion)
  if (activeQuestion === null && !holding) return null
  return <ThinkingBubble {...base} activeQuestion={activeQuestion} answerPhase={activeQuestion ? 'active' : null} />
}

describe('footer host across an answer and the next card', () => {
  it('keeps the bubble mounted so B waits for the dismiss of A', async () => {
    const { rerender } = await render(<FooterHost activeQuestion={A()} />)
    await rerender(<FooterHost activeQuestion={null} />)
    await rerender(<FooterHost activeQuestion={B()} />)
    expect(modalLog).toEqual(['present', 'dismiss'])
    await act(() => completeDismiss?.())
    expect(modalLog).toEqual(['present', 'dismiss', 'present'])
  })

  it('unmounts the bubble once the hold expires', async () => {
    jest.useFakeTimers()
    try {
      const { rerender, queryByTestId } = await render(<FooterHost activeQuestion={A()} />)
      await rerender(<FooterHost activeQuestion={null} />)
      expect(queryByTestId('thinking-bubble')).toBeTruthy()
      await act(() => jest.advanceTimersByTime(MODAL_DISMISS_FALLBACK_MS))
      expect(queryByTestId('thinking-bubble')).toBeNull()
      expect(modalLog).toEqual(['present', 'dismiss', 'unmount'])
    } finally {
      jest.useRealTimers()
    }
  })
})

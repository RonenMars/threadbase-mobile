import { render, fireEvent } from '@testing-library/react-native'
import * as Haptics from 'expo-haptics'
import { QuestionCard } from '@/components/terminal/QuestionCard'
import type { QuestionBlock } from '@/utils/parseQuestionBlock'

const BASE_BLOCK: QuestionBlock = {
  questionText: 'Add fallback to ConversationCache?',
  options: ['both (Recommended)', 'indicator only', 'discriminator only', 'Nothing.'],
  selectedIndex: 0,
  questionLineIndex: 1,
}

describe('QuestionCard', () => {
  it('renders the question text', () => {
    const { getByText } = render(<QuestionCard block={BASE_BLOCK} onSelect={jest.fn()} />)
    expect(getByText('Add fallback to ConversationCache?')).toBeTruthy()
  })

  it('renders all option labels', () => {
    const { getByText } = render(<QuestionCard block={BASE_BLOCK} onSelect={jest.fn()} />)
    for (const option of BASE_BLOCK.options) {
      expect(getByText(option)).toBeTruthy()
    }
  })

  it('renders the correct number of option rows', () => {
    const { getAllByRole } = render(<QuestionCard block={BASE_BLOCK} onSelect={jest.fn()} />)
    expect(getAllByRole('button').length).toBe(BASE_BLOCK.options.length)
  })

  it('calls onSelect with the correct index when an option is pressed', () => {
    const onSelect = jest.fn()
    const { getAllByRole } = render(<QuestionCard block={BASE_BLOCK} onSelect={onSelect} />)
    fireEvent.press(getAllByRole('button')[2])
    expect(onSelect).toHaveBeenCalledWith(2)
  })

  it('triggers haptic feedback on press', () => {
    const { getAllByRole } = render(<QuestionCard block={BASE_BLOCK} onSelect={jest.fn()} />)
    fireEvent.press(getAllByRole('button')[0])
    expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Light)
  })

  it('marks the selected option with accessibilityLabel matching its text', () => {
    const block: QuestionBlock = { ...BASE_BLOCK, selectedIndex: 1 }
    const { getAllByRole } = render(<QuestionCard block={block} onSelect={jest.fn()} />)
    expect(getAllByRole('button')[1].props.accessibilityLabel).toBe('indicator only')
  })

  it('renders a single option correctly', () => {
    const block: QuestionBlock = {
      questionText: 'Confirm?',
      options: ['Yes'],
      selectedIndex: 0,
      questionLineIndex: 0,
    }
    const { getByText } = render(<QuestionCard block={block} onSelect={jest.fn()} />)
    expect(getByText('Confirm?')).toBeTruthy()
    expect(getByText('Yes')).toBeTruthy()
  })
})

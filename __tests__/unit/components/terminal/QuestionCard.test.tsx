import { render, fireEvent } from '@testing-library/react-native'
import * as Haptics from 'expo-haptics'
import { QuestionCard } from '@/components/terminal/QuestionCard'
import type { QuestionBlock } from '@/utils/parseQuestionBlock'

const BASE_BLOCK: QuestionBlock = {
  source: 'structured',
  toolUseId: 't1',
  questions: [{
    question: 'Add fallback to ConversationCache?',
    header: 'Fallback',
    multiSelect: false,
    options: [
      { label: 'both (Recommended)', description: 'first' },
      { label: 'indicator only' },
      { label: 'discriminator only' },
      { label: 'Nothing.' },
    ],
  }],
}

const optionLabels = BASE_BLOCK.questions[0].options.map(o => o.label)

describe('QuestionCard', () => {
  it('renders the question text', () => {
    const { getByText } = render(<QuestionCard block={BASE_BLOCK} onSelect={jest.fn()} />)
    expect(getByText('Add fallback to ConversationCache?')).toBeTruthy()
  })

  it('renders all option labels', () => {
    const { getByText } = render(<QuestionCard block={BASE_BLOCK} onSelect={jest.fn()} />)
    for (const label of optionLabels) {
      expect(getByText(label)).toBeTruthy()
    }
  })

  it('renders the correct number of option rows', () => {
    const { getAllByRole } = render(<QuestionCard block={BASE_BLOCK} onSelect={jest.fn()} />)
    expect(getAllByRole('button').length).toBe(optionLabels.length)
  })

  it('calls onSelect with (questionIndex, optionIndex) when an option is pressed', () => {
    const onSelect = jest.fn()
    const { getAllByRole } = render(<QuestionCard block={BASE_BLOCK} onSelect={onSelect} />)
    fireEvent.press(getAllByRole('button')[2])
    expect(onSelect).toHaveBeenCalledWith(0, 2)
  })

  it('triggers haptic feedback on press', () => {
    const { getAllByRole } = render(<QuestionCard block={BASE_BLOCK} onSelect={jest.fn()} />)
    fireEvent.press(getAllByRole('button')[0])
    expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Light)
  })

  it('uses each option label as its accessibilityLabel', () => {
    const { getAllByRole } = render(<QuestionCard block={BASE_BLOCK} onSelect={jest.fn()} />)
    expect(getAllByRole('button')[1].props.accessibilityLabel).toBe('indicator only')
  })

  it('renders the header and option descriptions', () => {
    const { getByText } = render(<QuestionCard block={BASE_BLOCK} onSelect={jest.fn()} />)
    expect(getByText('Fallback')).toBeTruthy()
    expect(getByText('first')).toBeTruthy()
  })

  it('renders a preview block when present', () => {
    const block: QuestionBlock = {
      ...BASE_BLOCK,
      questions: [{
        ...BASE_BLOCK.questions[0],
        options: [{ label: 'A', description: 'd', preview: 'L1\nL2' }, { label: 'B', description: 'd2' }],
      }],
    }
    const { getByText } = render(<QuestionCard block={block} onSelect={jest.fn()} />)
    expect(getByText(/L1/)).toBeTruthy()
  })

  it('renders the permission-gate `detail` block above the question', () => {
    const block: QuestionBlock = {
      source: 'permission',
      permissionIndices: [1, 2],
      questions: [{
        question: 'Do you want to proceed?',
        detail: 'Bash command\ngit push origin main\nPush the merge commit to origin/main',
        multiSelect: false,
        options: [{ label: 'Yes' }, { label: 'No' }],
      }],
    }
    const { getByText } = render(<QuestionCard block={block} onSelect={jest.fn()} />)
    expect(getByText(/git push origin main/)).toBeTruthy()
    expect(getByText('Do you want to proceed?')).toBeTruthy()
  })

  it('renders a single option correctly', () => {
    const block: QuestionBlock = {
      source: 'structured',
      toolUseId: 't2',
      questions: [{ question: 'Confirm?', multiSelect: false, options: [{ label: 'Yes' }] }],
    }
    const { getByText } = render(<QuestionCard block={block} onSelect={jest.fn()} />)
    expect(getByText('Confirm?')).toBeTruthy()
    expect(getByText('Yes')).toBeTruthy()
  })
})

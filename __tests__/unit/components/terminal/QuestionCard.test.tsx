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
  it('renders the question text', async () => {
    const { getByText } = await render(<QuestionCard block={BASE_BLOCK} onSelect={jest.fn()} />)
    expect(getByText('Add fallback to ConversationCache?')).toBeTruthy()
  })

  it('renders all option labels', async () => {
    const { getByText } = await render(<QuestionCard block={BASE_BLOCK} onSelect={jest.fn()} />)
    for (const label of optionLabels) {
      expect(getByText(label)).toBeTruthy()
    }
  })

  it('renders the correct number of option rows', async () => {
    const { getAllByRole } = await render(<QuestionCard block={BASE_BLOCK} onSelect={jest.fn()} />)
    expect(getAllByRole('button').length).toBe(optionLabels.length)
  })

  it('calls onSelect with (questionIndex, optionIndex) when an option is pressed', async () => {
    const onSelect = jest.fn()
    const { getAllByRole } = await render(<QuestionCard block={BASE_BLOCK} onSelect={onSelect} />)
    await fireEvent.press(getAllByRole('button')[2])
    expect(onSelect).toHaveBeenCalledWith(0, 2)
  })

  it('triggers haptic feedback on press', async () => {
    const { getAllByRole } = await render(<QuestionCard block={BASE_BLOCK} onSelect={jest.fn()} />)
    await fireEvent.press(getAllByRole('button')[0])
    expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Light)
  })

  it('uses each option label as its accessibilityLabel', async () => {
    const { getAllByRole } = await render(<QuestionCard block={BASE_BLOCK} onSelect={jest.fn()} />)
    expect(getAllByRole('button')[1].props.accessibilityLabel).toBe('indicator only')
  })

  it('renders the header and option descriptions', async () => {
    const { getByText } = await render(<QuestionCard block={BASE_BLOCK} onSelect={jest.fn()} />)
    expect(getByText('Fallback')).toBeTruthy()
    expect(getByText('first')).toBeTruthy()
  })

  it('renders a preview block when present', async () => {
    const block: QuestionBlock = {
      ...BASE_BLOCK,
      questions: [{
        ...BASE_BLOCK.questions[0],
        options: [{ label: 'A', description: 'd', preview: 'L1\nL2' }, { label: 'B', description: 'd2' }],
      }],
    }
    const { getByText } = await render(<QuestionCard block={block} onSelect={jest.fn()} />)
    expect(getByText(/L1/)).toBeTruthy()
  })

  it('renders the permission-gate `detail` block above the question', async () => {
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
    const { getByText } = await render(<QuestionCard block={block} onSelect={jest.fn()} />)
    expect(getByText(/git push origin main/)).toBeTruthy()
    expect(getByText('Do you want to proceed?')).toBeTruthy()
  })

  it('renders a single option correctly', async () => {
    const block: QuestionBlock = {
      source: 'structured',
      toolUseId: 't2',
      questions: [{ question: 'Confirm?', multiSelect: false, options: [{ label: 'Yes' }] }],
    }
    const { getByText } = await render(<QuestionCard block={block} onSelect={jest.fn()} />)
    expect(getByText('Confirm?')).toBeTruthy()
    expect(getByText('Yes')).toBeTruthy()
  })

  it('does not render a Cancel button when onCancel is not provided', async () => {
    const { queryByText } = await render(<QuestionCard block={BASE_BLOCK} onSelect={jest.fn()} />)
    expect(queryByText('Cancel')).toBeNull()
  })

  it('renders a Cancel button when onCancel is provided', async () => {
    const { getByText } = await render(
      <QuestionCard block={BASE_BLOCK} onSelect={jest.fn()} onCancel={jest.fn()} />
    )
    expect(getByText('Cancel')).toBeTruthy()
  })

  it('calls onCancel when the Cancel button is pressed', async () => {
    const onCancel = jest.fn()
    const { getByText } = await render(
      <QuestionCard block={BASE_BLOCK} onSelect={jest.fn()} onCancel={onCancel} />
    )
    await fireEvent.press(getByText('Cancel'))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})

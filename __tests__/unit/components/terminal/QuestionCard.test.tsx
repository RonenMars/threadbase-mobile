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

  // The card holds its slot in the tree, so the next prompt re-renders this
  // same instance rather than mounting a fresh one — the previous answer's
  // highlight used to ride along onto a question it was never given for.
  it('drops the previous prompt selection when a new prompt arrives', async () => {
    const { getAllByRole, getByText, rerender } = await render(
      <QuestionCard block={BASE_BLOCK} onSelect={jest.fn()} />
    )
    await fireEvent.press(getAllByRole('button')[1])
    expect(getByText('indicator only')).toHaveStyle({ fontWeight: '500' })

    const next: QuestionBlock = {
      ...BASE_BLOCK,
      questions: [{
        ...BASE_BLOCK.questions[0],
        question: 'Do you want to proceed?',
        options: [{ label: 'Yes' }, { label: 'Yes, and don’t ask again' }, { label: 'No' }],
      }],
    }
    await rerender(<QuestionCard block={next} onSelect={jest.fn()} />)
    expect(getByText('Yes, and don’t ask again')).not.toHaveStyle({ fontWeight: '500' })
  })

  // The streamer re-broadcasts a gate whenever the terminal cursor moves, which
  // is a brand-new block object holding the same prompt. That must not read as
  // a new prompt and undo the tap the user already made.
  it('keeps the selection when the same prompt repaints', async () => {
    const gate: QuestionBlock = {
      source: 'permission',
      questions: [{
        question: 'Do you want to proceed?',
        multiSelect: false,
        options: [{ label: 'Yes' }, { label: 'No' }],
      }],
      permissionIndices: [1, 2],
      selectedIndex: 0,
    }
    const { getAllByRole, getByText, rerender } = await render(
      <QuestionCard block={gate} onSelect={jest.fn()} />
    )
    await fireEvent.press(getAllByRole('button')[1])
    expect(getByText('No')).toHaveStyle({ fontWeight: '500' })

    await rerender(<QuestionCard block={{ ...gate, selectedIndex: 1 }} onSelect={jest.fn()} />)
    expect(getByText('No')).toHaveStyle({ fontWeight: '500' })
  })
})

import React from 'react'
import { render, fireEvent } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import * as Haptics from 'expo-haptics'
import { QuestionCard } from '@/components/terminal/QuestionCard'
import { mapPermissionToBlock } from '@/utils/mapPermissionToBlock'
import type { QuestionBlock } from '@/utils/parseQuestionBlock'
import { THEMES, type Theme } from '@/constants/theme'

const mockTheme: { current: Theme } = { current: THEMES.dark }

jest.mock('@/contexts/ThemeContext', () => ({
  useTheme: () => mockTheme.current,
}))

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

  // The streamer answers a multi-select question with a toggle sequence for the
  // chosen labels, so the card collects several options and submits them once.
  describe('a multi-select structured question', () => {
    const MULTI_BLOCK: QuestionBlock = {
      ...BASE_BLOCK,
      questions: [{ ...BASE_BLOCK.questions[0], multiSelect: true }],
    }
    const renderMulti = async (props: Partial<React.ComponentProps<typeof QuestionCard>> = {}) => {
      const onSelect = jest.fn()
      const onSubmitMulti = jest.fn()
      const utils = await render(<QuestionCard block={MULTI_BLOCK} onSelect={onSelect} onSubmitMulti={onSubmitMulti} {...props} />)
      return { onSelect, onSubmitMulti, ...utils }
    }

    it('renders one unchecked checkbox per option', async () => {
      const { getAllByRole } = await renderMulti()
      const boxes = getAllByRole('checkbox')
      expect(boxes).toHaveLength(optionLabels.length)
      for (const box of boxes) expect(box).not.toBeChecked()
    })

    it('toggles an option on and off without answering', async () => {
      const { getAllByRole, onSelect, onSubmitMulti } = await renderMulti()
      await fireEvent.press(getAllByRole('checkbox')[1])
      expect(getAllByRole('checkbox')[1]).toBeChecked()
      await fireEvent.press(getAllByRole('checkbox')[1])
      expect(getAllByRole('checkbox')[1]).not.toBeChecked()
      expect(onSelect).not.toHaveBeenCalled()
      expect(onSubmitMulti).not.toHaveBeenCalled()
    })

    it('disables Submit until something is chosen', async () => {
      const { getByRole, getAllByRole, onSubmitMulti } = await renderMulti()
      expect(getByRole('button', { name: 'Submit' })).toBeDisabled()
      await fireEvent.press(getByRole('button', { name: 'Submit' }))
      expect(onSubmitMulti).not.toHaveBeenCalled()
      await fireEvent.press(getAllByRole('checkbox')[0])
      expect(getByRole('button', { name: 'Submit' })).toBeEnabled()
    })

    it('submits every chosen option once, in on-screen order', async () => {
      const { getByRole, getAllByRole, onSubmitMulti, onSelect } = await renderMulti()
      await fireEvent.press(getAllByRole('checkbox')[3])
      await fireEvent.press(getAllByRole('checkbox')[0])
      await fireEvent.press(getAllByRole('checkbox')[2])
      await fireEvent.press(getAllByRole('checkbox')[2])
      await fireEvent.press(getByRole('button', { name: 'Submit' }))
      expect(onSubmitMulti).toHaveBeenCalledTimes(1)
      expect(onSubmitMulti).toHaveBeenCalledWith(0, [0, 3])
      expect(onSelect).not.toHaveBeenCalled()
    })

    it('keeps the choices after submitting so a refused answer can be retried', async () => {
      const { getByRole, getAllByRole } = await renderMulti()
      await fireEvent.press(getAllByRole('checkbox')[1])
      await fireEvent.press(getByRole('button', { name: 'Submit' }))
      expect(getAllByRole('checkbox')[1]).toBeChecked()
    })

    it.each([['busy'], ['ghost']] as const)('locks the rows and Submit while %s', async (flag) => {
      const { getByRole, getAllByRole, onSubmitMulti } = await renderMulti({ [flag]: true })
      await fireEvent.press(getAllByRole('checkbox')[0])
      expect(getAllByRole('checkbox')[0]).not.toBeChecked()
      expect(getByRole('button', { name: 'Submit' })).toBeDisabled()
      await fireEvent.press(getByRole('button', { name: 'Submit' }))
      expect(onSubmitMulti).not.toHaveBeenCalled()
    })

    it('disables Submit once a pending answer locks a card that already has choices', async () => {
      const { getByRole, getAllByRole, rerender, onSelect, onSubmitMulti } = await renderMulti()
      await fireEvent.press(getAllByRole('checkbox')[0])
      await rerender(<QuestionCard block={MULTI_BLOCK} onSelect={onSelect} onSubmitMulti={onSubmitMulti} busy />)
      expect(getByRole('button', { name: 'Submit' })).toBeDisabled()
      await fireEvent.press(getByRole('button', { name: 'Submit' }))
      expect(onSubmitMulti).not.toHaveBeenCalled()
    })

    it('does not offer the terminal-only escape rows a screen-read card appends', async () => {
      const screenRead: QuestionBlock = {
        ...MULTI_BLOCK,
        questions: [{
          ...MULTI_BLOCK.questions[0],
          options: [{ label: 'Alpha' }, { label: 'Beta' }, { label: 'Type something.' }, { label: 'Chat about this' }],
        }],
      }
      const { getAllByRole, queryByText, getByRole, onSubmitMulti } = await renderMulti({ block: screenRead })
      expect(getAllByRole('checkbox')).toHaveLength(2)
      expect(queryByText('Type something.')).toBeNull()
      expect(queryByText('Chat about this')).toBeNull()
      await fireEvent.press(getAllByRole('checkbox')[1])
      await fireEvent.press(getByRole('button', { name: 'Submit' }))
      expect(onSubmitMulti).toHaveBeenCalledWith(0, [1])
    })

    it('drops the choices when the next prompt arrives', async () => {
      const { getAllByRole, getByRole, rerender } = await renderMulti()
      await fireEvent.press(getAllByRole('checkbox')[0])
      const next: QuestionBlock = {
        ...MULTI_BLOCK,
        questions: [{ ...MULTI_BLOCK.questions[0], question: 'Which others?', options: [{ label: 'X' }, { label: 'Y' }] }],
      }
      await rerender(<QuestionCard block={next} onSelect={jest.fn()} onSubmitMulti={jest.fn()} />)
      for (const box of getAllByRole('checkbox')) expect(box).not.toBeChecked()
      expect(getByRole('button', { name: 'Submit' })).toBeDisabled()
    })

    it('keeps the Cancel button working', async () => {
      const onCancel = jest.fn()
      const { getByText } = await renderMulti({ onCancel })
      await fireEvent.press(getByText('Cancel'))
      expect(onCancel).toHaveBeenCalledTimes(1)
    })

    it('shows no terminal line when the form is answerable', async () => {
      const { queryByTestId } = await renderMulti()
      expect(queryByTestId('question-card-unsupported')).toBeNull()
    })

    // The screen could not read the checkbox marker, so the streamer refuses
    // the answer (unsupported_prompt_shape): offering a form would only fail.
    it('stays read-only with the terminal line when the checkbox marker was unreadable', async () => {
      const unverified: QuestionBlock = {
        ...MULTI_BLOCK,
        questions: [{ ...MULTI_BLOCK.questions[0], multiSelectUnverified: true }],
      }
      const { queryAllByRole, queryByText, getByText, getByTestId, onSelect, onSubmitMulti } = await renderMulti({ block: unverified })
      expect(queryAllByRole('checkbox')).toHaveLength(0)
      expect(queryAllByRole('button')).toHaveLength(0)
      expect(queryByText('Submit')).toBeNull()
      expect(getByTestId('question-card-unsupported')).toBeTruthy()
      await fireEvent.press(getByText('indicator only'))
      expect(onSelect).not.toHaveBeenCalled()
      expect(onSubmitMulti).not.toHaveBeenCalled()
    })

    it('leaves a single-select structured question answerable on the first tap, with no checkboxes or Submit', async () => {
      const onSelect = jest.fn()
      const { getAllByRole, queryAllByRole, queryByText } = await render(<QuestionCard block={BASE_BLOCK} onSelect={onSelect} onSubmitMulti={jest.fn()} />)
      expect(queryAllByRole('checkbox')).toHaveLength(0)
      expect(queryByText('Submit')).toBeNull()
      await fireEvent.press(getAllByRole('button')[1])
      expect(onSelect).toHaveBeenCalledWith(0, 1)
    })

    it('does not apply to a permission gate that carries multiSelect', async () => {
      const gate: QuestionBlock = { source: 'permission', permissionIndices: [1, 2], questions: [{ question: 'Proceed?', multiSelect: true, options: [{ label: 'Yes' }, { label: 'No' }] }] }
      const onSelect = jest.fn()
      const { getAllByRole, queryAllByRole } = await render(<QuestionCard block={gate} onSelect={onSelect} onSubmitMulti={jest.fn()} />)
      expect(queryAllByRole('checkbox')).toHaveLength(0)
      await fireEvent.press(getAllByRole('button')[0])
      expect(onSelect).toHaveBeenCalledWith(0, 0)
    })

    it('keeps an unsupported multi-select prompt card fail-closed', async () => {
      const prompt: QuestionBlock = { source: 'prompt', unsupportedShape: 'multi', questions: [{ question: 'Pick?', multiSelect: true, options: [] }] }
      const { queryAllByRole, getByTestId } = await render(<QuestionCard block={prompt} onSelect={jest.fn()} onSubmitMulti={jest.fn()} />)
      expect(queryAllByRole('checkbox')).toHaveLength(0)
      expect(getByTestId('question-card-unsupported')).toBeTruthy()
    })
  })

  // The card holds its slot in the tree, so the next prompt re-renders this
  // same instance rather than mounting a fresh one — the previous answer's
  // highlight used to ride along onto a question it was never given for.
  it('drops the previous prompt selection when a new prompt arrives', async () => {
    const { getAllByRole, getByText, rerender } = await render(
      <QuestionCard block={BASE_BLOCK} onSelect={jest.fn()} />
    )
    await fireEvent.press(getAllByRole('button')[1])
    expect(getByText('indicator only')).toHaveStyle({ fontWeight: '700' })

    const next: QuestionBlock = {
      ...BASE_BLOCK,
      questions: [{
        ...BASE_BLOCK.questions[0],
        question: 'Do you want to proceed?',
        options: [{ label: 'Yes' }, { label: 'Yes, and don’t ask again' }, { label: 'No' }],
      }],
    }
    await rerender(<QuestionCard block={next} onSelect={jest.fn()} />)
    expect(getByText('Yes, and don’t ask again')).not.toHaveStyle({ fontWeight: '700' })
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
    expect(getByText('No')).toHaveStyle({ fontWeight: '700' })

    await rerender(<QuestionCard block={{ ...gate, selectedIndex: 1 }} onSelect={jest.fn()} />)
    expect(getByText('No')).toHaveStyle({ fontWeight: '700' })
  })
  describe('a permission gate that names its cursor row', () => {
    const gate = mapPermissionToBlock(
      'Do you trust the files in this folder?',
      [{ index: 1, label: 'Yes, I trust this folder' }, { index: 2, label: 'No, exit' }],
      2
    )

    it('shows the cursor row as selected before any tap', async () => {
      const { getAllByRole } = await render(<QuestionCard block={gate} onSelect={jest.fn()} />)
      const rows = getAllByRole('button')
      expect(rows[1].props.accessibilityState).toEqual(expect.objectContaining({ selected: true }))
      expect(rows[0].props.accessibilityState).toEqual(expect.objectContaining({ selected: false }))
    })

    it('still sends the tapped row, not the cursor row', async () => {
      const onSelect = jest.fn()
      const { getAllByRole } = await render(<QuestionCard block={gate} onSelect={onSelect} />)
      await fireEvent.press(getAllByRole('button')[0])
      expect(onSelect).toHaveBeenCalledWith(0, 0)
    })

    it('lets a tap replace the cursor row and keeps it through a repaint that moves the cursor', async () => {
      const three = mapPermissionToBlock(
        'Allow this command?',
        [{ index: 1, label: 'Yes' }, { index: 2, label: 'Yes, always' }, { index: 3, label: 'No' }],
        2
      )
      const { getAllByRole, rerender } = await render(<QuestionCard block={three} onSelect={jest.fn()} />)
      await fireEvent.press(getAllByRole('button')[0])
      await rerender(<QuestionCard block={{ ...three, selectedIndex: 2 }} onSelect={jest.fn()} />)
      const rows = getAllByRole('button')
      expect(rows[0].props.accessibilityState).toEqual(expect.objectContaining({ selected: true }))
      expect(rows[2].props.accessibilityState).toEqual(expect.objectContaining({ selected: false }))
    })

    it('seeds the cursor row again for a different prompt', async () => {
      const next = mapPermissionToBlock('Allow this command?', [{ index: 1, label: 'Yes' }, { index: 2, label: 'No' }], 1)
      const { getAllByRole, rerender } = await render(<QuestionCard block={gate} onSelect={jest.fn()} />)
      await fireEvent.press(getAllByRole('button')[0])
      await rerender(<QuestionCard block={next} onSelect={jest.fn()} />)
      expect(getAllByRole('button')[0].props.accessibilityState).toEqual(expect.objectContaining({ selected: true }))
    })
  })

  // A row only cancels a travelling touch once Pressability has measured its
  // responder region, and that measure is async — under test it never resolves,
  // which is exactly the device case this guard exists for: `onResponderMove`
  // early-returns on the null region and the lift commits the answer whatever
  // distance the finger covered. Drive the responder handlers directly so the
  // press runs through that unmeasured path rather than through fireEvent.press.
  describe('a touch that travels does not answer', () => {
    function touchAt(pageY: number) {
      return {
        nativeEvent: {
          pageY,
          pageX: 20,
          locationX: 20,
          locationY: 10,
          identifier: 1,
          target: 1,
          timestamp: Date.now(),
          touches: [],
          changedTouches: [],
        },
        dispatchConfig: { registrationName: 'onResponderGrant' },
        persist: () => {},
        currentTarget: 1,
        target: 1,
      }
    }

    async function dragOnFirstOption(fromY: number, toY: number, onSelect: jest.Mock) {
      const { getAllByRole } = await render(<QuestionCard block={BASE_BLOCK} onSelect={onSelect} />)
      const row = getAllByRole('button')[0]
      await fireEvent(row, 'responderGrant', touchAt(fromY))
      await fireEvent(row, 'responderMove', touchAt(toY))
      await fireEvent(row, 'responderRelease', touchAt(toY))
    }

    it('answers when the finger barely moves', async () => {
      const onSelect = jest.fn()
      await dragOnFirstOption(400, 404, onSelect)
      expect(onSelect).toHaveBeenCalledWith(0, 0)
    })

    it('does not answer when the finger is dragged down the card', async () => {
      const onSelect = jest.fn()
      await dragOnFirstOption(400, 490, onSelect)
      expect(onSelect).not.toHaveBeenCalled()
    })
  })
})

describe('QuestionCard theming', () => {
  afterEach(() => {
    mockTheme.current = THEMES.dark
  })

  it.each(Object.entries(THEMES))('follows the %s palette', async (_id, theme) => {
    mockTheme.current = theme
    const { getByTestId, getByText } = await render(<QuestionCard block={BASE_BLOCK} onSelect={jest.fn()} />)

    const container = StyleSheet.flatten(getByTestId('question-card').props.style)
    expect(container.backgroundColor).toBe(theme.bg.primary)
    expect(container.borderTopColor).toBe(theme.bg.card)
    expect(StyleSheet.flatten(getByText('Add fallback to ConversationCache?').props.style).color).toBe(theme.text.primary)
    expect(StyleSheet.flatten(getByText('Fallback').props.style).color).toBe(theme.text.accent)
  })
})

import React from 'react'
import { render, fireEvent } from '@testing-library/react-native'
import { ToolCard } from '@/components/conversation/ToolCard'
import type { MessageContent } from '@/types/api'

type ToolUse = Extract<MessageContent, { type: 'tool_use' }>
type ToolResult = Extract<MessageContent, { type: 'tool_result' }>

const bashUse: ToolUse = { type: 'tool_use', name: 'Bash', input: { command: 'ls -la' } }
const bashResult: ToolResult = { type: 'tool_result', toolName: 'Bash', content: 'total 8\ndrwxr-xr-x 5 user group' }
const bashError: ToolResult = { type: 'tool_result', toolName: 'Bash', content: 'command not found', isError: true }
const emptyResult: ToolResult = { type: 'tool_result', toolName: 'Read', content: '' }

describe('ToolCard – tool names and icons', () => {
  const iconMap: [string, string][] = [
    ['Edit', '✏️'],
    ['Bash', '💻'],
    ['Read', '👁'],
    ['Write', '🖊'],
    ['Glob', '🔍'],
    ['Grep', '🔎'],
  ]

  test.each(iconMap)('shows "%s" icon for tool "%s"', async (name, icon) => {
    const block: ToolUse = { type: 'tool_use', name, input: {} }
    const { getByText } = await render(<ToolCard block={block} />)
    expect(getByText(icon)).toBeTruthy()
  })

  it('shows default 🔧 icon for unknown tools', async () => {
    const block: ToolUse = { type: 'tool_use', name: 'Agent', input: {} }
    const { getByText } = await render(<ToolCard block={block} />)
    expect(getByText('🔧')).toBeTruthy()
  })

  it('renders tool name', async () => {
    const { getByText } = await render(<ToolCard block={bashUse} />)
    expect(getByText('Bash')).toBeTruthy()
  })

  it('renders toolName from tool_result', async () => {
    const { getByText } = await render(<ToolCard block={bashResult} />)
    expect(getByText('Bash')).toBeTruthy()
  })
})

describe('ToolCard – error state', () => {
  it('shows Error badge for tool_result with isError', async () => {
    const { getByText } = await render(<ToolCard block={bashError} />)
    expect(getByText('Error')).toBeTruthy()
  })

  it('does not show Error badge for normal results', async () => {
    const { queryByText } = await render(<ToolCard block={bashResult} />)
    expect(queryByText('Error')).toBeNull()
  })
})

describe('ToolCard – expand / collapse', () => {
  it('shows chevron when there is content', async () => {
    const { getByText } = await render(<ToolCard block={bashResult} />)
    expect(getByText('▼')).toBeTruthy()
  })

  it('does not show chevron when content is empty', async () => {
    const { queryByText } = await render(<ToolCard block={emptyResult} />)
    expect(queryByText('▼')).toBeNull()
    expect(queryByText('▲')).toBeNull()
  })

  it('expands to show tool_result content on press', async () => {
    const { getByRole, getByText, queryByText } = await render(<ToolCard block={bashResult} />)
    expect(queryByText(/total 8/)).toBeNull()
    await fireEvent.press(getByRole('button'))
    expect(getByText('total 8\ndrwxr-xr-x 5 user group')).toBeTruthy()
  })

  it('expands to show JSON input for tool_use', async () => {
    const { getByRole, getByText } = await render(<ToolCard block={bashUse} />)
    await fireEvent.press(getByRole('button'))
    expect(getByText(JSON.stringify({ command: 'ls -la' }, null, 2))).toBeTruthy()
  })

  it('toggles chevron from ▼ to ▲ on expand', async () => {
    const { getByRole, getByText } = await render(<ToolCard block={bashResult} />)
    expect(getByText('▼')).toBeTruthy()
    await fireEvent.press(getByRole('button'))
    expect(getByText('▲')).toBeTruthy()
  })

  it('does not expand when content is empty', async () => {
    const { queryByText, toJSON } = await render(<ToolCard block={emptyResult} />)
    // No expandable content – component should still render
    expect(queryByText('Read')).toBeTruthy()
    expect(toJSON()).not.toBeNull()
  })
})

describe('ToolCard – accessibility', () => {
  it('has role=button', async () => {
    const { getByRole } = await render(<ToolCard block={bashUse} />)
    expect(getByRole('button')).toBeTruthy()
  })

  it('accessibility label includes tool name', async () => {
    const { getByLabelText } = await render(<ToolCard block={bashUse} />)
    expect(getByLabelText('Bash tool expand')).toBeTruthy()
  })
})

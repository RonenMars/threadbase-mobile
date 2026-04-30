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

  test.each(iconMap)('shows "%s" icon for tool "%s"', (name, icon) => {
    const block: ToolUse = { type: 'tool_use', name, input: {} }
    const { getByText } = render(<ToolCard block={block} />)
    expect(getByText(icon)).toBeTruthy()
  })

  it('shows default 🔧 icon for unknown tools', () => {
    const block: ToolUse = { type: 'tool_use', name: 'Agent', input: {} }
    const { getByText } = render(<ToolCard block={block} />)
    expect(getByText('🔧')).toBeTruthy()
  })

  it('renders tool name', () => {
    const { getByText } = render(<ToolCard block={bashUse} />)
    expect(getByText('Bash')).toBeTruthy()
  })

  it('renders toolName from tool_result', () => {
    const { getByText } = render(<ToolCard block={bashResult} />)
    expect(getByText('Bash')).toBeTruthy()
  })
})

describe('ToolCard – error state', () => {
  it('shows Error badge for tool_result with isError', () => {
    const { getByText } = render(<ToolCard block={bashError} />)
    expect(getByText('Error')).toBeTruthy()
  })

  it('does not show Error badge for normal results', () => {
    const { queryByText } = render(<ToolCard block={bashResult} />)
    expect(queryByText('Error')).toBeNull()
  })
})

describe('ToolCard – expand / collapse', () => {
  it('shows chevron when there is content', () => {
    const { getByText } = render(<ToolCard block={bashResult} />)
    expect(getByText('▼')).toBeTruthy()
  })

  it('does not show chevron when content is empty', () => {
    const { queryByText } = render(<ToolCard block={emptyResult} />)
    expect(queryByText('▼')).toBeNull()
    expect(queryByText('▲')).toBeNull()
  })

  it('expands to show tool_result content on press', () => {
    const { getByRole, getByText, queryByText } = render(<ToolCard block={bashResult} />)
    expect(queryByText(/total 8/)).toBeNull()
    fireEvent.press(getByRole('button'))
    expect(getByText('total 8\ndrwxr-xr-x 5 user group')).toBeTruthy()
  })

  it('expands to show JSON input for tool_use', () => {
    const { getByRole, getByText } = render(<ToolCard block={bashUse} />)
    fireEvent.press(getByRole('button'))
    expect(getByText(JSON.stringify({ command: 'ls -la' }, null, 2))).toBeTruthy()
  })

  it('toggles chevron from ▼ to ▲ on expand', () => {
    const { getByRole, getByText } = render(<ToolCard block={bashResult} />)
    expect(getByText('▼')).toBeTruthy()
    fireEvent.press(getByRole('button'))
    expect(getByText('▲')).toBeTruthy()
  })

  it('does not expand when content is empty', () => {
    const { queryByText, toJSON } = render(<ToolCard block={emptyResult} />)
    // No expandable content – component should still render
    expect(queryByText('Read')).toBeTruthy()
    expect(toJSON()).not.toBeNull()
  })
})

describe('ToolCard – accessibility', () => {
  it('has role=button', () => {
    const { getByRole } = render(<ToolCard block={bashUse} />)
    expect(getByRole('button')).toBeTruthy()
  })

  it('accessibility label includes tool name', () => {
    const { getByLabelText } = render(<ToolCard block={bashUse} />)
    expect(getByLabelText('Bash tool expand')).toBeTruthy()
  })
})

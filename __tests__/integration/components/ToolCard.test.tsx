import React from 'react'
import { render, fireEvent } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import { ToolCard } from '@/components/conversation/ToolCard'
import type { MessageContent } from '@/types/api'

type ToolUse = Extract<MessageContent, { type: 'tool_use' }>
type ToolResult = Extract<MessageContent, { type: 'tool_result' }>

const bashUse: ToolUse = { type: 'tool_use', name: 'Bash', input: { command: 'ls -la' } }
const bashResult: ToolResult = { type: 'tool_result', toolName: 'Bash', content: 'total 8\ndrwxr-xr-x 5 user group' }
const bashError: ToolResult = { type: 'tool_result', toolName: 'Bash', content: 'command not found', isError: true }
const emptyResult: ToolResult = { type: 'tool_result', toolName: 'Read', content: '' }

// Render each Phosphor icon as its name so a test can tell which one a tool got.
jest.mock('phosphor-react-native', () => {
  const { Text } = jest.requireActual('react-native')
  const names = [
    'Eye', 'FilePlus', 'Files', 'Globe', 'Image', 'ListChecks',
    'MagnifyingGlass', 'PencilSimple', 'Plug', 'Robot', 'Terminal', 'Wrench',
  ]
  return Object.fromEntries(names.map((n) => [n, () => <Text>{`icon:${n}`}</Text>]))
})

describe('ToolCard – tool names and icons', () => {
  const iconMap: [string, string][] = [
    ['Edit', 'PencilSimple'],
    ['Bash', 'Terminal'],
    ['Read', 'Eye'],
    ['Write', 'FilePlus'],
    ['Glob', 'Files'],
    ['Grep', 'MagnifyingGlass'],
    ['exec_command', 'Terminal'],
    ['Shell', 'Terminal'],
    ['StrReplace', 'PencilSimple'],
    ['apply_patch', 'PencilSimple'],
    ['web_search', 'Globe'],
    ['CallMcpTool', 'Plug'],
    ['spawn_agent', 'Robot'],
  ]

  test.each(iconMap)('shows the icon for tool "%s"', async (name, icon) => {
    const block: ToolUse = { type: 'tool_use', name, input: {} }
    const { getByText } = await render(<ToolCard block={block} />)
    expect(getByText(`icon:${icon}`)).toBeTruthy()
  })

  it('shows the default icon for unknown tools', async () => {
    const block: ToolUse = { type: 'tool_use', name: 'Agent', input: {} }
    const { getByText } = await render(<ToolCard block={block} />)
    expect(getByText('icon:Wrench')).toBeTruthy()
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

describe('ToolCard – search highlight', () => {
  it('force-opens and highlights a match inside a collapsed tool_result body', async () => {
    // Collapsed by default; the needle only appears in the body.
    const { getByText } = await render(<ToolCard block={bashResult} highlight="drwxr" activeMatch />)
    const match = getByText('drwxr')
    expect(StyleSheet.flatten(match.props.style)).toEqual(
      expect.objectContaining({ backgroundColor: expect.any(String) }),
    )
    // Chevron reflects the forced-open state.
    expect(getByText('▲')).toBeTruthy()
  })

  it('highlights a match inside a tool_use JSON body', async () => {
    const { getAllByText } = await render(<ToolCard block={bashUse} highlight="ls -la" activeMatch />)
    // The header summary shows the command too; the body's match renders last.
    const match = getAllByText('ls -la').at(-1)!
    expect(StyleSheet.flatten(match.props.style)).toEqual(
      expect.objectContaining({ backgroundColor: expect.any(String) }),
    )
  })

  it('stays collapsed when the needle is absent from the body', async () => {
    const { queryByText } = await render(<ToolCard block={bashResult} highlight="nonexistent" activeMatch />)
    expect(queryByText(/total 8/)).toBeNull()
    expect(queryByText('▼')).toBeTruthy()
  })

  it('stays collapsed with no highlight prop', async () => {
    const { queryByText } = await render(<ToolCard block={bashResult} />)
    expect(queryByText(/total 8/)).toBeNull()
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

describe('ToolCard – Codex and Cursor inputs', () => {
  const summaries: [string, Record<string, unknown>, string][] = [
    ['exec_command', { cmd: 'npm run typecheck', workdir: '/Users/dev/tb-mobile', justification: 'verify' }, 'npm run typecheck'],
    ['Shell', { command: 'git status --short', description: 'Check tree' }, 'git status --short'],
    ['Read', { path: 'components/conversation/ToolCard.tsx', limit: 200 }, 'components/conversation/ToolCard.tsx'],
    ['Grep', { pattern: 'resolveToolName', glob: '**/*.ts' }, 'resolveToolName'],
    ['CallMcpTool', { server: 'github', toolName: 'list_pull_requests', arguments: { state: 'open' } }, 'github · list_pull_requests'],
  ]

  test.each(summaries)('summarises %s in the collapsed header', async (name, input, summary) => {
    const { getByText } = await render(<ToolCard block={{ type: 'tool_use', name, input }} />)
    expect(getByText(summary)).toBeTruthy()
  })

  it('renders exec input as source text, not a JSON-escaped string', async () => {
    const source = 'const r = await tools.exec_command({ cmd: "ls" })\nconsole.log(r.output)'
    const { getByText, getByLabelText } = await render(
      <ToolCard block={{ type: 'tool_use', name: 'exec', input: { input: source } }} />,
    )
    await fireEvent.press(getByLabelText('exec tool expand'))
    expect(getByText(source)).toBeTruthy()
  })

  it('falls back to JSON for an unknown tool', async () => {
    const input = { foo: 'bar' }
    const { getByText, getByLabelText } = await render(
      <ToolCard block={{ type: 'tool_use', name: 'SomethingNew', input }} />,
    )
    await fireEvent.press(getByLabelText('SomethingNew tool expand'))
    expect(getByText(JSON.stringify(input, null, 2))).toBeTruthy()
  })

  it('labels an unnamed live result with the fallback', async () => {
    const { getByText } = await render(<ToolCard block={{ type: 'tool_result', toolName: '', content: 'ok' }} />)
    expect(getByText('Tool')).toBeTruthy()
  })
})

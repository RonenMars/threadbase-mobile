import { render } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import React from 'react'
import { DiffViewer } from '@/components/conversation/DiffViewer'
import { THEMES, type Theme } from '@/constants/theme'

const mockTheme: { current: Theme } = { current: THEMES.dark }

jest.mock('@/contexts/ThemeContext', () => ({
  useTheme: () => mockTheme.current,
}))

const hunks = [
  {
    oldStart: 1,
    oldLines: 2,
    newStart: 1,
    newLines: 2,
    lines: [
      { type: 'context' as const, content: 'keep' },
      { type: 'addition' as const, content: 'added line' },
      { type: 'deletion' as const, content: 'removed line' },
    ],
  },
]

describe('DiffViewer theming', () => {
  it.each(Object.entries(THEMES))('follows the %s palette', async (_id, theme) => {
    mockTheme.current = theme
    const { getByLabelText, getByText } = await render(<DiffViewer filename="a.ts" hunks={hunks} />)

    const container = StyleSheet.flatten(getByLabelText('a.ts').props.style)
    expect(container.backgroundColor).toBe(theme.bg.primary)
    expect(container.borderColor).toBe(theme.border)

    const addedRow = StyleSheet.flatten(getByText('added line').parent?.props.style)
    const deletedRow = StyleSheet.flatten(getByText('removed line').parent?.props.style)
    expect(addedRow.backgroundColor).toBe(`${theme.status.running}33`)
    expect(deletedRow.backgroundColor).toBe(`${theme.status.failed}33`)
  })
})

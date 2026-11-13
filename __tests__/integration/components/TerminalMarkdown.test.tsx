import React from 'react'
import { StyleSheet } from 'react-native'
import { render } from '@testing-library/react-native'
import { TerminalMarkdown } from '@/components/terminal/TerminalMarkdown'
import { parseMarkdown } from '@/lib/markdown'

// Web Text defaults to CSS flex-shrink: 1 (only View pins 0), so without this
// the "1." marker squeezes below its width and the dot wraps to its own line.
it('keeps the list marker from shrinking', async () => {
  const { getByText } = await render(<TerminalMarkdown blocks={parseMarkdown('1. first')} />)
  expect(StyleSheet.flatten(getByText('1.').props.style).flexShrink).toBe(0)
})

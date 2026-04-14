import React from 'react'
import { render } from '@testing-library/react-native'
import { Badge } from '@/components/ui/Badge'

describe('Badge', () => {
  it('renders the label text', () => {
    const { getByText } = render(<Badge label="main" />)
    expect(getByText('main')).toBeTruthy()
  })

  it('renders with custom foreground colour', () => {
    const { getByText } = render(<Badge label="red-badge" color="#ff0000" />)
    const text = getByText('red-badge')
    // The style array contains an object with the custom colour
    const styles = Array.isArray(text.props.style) ? text.props.style : [text.props.style]
    const hasColor = styles.some((s: Record<string, unknown>) => s && s.color === '#ff0000')
    expect(hasColor).toBe(true)
  })

  it('renders with custom background colour', () => {
    const { getByText } = render(<Badge label="bg-test" bg="#123456" />)
    expect(getByText('bg-test')).toBeTruthy()
  })

  it('renders small size by default', () => {
    const { getByText } = render(<Badge label="sm" />)
    expect(getByText('sm')).toBeTruthy()
  })

  it('renders medium size when size="md"', () => {
    const { getByText } = render(<Badge label="md" size="md" />)
    expect(getByText('md')).toBeTruthy()
  })

  it('truncates long labels with numberOfLines', () => {
    const { getByText } = render(<Badge label="a-very-long-branch-name-that-exceeds-normal-display" />)
    const text = getByText('a-very-long-branch-name-that-exceeds-normal-display')
    expect(text.props.numberOfLines).toBe(1)
  })
})

import React from 'react'
import { Text } from 'react-native'
import { render } from '@testing-library/react-native'
import { Card } from '@/components/ui/Card'

describe('Card', () => {
  it('renders children', () => {
    const { getByText } = render(<Card><Text>hello</Text></Card>)
    expect(getByText('hello')).toBeTruthy()
  })

  it('applies warning variant class', () => {
    const { getByTestId } = render(
      <Card variant="warning" testID="card"><Text>x</Text></Card>
    )
    const card = getByTestId('card')
    expect(card.props.className).toContain('border-status-waiting')
  })

  it('applies danger variant class', () => {
    const { getByTestId } = render(
      <Card variant="danger" testID="card"><Text>x</Text></Card>
    )
    const card = getByTestId('card')
    expect(card.props.className).toContain('border-status-failed')
  })

  it('renders with default variant when variant prop is omitted', () => {
    const { getByTestId } = render(
      <Card testID="card"><Text>x</Text></Card>
    )
    expect(getByTestId('card')).toBeTruthy()
  })
})

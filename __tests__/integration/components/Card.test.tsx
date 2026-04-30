import React from 'react'
import { Text } from 'react-native'
import { render } from '@testing-library/react-native'
import { Card } from '@/components/ui/Card'

describe('Card', () => {
  it('renders children', () => {
    const { getByText } = render(<Card><Text>hello</Text></Card>)
    expect(getByText('hello')).toBeTruthy()
  })

  it('applies warning variant', () => {
    const { getByTestId } = render(
      <Card variant="warning" testID="card"><Text>x</Text></Card>
    )
    const card = getByTestId('card')
    expect(card.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ borderColor: '#d29922' }),
      ])
    )
  })
})

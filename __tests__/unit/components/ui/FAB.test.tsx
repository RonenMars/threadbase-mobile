import React from 'react'
import { StyleSheet } from 'react-native'
import { render, screen } from '@testing-library/react-native'
import { FAB } from '@/components/ui/FAB'

describe('FAB', () => {
  it('anchors to the physical right so RTL does not flip it to the left', async () => {
    await render(<FAB onPress={jest.fn()} />)
    const style = StyleSheet.flatten(screen.getByTestId('fab-new-session').props.style)
    expect(style).toEqual(expect.objectContaining({ position: 'absolute', right: 20 }))
    expect(style.end).toBeUndefined()
  })
})

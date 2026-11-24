import React from 'react'
import { PixelRatio } from 'react-native'
import { render, screen } from '@testing-library/react-native'
import { Star } from 'phosphor-react-native'

// patches/phosphor-react-native+3.0.6.patch scales every icon by the OS font scale, capped.
async function iconWidth(fontScale: number, size?: number): Promise<number | string | undefined> {
  jest.spyOn(PixelRatio, 'getFontScale').mockReturnValue(fontScale)
  await render(<Star size={size} weight="regular" />)
  return screen.getByTestId('phosphor-react-native-star-regular').props.width
}

describe('Phosphor icons follow the OS text size', () => {
  afterEach(() => jest.restoreAllMocks())

  it('keeps the designed size at the default text size', async () => {
    expect(await iconWidth(1, 20)).toBe(20)
  })

  it('grows with a larger text size', async () => {
    expect(await iconWidth(1.3, 20)).toBe(26)
  })

  it('stops growing at 1.5x', async () => {
    expect(await iconWidth(3.1, 20)).toBe(30)
  })

  it('never shrinks below the designed size', async () => {
    expect(await iconWidth(0.8, 20)).toBe(20)
  })

  it('scales the IconContext default size too', async () => {
    expect(await iconWidth(1.5)).toBe(36)
  })
})

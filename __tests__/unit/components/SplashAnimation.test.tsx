import { render } from '@testing-library/react-native'
import { StyleSheet, View } from 'react-native'

import { SplashAnimation } from '@/components/SplashAnimation'

describe('SplashAnimation', () => {
  it('keeps the logo animation ltr inside an rtl app layout', async () => {
    const screen = await render(
      <View style={{ direction: 'rtl' }}>
        <SplashAnimation onComplete={jest.fn()} />
      </View>,
    )
    const splash = screen.getByText('Threadbase').parent?.parent

    expect(StyleSheet.flatten(splash?.props.style)).toEqual(
      expect.objectContaining({ direction: 'ltr' }),
    )
  })
})

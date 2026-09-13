import { render, waitFor } from '@testing-library/react-native'
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

  it('fades a plain background without the logo on a returning launch', async () => {
    const onComplete = jest.fn()
    const screen = await render(<SplashAnimation variant="fade" onComplete={onComplete} />)

    expect(screen.queryByText('Threadbase')).toBeNull()
    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1))
  })

  it('holds a plain background without finishing while the variant is undecided', async () => {
    const onComplete = jest.fn()
    const screen = await render(<SplashAnimation variant="hold" onComplete={onComplete} />)

    expect(screen.queryByText('Threadbase')).toBeNull()
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(onComplete).not.toHaveBeenCalled()
  })
})

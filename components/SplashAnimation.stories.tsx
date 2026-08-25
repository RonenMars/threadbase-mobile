import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { View } from 'react-native'

import { SplashAnimation } from './SplashAnimation'

const meta: Meta<typeof SplashAnimation> = {
  title: 'SplashAnimation',
  component: SplashAnimation,
  decorators: [
    (Story) => (
      <View style={{ direction: 'rtl', flex: 1, minHeight: 700 }}>
        <Story />
      </View>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof SplashAnimation>

export const InsideRTLLayout: Story = {
  args: { onComplete: () => undefined },
}

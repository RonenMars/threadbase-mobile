import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { View } from 'react-native'
import { useSharedValue } from 'react-native-reanimated'
import { ShelfDismissTarget } from './ShelfDismissTarget'

function Preview({ armed }: { armed: boolean }) {
  const dragging = useSharedValue(1)
  const armedValue = useSharedValue(armed ? 1 : 0)
  return (
    <View style={{ width: 240, height: 160 }}>
      <ShelfDismissTarget dragging={dragging} armed={armedValue} centerX={120} centerY={80} reduceMotion={false} />
    </View>
  )
}

const meta: Meta<typeof Preview> = {
  title: 'shelf/ShelfDismissTarget',
  component: Preview,
}

export default meta
type Story = StoryObj<typeof Preview>

export const Idle: Story = { args: { armed: false } }

export const Armed: Story = { args: { armed: true } }

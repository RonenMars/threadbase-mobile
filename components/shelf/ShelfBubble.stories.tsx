import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { View } from 'react-native'
import { ShelfBubble } from './ShelfBubble'

const noop = () => {}

const meta: Meta<typeof ShelfBubble> = {
  title: 'shelf/ShelfBubble',
  component: ShelfBubble,
  args: {
    position: null,
    isRTL: false,
    reduceMotion: false,
    needsYouCount: 0,
    onOpen: noop,
    onToggleSave: noop,
    onSnap: noop,
  },
  decorators: [
    (Story) => (
      <View style={{ height: 640 }}>
        <Story />
      </View>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof ShelfBubble>

export const NothingNeedsYou: Story = {}

export const ThreeNeedYou: Story = {
  args: { needsYouCount: 3 },
}

export const OverNinetyNine: Story = {
  args: { needsYouCount: 120 },
}

export const RightToLeftDefault: Story = {
  args: { isRTL: true, needsYouCount: 2 },
}

export const MovedToLeftEdge: Story = {
  args: { position: { side: 'left', y: 0.6 } },
}

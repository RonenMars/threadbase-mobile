import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { View } from 'react-native'
import { ListBottomScrim } from './ListBottomScrim'

const meta: Meta<typeof ListBottomScrim> = {
  title: 'sessions/ListBottomScrim',
  component: ListBottomScrim,
  decorators: [
    (Story) => (
      <View style={{ height: 160, backgroundColor: '#30363d' }}>
        <Story />
      </View>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof ListBottomScrim>

export const Default: Story = {}

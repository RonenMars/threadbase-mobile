import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { fn } from 'storybook/test'
import { Text, View } from 'react-native'
import { PencilSimple, Power, Star, Trash } from 'phosphor-react-native'
import { SwipeableRow, type SwipeAction } from './SwipeableRow'

const leading: SwipeAction[] = [
  { key: 'favorite', label: 'Favorite', icon: Star, color: '#d29922', onPress: fn() },
]

const trailing: SwipeAction[] = [
  { key: 'rename', label: 'Rename', icon: PencilSimple, color: '#58a6ff', onPress: fn() },
  { key: 'terminate', label: 'Terminate', icon: Power, color: '#7d8590', onPress: fn() },
  { key: 'delete', label: 'Delete', icon: Trash, color: '#f85149', onPress: fn() },
]

const meta: Meta<typeof SwipeableRow> = {
  title: 'sessions/shared/SwipeableRow',
  component: SwipeableRow,
  decorators: [(Story) => <View style={{ padding: 16 }}><Story /></View>],
  args: {
    leading,
    trailing,
    children: (
      <View style={{ padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#30363d', backgroundColor: '#161b22' }}>
        <Text style={{ color: '#e6edf3', fontWeight: '600' }}>Swipe me either way</Text>
      </View>
    ),
  },
}

export default meta
type Story = StoryObj<typeof SwipeableRow>

export const Default: Story = {}

export const TrailingOnly: Story = { args: { leading: [] } }

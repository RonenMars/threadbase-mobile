import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { View, Text } from 'react-native'
import { BoardColumn } from './BoardColumn'

const Column = BoardColumn<string>

const meta: Meta<typeof Column> = {
  title: 'sessions/board/BoardColumn',
  component: Column,
  decorators: [
    (Story) => (
      <View style={{ padding: 16, width: 360, height: 420 }}>
        <Story />
      </View>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof Column>

export const WithCards: Story = {
  args: {
    label: 'Working',
    color: '#3fb950',
    items: ['first card', 'second card'],
    renderItem: (item) => <Text style={{ color: '#8b949e', paddingVertical: 8 }}>{item}</Text>,
    keyExtractor: (item) => item,
    total: 2,
    emptyLabel: 'Nothing here',
  },
}

export const Filtered: Story = {
  args: { ...WithCards.args, total: 7 },
}

export const Empty: Story = {
  args: { ...WithCards.args, label: 'Needs you', color: '#d29922', items: [], total: 0 },
}

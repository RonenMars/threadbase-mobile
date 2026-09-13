import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { View } from 'react-native'
import { GroupedNoiseRow } from './GroupedNoiseRow'

const meta: Meta<typeof GroupedNoiseRow> = {
  title: 'sessions/now/GroupedNoiseRow',
  component: GroupedNoiseRow,
  decorators: [
    (Story) => (
      <View style={{ padding: 16 }}>
        <Story />
      </View>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof GroupedNoiseRow>

export const Collapsed: Story = {
  args: { titles: ['hi', 'hey', 'Ahoy', 'Hello there'], expanded: false, onToggle: () => {} },
}

export const Expanded: Story = {
  args: { titles: ['hi', 'hey', 'Ahoy'], expanded: true, onToggle: () => {} },
}

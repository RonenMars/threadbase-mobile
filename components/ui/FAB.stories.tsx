import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { View } from 'react-native'
import { FAB } from './FAB'

const meta: Meta<typeof FAB> = {
  title: 'ui/FAB',
  component: FAB,
  decorators: [
    (Story) => (
      <View style={{ height: 160 }}>
        <Story />
      </View>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof FAB>

export const NewSession: Story = {
  args: { onPress: () => {} },
}

export const Hidden: Story = {
  args: { onPress: () => {}, hidden: true },
}

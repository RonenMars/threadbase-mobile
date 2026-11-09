import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { View } from 'react-native'
import { HeaderBrandMark } from './HeaderBrandMark'

const meta: Meta<typeof HeaderBrandMark> = {
  title: 'shared/HeaderBrandMark',
  component: HeaderBrandMark,
  decorators: [
    (Story) => (
      <View style={{ padding: 16, backgroundColor: '#0d1117' }}>
        <Story />
      </View>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof HeaderBrandMark>

export const Store: Story = {
  args: { qa: false },
}

export const Qa: Story = {
  args: { qa: true },
}

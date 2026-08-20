import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { fn } from 'storybook/test'
import { View } from 'react-native'
import { Banner } from './Banner'

const meta: Meta<typeof Banner> = {
  title: 'ui/Banner',
  component: Banner,
  decorators: [(Story) => <View style={{ minHeight: 320 }}><Story /></View>],
}

export default meta
type Story = StoryObj<typeof Banner>

export const TitleAndMessage: Story = {
  args: {
    title: 'Connection lost',
    message: 'The server stopped responding.',
    accent: '#f85149',
  },
}

export const WithPrimaryAction: Story = {
  args: {
    title: 'Connection lost',
    message: 'The server stopped responding.',
    accent: '#f85149',
    action: { label: 'Details', onPress: fn(), variant: 'primary' },
  },
}

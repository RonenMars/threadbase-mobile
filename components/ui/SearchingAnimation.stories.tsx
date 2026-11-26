import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { View } from 'react-native'
import { SearchingAnimation } from './SearchingAnimation'

const meta: Meta<typeof SearchingAnimation> = {
  title: 'ui/SearchingAnimation',
  component: SearchingAnimation,
  decorators: [(Story) => <View style={{ height: 320 }}><Story /></View>],
}

export default meta
type Story = StoryObj<typeof SearchingAnimation>

export const Default: Story = {}

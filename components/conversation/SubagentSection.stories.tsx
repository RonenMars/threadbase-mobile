import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { View } from 'react-native'
import { SubagentSection } from './SubagentSection'

const meta: Meta<typeof SubagentSection> = {
  title: 'conversation/SubagentSection',
  component: SubagentSection,
  decorators: [(Story) => <View style={{ paddingVertical: 16 }}><Story /></View>],
}

export default meta
type Story = StoryObj<typeof SubagentSection>

// Collapsed: no request is made until the header is tapped.
export const Collapsed: Story = { args: { serverId: 'story', parentId: 'parent-1' } }

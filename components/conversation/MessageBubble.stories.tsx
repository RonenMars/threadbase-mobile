import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { View } from 'react-native'
import { MessageBubble } from './MessageBubble'
import type { Message } from '@/types/api'

const userMessage: Message = {
  id: 'story-user',
  uuid: null,
  role: 'user',
  content: [{ type: 'text', text: 'Also rename the helper while you are in there.' }],
  timestamp: '',
  is_sidechain: false,
  parent_uuid: null,
}

const meta: Meta<typeof MessageBubble> = {
  title: 'conversation/MessageBubble',
  component: MessageBubble,
  decorators: [(Story) => <View style={{ padding: 16 }}><Story /></View>],
}

export default meta
type Story = StoryObj<typeof MessageBubble>

export const User: Story = {
  args: { message: userMessage },
}

export const Queued: Story = {
  args: { message: userMessage, queued: true },
}

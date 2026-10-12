import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { View } from 'react-native'
import { ConversationListItem } from './ConversationListItem'

const base = {
  title: 'Merge all green dependabot PRs, rebase between each',
  path: '/Users/me/dev/ai-tools/tb-mobile',
  branch: 'main',
  timestamp: new Date(Date.now() - 12 * 60_000).toISOString(),
  firstMessage: { text: 'Merge all green dependabot PRs, rebase between each' },
  lastMessage: { text: 'All six are merged; the seventh needs a rebase onto the new main.' },
  density: 'compact' as const,
  leading: 'dot' as const,
}

const meta: Meta<typeof ConversationListItem> = {
  title: 'sessions/shared/ConversationListItem',
  component: ConversationListItem,
  decorators: [
    (Story) => (
      <View style={{ padding: 16 }}>
        <Story />
      </View>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof ConversationListItem>

/** At 3 messages or fewer, `auto` previews the first message. */
export const ShortConversation: Story = {
  args: { ...base, messageCount: 3, previewMode: 'auto' },
}

/** Past 3 messages, `auto` switches to the last message. */
export const LongConversation: Story = {
  args: { ...base, messageCount: 42, previewMode: 'auto' },
}

export const WorkingSession: Story = {
  args: { ...base, messageCount: 42, tier: 'working', previewMode: 'auto' },
}

export const NoPreview: Story = {
  args: { ...base, messageCount: 42, previewMode: 'none' },
}

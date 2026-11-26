import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { View } from 'react-native'
import { useDraftsStore } from '@/stores/drafts'
import { SessionDraftMark } from './SessionDraftMark'

const meta: Meta<typeof SessionDraftMark> = {
  title: 'sessions/SessionDraftMark',
  component: SessionDraftMark,
  args: { serverId: 'story-server', sessionId: 'story-session' },
  decorators: [
    (Story, { args }) => {
      useDraftsStore.setState({ drafts: { [`${args.serverId}::${args.sessionId}`]: 'fix the flaky test' } })
      return (
        <View style={{ padding: 16 }}>
          <Story />
        </View>
      )
    },
  ],
}

export default meta
type Story = StoryObj<typeof SessionDraftMark>

export const WithDraft: Story = {}

export const WithoutDraft: Story = {
  args: { sessionId: 'session-without-draft' },
}

import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { View } from 'react-native'
import { useServersStore } from '@/stores/servers'
import { ExternalSessionNotifyToggle } from './ExternalSessionNotifyToggle'

// The toggle hides itself unless the server advertises push.subscriptions.
useServersStore.setState({
  servers: {
    'story-server': {
      id: 'story-server',
      url: 'http://localhost',
      apiKey: '',
      label: 'Story server',
      isConnected: true,
      serverInfo: {
        version: '1',
        machineName: 'story',
        platform: 'darwin',
        activeSessions: 1,
        push: { subscriptions: true },
      },
      connectionError: null,
    },
  },
})

const meta: Meta<typeof ExternalSessionNotifyToggle> = {
  title: 'sessions/ExternalSessionNotifyToggle',
  component: ExternalSessionNotifyToggle,
  decorators: [
    (Story) => (
      <View style={{ padding: 16 }}>
        <Story />
      </View>
    ),
  ],
  args: { serverId: 'story-server', conversationId: 'story-conversation' },
}

export default meta
type Story = StoryObj<typeof ExternalSessionNotifyToggle>

export const Default: Story = {}

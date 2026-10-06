import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { View } from 'react-native'
import { useServersStore } from '@/stores/servers'
import { ServerAddressesSection } from './ServerAddressesSection'

// Storybook mounts no WebSocket, so the live address always reads "Not connected".
function Seeded({ publicUrl, relayUrl, relayDisabled }: { publicUrl?: string; relayUrl?: string; relayDisabled?: boolean }) {
  useServersStore.setState({
    servers: {
      demo: {
        id: 'demo',
        url: 'http://192.0.2.10:8766',
        apiKey: 'demo-key',
        label: 'Studio',
        publicUrl,
        relayUrl,
        relayDisabled,
        // Only a pinned server dials publicUrl, so only one shows it.
        serverPublicKey: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        requireEncryption: true,
        isConnected: false,
        serverInfo: null,
        connectionError: null,
      },
    },
  })
  return <ServerAddressesSection serverId="demo" />
}

const meta: Meta<typeof Seeded> = {
  title: 'servers/ServerAddressesSection',
  component: Seeded,
  decorators: [
    (Story) => (
      <View style={{ padding: 16 }}>
        <Story />
      </View>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof Seeded>

export const TwoAddresses: Story = {
  args: { publicUrl: 'https://tb.example.com' },
}

export const WithRelay: Story = {
  args: { publicUrl: 'https://tb.example.com', relayUrl: 'https://relay.example.com/r/abcdefghijklmnopqrstuvwxyz012345' },
}

export const RelayOnlyTurnedOff: Story = {
  args: { relayUrl: 'https://relay.example.com/r/abcdefghijklmnopqrstuvwxyz012345', relayDisabled: true },
}

export const OneAddressRendersNothing: Story = {
  args: {},
}

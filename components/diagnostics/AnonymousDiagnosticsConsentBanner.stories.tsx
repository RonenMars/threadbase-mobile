import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { View } from 'react-native'
import { AnonymousDiagnosticsConsentBanner } from './AnonymousDiagnosticsConsentBanner'

const meta: Meta<typeof AnonymousDiagnosticsConsentBanner> = {
  title: 'diagnostics/AnonymousDiagnosticsConsentBanner',
  component: AnonymousDiagnosticsConsentBanner,
  decorators: [
    (Story) => (
      <View style={{ padding: 16 }}>
        <Story />
      </View>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof AnonymousDiagnosticsConsentBanner>

export const Visible: Story = {
  args: { forceVisible: true },
}

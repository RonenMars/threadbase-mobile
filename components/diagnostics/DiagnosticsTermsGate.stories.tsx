import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { View } from 'react-native'
import { DiagnosticsTermsGate } from './DiagnosticsTermsGate'

const meta: Meta<typeof DiagnosticsTermsGate> = {
  title: 'diagnostics/DiagnosticsTermsGate',
  component: DiagnosticsTermsGate,
  decorators: [
    (Story) => (
      <View style={{ height: 760 }}>
        <Story />
      </View>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof DiagnosticsTermsGate>

export const Standard: Story = {
  args: { forceVariant: 'standard' },
}

export const EnforcedTestBuild: Story = {
  args: { forceVariant: 'enforced' },
}

import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { View } from 'react-native'
import { InheritedHistoryDivider } from './InheritedHistoryDivider'

const meta: Meta<typeof InheritedHistoryDivider> = {
  title: 'conversation/InheritedHistoryDivider',
  component: InheritedHistoryDivider,
  decorators: [(Story) => <View style={{ padding: 16 }}><Story /></View>],
}

export default meta
type Story = StoryObj<typeof InheritedHistoryDivider>

export const ForkSeam: Story = {
  args: { seam: { kind: 'divider', beforeMessageIndex: 21, forkedAt: new Date().toISOString() } },
}

export const NoForkTime: Story = {
  args: { seam: { kind: 'divider', beforeMessageIndex: 21 } },
}

export const SourceUnavailable: Story = {
  args: { seam: { kind: 'unavailable' } },
}

import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { View } from 'react-native'
import { SectionEyebrow } from './SectionEyebrow'

const meta: Meta<typeof SectionEyebrow> = {
  title: 'sessions/now/SectionEyebrow',
  component: SectionEyebrow,
  decorators: [
    (Story) => (
      <View style={{ padding: 16 }}>
        <Story />
      </View>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof SectionEyebrow>

export const NeedsYou: Story = {
  args: { label: 'NEEDS YOU · 1', tone: 'needsYou' },
}

export const Working: Story = {
  args: { label: 'WORKING · 2', tone: 'working' },
}

export const EarlierToday: Story = {
  args: { label: 'EARLIER TODAY', tone: 'muted', count: 17 },
}

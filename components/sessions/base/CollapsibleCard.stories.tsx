import { Text } from 'react-native'
import { fn } from 'storybook/test'
import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { CollapsibleCard } from './CollapsibleCard'

const meta: Meta<typeof CollapsibleCard> = {
  title: 'Sessions/CollapsibleCard',
  component: CollapsibleCard,
  args: {
    id: 'p1',
    parentLabel: '~/dev/ai-tools',
    title: 'tb-mobile',
    activityLine: '2 active',
    count: 3,
    railColor: '#3b82f6',
    isOpen: true,
    onToggle: fn(),
    accessibilityLabel: 'tb-mobile',
    headerTestID: 'story-header',
    children: <Text>Body content</Text>,
  },
}
export default meta
type Story = StoryObj<typeof CollapsibleCard>

export const Open: Story = {}
export const Closed: Story = { args: { isOpen: false } }
export const NoRail: Story = { args: { railColor: null } }

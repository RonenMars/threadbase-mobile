import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { SubagentStatusBadge } from './SubagentStatusBadge'

const meta: Meta<typeof SubagentStatusBadge> = { title: 'Sessions/SubagentStatusBadge', component: SubagentStatusBadge }
export default meta
type Story = StoryObj<typeof SubagentStatusBadge>

export const Running: Story = { args: { status: 'running' } }
export const Finished: Story = { args: { status: 'finished' } }
export const Quiet: Story = { args: { status: 'quiet' } }

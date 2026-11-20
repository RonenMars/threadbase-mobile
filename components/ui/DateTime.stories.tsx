import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { DateTime } from './DateTime'

const meta: Meta<typeof DateTime> = {
  title: 'ui/DateTime',
  component: DateTime,
}
export default meta

type Story = StoryObj<typeof DateTime>

export const Today: Story = { args: { value: Date.now() - 3 * 3_600_000 } }

export const LastWeek: Story = { args: { value: Date.now() - 9 * 86_400_000 } }

export const TimeOnly: Story = { args: { value: '2026-10-04T10:00:00.000Z', variant: 'time' } }

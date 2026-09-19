import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { View } from 'react-native'
import { QuietHoursEditor } from './QuietHoursEditor'
import { useSettingsStore } from '@/stores/settings'
import type { NotificationPreferences } from '@/types/api'

const base: NotificationPreferences = {
  waitingInput: true,
  sessionFailed: true,
  quietHoursEnabled: true,
  quietHoursFrom: '22:00',
  quietHoursTo: '08:00',
  quietHoursDays: {},
}

function withPrefs(overrides: Partial<NotificationPreferences>) {
  return function Decorator(Story: () => React.JSX.Element) {
    useSettingsStore.setState({ notifications: { ...base, ...overrides } })
    return (
      <View style={{ padding: 16, maxWidth: 420 }}>
        <Story />
      </View>
    )
  }
}

const meta: Meta<typeof QuietHoursEditor> = {
  title: 'settings/QuietHoursEditor',
  component: QuietHoursEditor,
}

export default meta
type Story = StoryObj<typeof QuietHoursEditor>

export const EveryDay: Story = {
  decorators: [withPrefs({})],
}

export const WithDayOverrides: Story = {
  decorators: [
    withPrefs({
      quietHoursDays: {
        fri: { from: '23:30', to: '10:00' },
        sat: { from: '23:30', to: '10:00' },
        sun: null,
      },
    }),
  ],
}

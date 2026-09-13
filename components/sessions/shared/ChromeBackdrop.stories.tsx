import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { Text, View } from 'react-native'
import { ChromeBackdrop } from './ChromeBackdrop'

const meta: Meta<typeof ChromeBackdrop> = {
  title: 'sessions/ChromeBackdrop',
  component: ChromeBackdrop,
  decorators: [
    (Story) => (
      <View style={{ height: 260 }}>
        <View style={{ position: 'absolute', top: 80, left: 16, gap: 12 }}>
          {['Rebase and merge PR #903', 'Scan all worktrees', 'Fix the LinearGradient import'].map((row) => (
            <Text key={row} style={{ color: '#e6edf3', fontSize: 14, fontWeight: '600' }}>{row}</Text>
          ))}
        </View>
        <View style={{ height: 150 }}>
          <Story />
          <Text style={{ color: '#fff', fontSize: 17, fontWeight: '600', padding: 16 }}>Threadbase</Text>
        </View>
      </View>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof ChromeBackdrop>

export const Scrim: Story = {}

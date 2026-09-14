import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { View } from 'react-native'
import type { ProjectGroup } from './useProjectGroups'
import { QuietProjectChips } from './QuietProjectChips'

function group(name: string, conversationCount: number): ProjectGroup {
  return {
    projectId: `/home/user/${name}`,
    projectPath: `/home/user/${name}`,
    projectName: name,
    serverId: 'srv-1',
    sessions: [],
    conversationCount,
    latestActivityMs: 0,
    earliestStartMs: 0,
  }
}

const meta: Meta<typeof QuietProjectChips> = {
  title: 'sessions/hub/QuietProjectChips',
  component: QuietProjectChips,
  decorators: [
    (Story) => (
      <View style={{ padding: 16 }}>
        <Story />
      </View>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof QuietProjectChips>

export const LongTail: Story = {
  args: {
    groups: [group('dotfiles', 43), group('tb-scanner', 12), group('port', 4), group('cv', 8)],
    onPress: () => {},
  },
}

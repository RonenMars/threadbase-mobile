import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { fn } from 'storybook/test'
import { View } from 'react-native'
import { CopySimple, HourglassMedium, Info, Lightning, Power, Trash } from 'phosphor-react-native'
import { HeaderOverflowMenu } from './HeaderOverflowMenu'

const meta: Meta<typeof HeaderOverflowMenu> = {
  title: 'shared/HeaderOverflowMenu',
  component: HeaderOverflowMenu,
  decorators: [(Story) => <View style={{ padding: 16, alignItems: 'flex-end' }}><Story /></View>],
}

export default meta
type Story = StoryObj<typeof HeaderOverflowMenu>

export const WithEndSession: Story = {
  args: {
    items: [
      { key: 'info', label: 'Info', icon: Info, onPress: fn() },
      { key: 'copy', label: 'Copy all', icon: CopySimple, onPress: fn() },
      { key: 'whenDone', label: 'Terminate when done', icon: HourglassMedium, onPress: fn(), sectionLabel: 'End session' },
      { key: 'terminate', label: 'Terminate', icon: Power, onPress: fn(), destructive: true },
      { key: 'force', label: 'Force terminate', icon: Lightning, onPress: fn(), destructive: true },
      { key: 'delete', label: 'Delete…', icon: Trash, onPress: fn(), destructive: true, dividerBefore: true },
    ],
  },
}

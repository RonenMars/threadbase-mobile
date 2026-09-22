import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { fn } from 'storybook/test'
import { View } from 'react-native'
import { ArrowSquareOut, CopySimple, HourglassMedium, Lightning, Power, Trash } from 'phosphor-react-native'
import { SessionActionSheet, type SessionActionItem } from './SessionActionSheet'

const meta: Meta<typeof SessionActionSheet> = {
  title: 'sessions/SessionActionSheet',
  component: SessionActionSheet,
  decorators: [(Story) => <View style={{ flex: 1 }}><Story /></View>],
  args: {
    visible: true,
    title: 'Scan all worktrees, report which are stale',
    onClose: fn(),
  },
}

export default meta
type Story = StoryObj<typeof SessionActionSheet>

const base: SessionActionItem[] = [
  { key: 'open', label: 'Open', icon: ArrowSquareOut, onPress: fn() },
  { key: 'copy', label: 'Copy Session ID', icon: CopySimple, onPress: fn() },
]

const endItems: SessionActionItem[] = [
  { key: 'whenDone', label: 'Terminate when done', hint: 'Lets this turn finish, then ends it', icon: HourglassMedium, onPress: fn(), endSection: true },
  { key: 'terminate', label: 'Terminate', hint: 'Ends it now. You can resume it later.', icon: Power, destructive: true, onPress: fn() },
  { key: 'force', label: 'Force terminate', hint: "Only if Terminate didn't work", icon: Lightning, destructive: true, onPress: fn() },
  { key: 'delete', label: 'Delete…', hint: 'Removes it from Threadbase. Claude keeps its history.', icon: Trash, destructive: true, dividerBefore: true, onPress: fn() },
]

export const Working: Story = {
  args: { meta: 'Claude · Working · MacBook Pro', items: [...base, ...endItems] },
}

export const NeedsYou: Story = {
  args: {
    meta: 'Codex · Needs you · studio-linux',
    items: [...base, { ...endItems[1], endSection: true }, endItems[2], endItems[3]],
  },
}

export const OlderServer: Story = {
  args: { meta: 'Claude · Working · MacBook Pro', items: [...base, { ...endItems[1], endSection: true }] },
}

export const Idle: Story = {
  args: { meta: 'Claude · Idle · MacBook Pro', items: base },
}

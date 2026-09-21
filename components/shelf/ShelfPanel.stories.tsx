import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import type { ShelfEntry } from '@/lib/savedShelf'
import { ShelfPanel } from './ShelfPanel'

const noop = () => {}

const entries: ShelfEntry[] = [
  {
    favorite: { type: 'session', id: 'srv-a::session::s1', label: 'Fix login redirect', serverId: 'srv-a', sessionId: 's1' },
    target: { kind: 'session', serverId: 'srv-a', id: 's1' },
    needsYou: true,
    provider: 'claude-code',
  },
  {
    favorite: { type: 'conversation', id: 'srv-b::conversation::c1', label: 'Release checklist', serverId: 'srv-b', conversationId: 'c1' },
    target: { kind: 'conversation', serverId: 'srv-b', id: 'c1' },
    needsYou: false,
    provider: 'codex-cli',
  },
  {
    favorite: { type: 'session', id: 'srv-a::session::s2', label: 'Refactor billing module', serverId: 'srv-a', sessionId: 's2' },
    target: { kind: 'session', serverId: 'srv-a', id: 's2' },
    needsYou: false,
  },
]

const meta: Meta<typeof ShelfPanel> = {
  title: 'shelf/ShelfPanel',
  component: ShelfPanel,
  args: {
    visible: true,
    entries,
    serverLabels: null,
    reduceMotion: false,
    onSelect: noop,
    onClose: noop,
  },
}

export default meta
type Story = StoryObj<typeof ShelfPanel>

export const OneServer: Story = {}

export const TwoServers: Story = {
  args: { serverLabels: { 'srv-a': 'MacBook', 'srv-b': 'Build box' } },
}

export const Empty: Story = {
  args: { entries: [] },
}

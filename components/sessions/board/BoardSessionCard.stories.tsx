import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { View } from 'react-native'
import type { MultiConversation, MultiSession } from '@/types/api'
import { BoardSessionCard } from './BoardSessionCard'

const running = {
  id: 'r',
  serverId: 'server-1',
  status: 'running',
  ptyAttached: true,
  lifecycle: 'attached',
  subStatus: null,
  projectPath: '/Users/me/dev/ai-tools/tb-mobile',
  projectName: 'tb-mobile',
  branch: 'main',
  lastOutput: 'Allow this edit? (y/n)',
  elapsedMs: 60_000,
  promptCount: 3,
  startedAt: new Date(Date.now() - 15 * 60_000).toISOString(),
} as MultiSession

const card = (tier: 'working' | 'needsYou', item: MultiSession) => ({
  id: item.id,
  entry: { item: { kind: 'session' as const, ms: Date.now() - 120_000, item }, tier, title: { title: 'Add the board', rung: 'intent' as const }, statusLabel: null },
  group: undefined,
  isOpen: false,
  onToggle: () => {},
  onShowQuestion: () => {},
  serverIdFor: () => 'server-1',
  searchQuery: '',
})

const meta: Meta<typeof BoardSessionCard> = {
  title: 'sessions/board/BoardSessionCard',
  component: BoardSessionCard,
  decorators: [(Story) => <View style={{ maxWidth: 360, padding: 16 }}><Story /></View>],
}

export default meta
type Story = StoryObj<typeof BoardSessionCard>

export const Working: Story = { args: card('working', running) }
export const NeedsYouOlderServer: Story = { args: card('needsYou', running) }

const found = {
  id: 'c',
  serverId: 'server-1',
  title: 'Add the board',
  projectPath: '/Users/me/dev/ai-tools/tb-mobile',
  messageCount: 12,
  lastActivity: new Date(Date.now() - 3_600_000).toISOString(),
  matches: [{ field: 'content', snippet: 'we fixed the zebra crossing bug in the parser', highlights: [{ start: 13, end: 18 }] }],
} as MultiConversation

export const FoundByMessageBody: Story = {
  args: {
    ...card('working', running),
    entry: { item: { kind: 'conversation' as const, ms: Date.now() - 3_600_000, item: found }, tier: null, title: { title: 'Add the board', rung: 'intent' as const }, statusLabel: null },
    searchQuery: 'zebra',
  },
}

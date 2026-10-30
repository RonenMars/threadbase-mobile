import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { View } from 'react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SessionBoard } from './SessionBoard'
import type { MultiConversation, MultiSession } from '@/types/api'

const base: MultiSession = {
  id: 's',
  serverId: 'server-1',
  status: 'idle',
  ptyAttached: false,
  subStatus: null,
  projectPath: '/Users/me/dev/ai-tools/tb-mobile',
  projectName: 'tb-mobile',
  branch: 'main',
  lastOutput: '',
  elapsedMs: 60_000,
  promptCount: 3,
  startedAt: new Date(Date.now() - 15 * 60_000).toISOString(),
}

const waiting: MultiSession = {
  ...base,
  id: 'w',
  status: 'waiting_input',
  ptyAttached: true,
  lifecycle: 'attached',
  sessionName: 'Refactor the hub card',
  hasOpenPrompt: true,
  pendingPrompts: [{
    promptId: 'p1',
    revision: 1,
    state: 'open',
    questions: [{
      questionId: 'q1',
      text: 'Delete the old migration and regenerate it?',
      inputMode: 'single',
      options: [{ optionId: 'yes', label: 'Yes' }, { optionId: 'no', label: 'No', description: 'Keep it and stop here' }],
      allowOther: false,
      secret: false,
    }],
  }],
} as MultiSession
const olderServer: MultiSession = { ...waiting, id: 'o', sessionName: 'Older streamer', hasOpenPrompt: undefined, pendingPrompts: undefined, lastOutput: 'Allow this edit? (y/n)' }
const running: MultiSession = { ...base, id: 'r', status: 'running', ptyAttached: true, lifecycle: 'attached', sessionName: 'Add the board' }
const held: MultiSession = { ...base, id: 'h', status: 'idle', lifecycle: 'resumable', sessionName: 'Report slow streamer requests' }
const old: MultiConversation = {
  id: 'c',
  serverId: 'server-1',
  title: 'Index the transcripts',
  projectPath: '/Users/me/dev/ai-tools/tb-streamer',
  messageCount: 12,
  lastActivity: new Date(Date.now() - 2 * 86_400_000).toISOString(),
}

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

const meta: Meta<typeof SessionBoard> = {
  title: 'sessions/board/SessionBoard',
  component: SessionBoard,
  decorators: [
    (Story) => (
      <QueryClientProvider client={queryClient}>
        <View style={{ height: 700 }}>
          <Story />
        </View>
      </QueryClientProvider>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof SessionBoard>

const props = {
  searchQuery: '',
  conversationsFromServer: false,
  order: 'state',
  direction: 'desc',
  refreshing: false,
  onRefresh: () => {},
  onPromptsChanged: () => {},
} as const

// No server answers in Storybook, so no sub-agent folds appear. Widen the canvas past 768 for the columns.
export const Default: Story = {
  args: {
    ...props,
    items: [
      { kind: 'session', ms: Date.now() - 60_000, item: waiting },
      { kind: 'session', ms: Date.now() - 90_000, item: olderServer },
      { kind: 'session', ms: Date.now() - 120_000, item: running },
      { kind: 'session', ms: Date.now() - 3_600_000, item: held },
      { kind: 'conversation', ms: Date.now() - 2 * 86_400_000, item: old },
    ],
  },
}

export const Empty: Story = { args: { ...props, items: [] } }

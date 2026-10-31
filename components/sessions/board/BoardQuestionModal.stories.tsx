import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { MultiSession } from '@/types/api'
import { BoardQuestionModal } from './BoardQuestionModal'

const session = {
  id: 'w',
  serverId: 'server-1',
  projectPath: '/Users/me/dev/ai-tools/tb-mobile',
  hasOpenPrompt: true,
  pendingPrompts: [{
    promptId: 'p1',
    revision: 1,
    state: 'open',
    questions: [
      {
        questionId: 'q1',
        text: 'Delete the old migration and regenerate it?',
        inputMode: 'single',
        options: [{ optionId: 'yes', label: 'Yes' }, { optionId: 'no', label: 'No', description: 'Keep it and stop here' }],
        allowOther: false,
        secret: false,
      },
    ],
  }],
} as MultiSession

const queryClient = new QueryClient()

const meta: Meta<typeof BoardQuestionModal> = {
  title: 'sessions/board/BoardQuestionModal',
  component: BoardQuestionModal,
  decorators: [(Story) => <QueryClientProvider client={queryClient}><Story /></QueryClientProvider>],
}

export default meta

export const Default: StoryObj<typeof BoardQuestionModal> = {
  args: { session, title: 'Refactor the hub card', onClose: () => {}, onPromptsChanged: () => {} },
}

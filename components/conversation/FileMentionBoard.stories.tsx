import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { FileMentionBoard } from './FileMentionBoard'

const meta: Meta<typeof FileMentionBoard> = {
  title: 'conversation/FileMentionBoard',
  component: FileMentionBoard,
  args: { dir: '', query: '', onSelect: () => {}, onDismiss: () => {} },
}

export default meta
type Story = StoryObj<typeof FileMentionBoard>

export const ProjectRoot: Story = {
  args: {
    list: {
      status: 'ready',
      entries: [
        { name: 'app', kind: 'dir' },
        { name: 'components', kind: 'dir' },
        { name: 'hooks', kind: 'dir' },
        { name: 'package.json', kind: 'file' },
        { name: 'README.md', kind: 'file' },
        { name: 'tsconfig.json', kind: 'file' },
      ],
    },
  },
}

export const Filtered: Story = {
  args: {
    dir: 'components/conversation',
    query: 'Chat',
    list: { status: 'ready', entries: [{ name: 'ChatComposer.tsx', kind: 'file' }] },
  },
}

export const NoMatches: Story = {
  args: { query: 'zzz', list: { status: 'ready', entries: [] } },
}

export const Loading: Story = {
  args: { dir: 'src', list: { status: 'loading' } },
}

export const Unsupported: Story = {
  args: { list: { status: 'unsupported' } },
}

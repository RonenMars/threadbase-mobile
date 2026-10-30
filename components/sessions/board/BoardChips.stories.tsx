import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { useState } from 'react'
import type { BoardColumnId } from '@/lib/boardColumns'
import { BoardChips } from './BoardChips'

const meta: Meta<typeof BoardChips> = {
  title: 'sessions/board/BoardChips',
  component: BoardChips,
}

export default meta

function Live() {
  const [selected, setSelected] = useState<BoardColumnId>('needsYou')
  return <BoardChips counts={{ needsYou: 2, working: 4, observed: 0, earlier: 24 }} selected={selected} onSelect={setSelected} />
}

export const Default: StoryObj<typeof BoardChips> = { render: () => <Live /> }

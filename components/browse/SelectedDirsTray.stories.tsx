import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { useState } from 'react'
import { View } from 'react-native'
import { addAdditionalPath, canAddAdditionalPath } from '@/lib/additionalPaths'
import { SelectedDirsTray } from './SelectedDirsTray'

function Tray({ initial, current }: { initial: string[]; current: string }) {
  const [paths, setPaths] = useState(initial)
  return (
    <SelectedDirsTray
      paths={paths}
      canAdd={canAddAdditionalPath(paths, current)}
      onAdd={() => setPaths((p) => addAdditionalPath(p, current))}
      onRemove={(path) => setPaths((p) => p.filter((x) => x !== path))}
    />
  )
}

const meta: Meta<typeof Tray> = {
  title: 'browse/SelectedDirsTray',
  component: Tray,
  decorators: [
    (Story) => (
      <View style={{ paddingVertical: 16 }}>
        <Story />
      </View>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof Tray>

export const Empty: Story = {
  args: { initial: [], current: 'workspace/shared-lib' },
}

export const WithDirectories: Story = {
  args: { initial: ['workspace/shared-lib', 'workspace/docs', ''], current: 'workspace/api' },
}

export const Full: Story = {
  args: {
    initial: Array.from({ length: 8 }, (_, i) => `workspace/pkg-${i + 1}`),
    current: 'workspace/api',
  },
}

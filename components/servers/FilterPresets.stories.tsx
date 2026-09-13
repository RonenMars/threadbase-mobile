import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { useState } from 'react'
import { View } from 'react-native'
import { DEFAULT_FILTERS, type ListFilters } from '@/lib/sessionFilters'
import { FilterPresets } from './FilterPresets'

function Presets({ initial }: { initial: ListFilters }) {
  const [filters, setFilters] = useState(initial)
  return <FilterPresets filters={filters} onChange={setFilters} />
}

const meta: Meta<typeof Presets> = {
  title: 'servers/FilterPresets',
  component: Presets,
  decorators: [
    (Story) => (
      <View style={{ padding: 16 }}>
        <Story />
      </View>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof Presets>

export const Everything: Story = {
  args: { initial: DEFAULT_FILTERS },
}

export const NeedsMe: Story = {
  args: { initial: { ...DEFAULT_FILTERS, tiers: ['needsYou'] } },
}

import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { View } from 'react-native'
import { ProviderSelector } from './ProviderSelector'

const options = [
  { value: 'claude', label: 'Claude', color: '#d97757', unavailable: false },
  { value: 'codex', label: 'Codex', color: '#10a37f', unavailable: false },
  { value: 'cursor', label: 'Cursor', color: '#8b8b8b', unavailable: false },
  { value: 'copilot', label: 'Copilot', color: '#6e5adc', unavailable: true },
]

function Demo({ width }: { width: number }) {
  const [selected, setSelected] = useState('claude')
  return (
    <View style={{ width }}>
      <ProviderSelector options={options} selected={selected} onSelect={setSelected} />
    </View>
  )
}

const meta: Meta<typeof Demo> = {
  title: 'browse/ProviderSelector',
  component: Demo,
}

export default meta
type Story = StoryObj<typeof Demo>

export const OneRow: Story = { args: { width: 560 } }
export const Dropdown: Story = { args: { width: 300 } }

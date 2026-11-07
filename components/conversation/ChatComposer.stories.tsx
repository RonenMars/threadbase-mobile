import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { KeyboardProvider } from 'react-native-keyboard-controller'
import { ChatComposer } from './ChatComposer'

const meta: Meta<typeof ChatComposer> = {
  title: 'conversation/ChatComposer',
  component: ChatComposer,
  decorators: [(Story) => <SafeAreaProvider><KeyboardProvider><Story /></KeyboardProvider></SafeAreaProvider>],
  args: {
    value: '',
    onAttach: () => {},
    attachments: [],
    onRemoveAttachment: () => {},
    isUploading: false,
    attachError: null,
    sendError: null,
    disabled: false,
    voice: { listening: false, start: async () => {}, stop: () => {} },
    micGranted: false,
    onToggleMic: () => {},
  },
  render: function Composer(args) {
    const [value, setValue] = useState(args.value)
    return <ChatComposer {...args} value={value} onChangeText={setValue} onSend={() => setValue('')} />
  },
}

export default meta
type Story = StoryObj<typeof ChatComposer>

export const Empty: Story = {}

export const LongMessage: Story = {
  args: { value: 'A long draft message that grows the composer.\n'.repeat(20) },
}

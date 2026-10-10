import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { StyleSheet, View } from 'react-native'
import { SearchInput } from './SearchInput'

const meta: Meta<typeof SearchInput> = {
  title: 'shared/SearchInput',
  component: SearchInput,
  decorators: [(Story) => <View style={{ padding: 16 }}><Story /></View>],
}

export default meta
type Story = StoryObj<typeof SearchInput>

function Demo({ initial }: { initial: string }) {
  const [text, setText] = useState(initial)
  return <SearchInput value={text} onChangeText={setText} placeholder="Search" style={styles.input} />
}

export const Empty: Story = { render: () => <Demo initial="" /> }
export const WithText: Story = { render: () => <Demo initial="terminal replay" /> }

const styles = StyleSheet.create({
  input: { borderWidth: 1, borderColor: '#30363d', borderRadius: 8, padding: 10, color: '#c9d1d9' },
})

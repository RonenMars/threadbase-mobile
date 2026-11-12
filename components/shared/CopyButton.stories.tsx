import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { View } from 'react-native'
import { CopyButton } from './CopyButton'

const meta: Meta<typeof CopyButton> = {
  title: 'shared/CopyButton',
  component: CopyButton,
  decorators: [(Story) => <View style={{ padding: 16, alignItems: 'flex-start' }}><Story /></View>],
}

export default meta
type Story = StoryObj<typeof CopyButton>

export const Default: Story = { args: { value: 'c969cf5', accessibilityLabel: 'Copy commit' } }
export const Large: Story = { args: { value: 'c969cf5', accessibilityLabel: 'Copy commit', size: 24 } }

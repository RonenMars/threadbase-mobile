import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { Text, View } from 'react-native'
import { Card } from './Card'

const meta: Meta<typeof Card> = {
  title: 'ui/Card',
  component: Card,
  decorators: [(Story) => <View style={{ padding: 16 }}><Story /></View>],
}

export default meta
type Story = StoryObj<typeof Card>

export const Default: Story = {
  args: { variant: 'default', children: <Text>Default card</Text> },
}

export const Warning: Story = {
  args: { variant: 'warning', children: <Text>Warning card</Text> },
}

export const Danger: Story = {
  args: { variant: 'danger', children: <Text>Danger card</Text> },
}

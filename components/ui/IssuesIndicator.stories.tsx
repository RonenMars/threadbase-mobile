import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { View } from 'react-native'
import { IssuesIndicator } from './IssuesIndicator'

const meta: Meta<typeof IssuesIndicator> = {
  title: 'ui/IssuesIndicator',
  component: IssuesIndicator,
  decorators: [(Story) => <View style={{ minHeight: 120 }}><Story /></View>],
}

export default meta
type Story = StoryObj<typeof IssuesIndicator>

export const SingleIssue: Story = {
  args: { count: 1, onPress: () => {} },
}

export const MultipleIssues: Story = {
  args: { count: 4, onPress: () => {} },
}

export const NoIssues: Story = {
  args: { count: 0, onPress: () => {} },
}

import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { View } from 'react-native'
import { ServerChip } from './ServerChip'
import { SERVER_PALETTE } from './serverPalette'

const meta: Meta<typeof ServerChip> = {
  title: 'sessions/ServerChip',
  component: ServerChip,
  decorators: [(Story) => <View style={{ padding: 16, gap: 8, flexDirection: 'row', flexWrap: 'wrap' }}><Story /></View>],
}

export default meta
type Story = StoryObj<typeof ServerChip>

export const Label: Story = {
  args: { label: 'prod-server', color: SERVER_PALETTE[0] },
}

export const Letter: Story = {
  args: { label: 'prod-server', variant: 'letter', color: SERVER_PALETTE[1] },
}

export const Symbol: Story = {
  args: { label: 'prod-server', variant: 'symbol', color: SERVER_PALETTE[2] },
}

export const PalettePressable: Story = {
  args: { label: 'staging', color: SERVER_PALETTE[3], onPress: () => {} },
}

export const NotPressable: Story = {
  args: { label: 'read-only', color: SERVER_PALETTE[4] },
}

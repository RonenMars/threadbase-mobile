import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { View } from 'react-native'
import { CardSpine, CardTitleBlock, CountBadge, ChevronToggle } from './CollapsibleCardParts'

const meta: Meta = { title: 'Sessions/CollapsibleCardParts' }
export default meta
type Story = StoryObj

export const Parts: Story = {
  render: () => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, height: 48 }}>
      <CardSpine color="#3b82f6" />
      <CardTitleBlock parentLabel="~/dev" title="tb-mobile" activityLine="2 active" />
      <CountBadge count={3} />
      <ChevronToggle isOpen />
      <ChevronToggle isOpen={false} />
    </View>
  ),
}

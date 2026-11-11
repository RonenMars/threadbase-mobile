import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { TourOverlay } from './TourOverlay'

const meta: Meta<typeof TourOverlay> = {
  title: 'tour/TourOverlay',
  component: TourOverlay,
  args: {
    target: { x: 20, y: 120, width: 220, height: 64 },
    text: 'Each card is a Claude Code session.',
    onGotIt: () => {},
    onSkip: () => {},
  },
}

export default meta
type Story = StoryObj<typeof TourOverlay>

export const FirstStep: Story = { args: { stepLabel: '1 / 3' } }

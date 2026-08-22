import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { View } from 'react-native'
import { LanguageStep } from './LanguageStep'
import { colors } from '../theme'
import onboarding from '../../../locales/en/onboarding.json'

const meta: Meta<typeof LanguageStep> = {
  title: 'onboarding/LanguageStep',
  component: LanguageStep,
  decorators: [
    (Story) => (
      <View style={{ flex: 1, minHeight: 700, backgroundColor: colors.ink1 }}>
        <Story />
      </View>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof LanguageStep>

export const Default: Story = {
  args: { onContinue: () => undefined },
}

export const Retry: Story = {
  args: {
    onContinue: () => undefined,
    error: onboarding.language.persistRetry,
  },
}

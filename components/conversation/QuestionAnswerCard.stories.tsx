import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { QuestionAnswerCard } from './QuestionAnswerCard'

const meta: Meta<typeof QuestionAnswerCard> = {
  title: 'conversation/QuestionAnswerCard',
  component: QuestionAnswerCard,
}

export default meta
type Story = StoryObj<typeof QuestionAnswerCard>

export const Single: Story = {
  args: {
    items: [{
      header: '',
      question: 'Should the design gate also apply to the integration profile, or only to the product-feature profile?',
      answer: 'Depends: if the integration already exists, note open questions in the summary instead of stopping the run.',
    }],
  },
}

export const MultipleWithHeaders: Story = {
  args: {
    items: [
      { header: 'Fallback', question: 'Add fallback to ConversationCache?', answer: 'both (Recommended)' },
      { header: 'Scope', question: 'Which screens should it cover?', answer: 'Conversation detail only' },
    ],
  },
}

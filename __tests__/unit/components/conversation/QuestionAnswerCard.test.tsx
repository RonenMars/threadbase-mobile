import { render } from '@testing-library/react-native'
import React from 'react'
import { QuestionAnswerCard } from '@/components/conversation/QuestionAnswerCard'

describe('QuestionAnswerCard', () => {
  it('shows each question with its answer, labelled by header or "Question"', async () => {
    const { getByText } = await render(
      <QuestionAnswerCard
        items={[
          { header: '', question: 'Apply the gate?', answer: 'Depends' },
          { header: 'Scope', question: 'Which profile?', answer: 'Integration' },
        ]}
      />,
    )
    expect(getByText('Question')).toBeTruthy()
    expect(getByText('Apply the gate?')).toBeTruthy()
    expect(getByText('Depends')).toBeTruthy()
    expect(getByText('Scope')).toBeTruthy()
    expect(getByText('Integration')).toBeTruthy()
  })
})

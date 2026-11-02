import { mapAskQuestionToBlock } from '@/utils/mapAskQuestionToBlock'
import type { AskQuestion } from '@/types/api'

const qs: AskQuestion[] = [{
  question: 'How should I format the output?',
  header: 'Format',
  multiSelect: false,
  options: [
    { label: 'Summary', description: 'Brief' },
    { label: 'Detailed', description: 'Full', preview: 'x\ny' },
  ],
}]

describe('mapAskQuestionToBlock', () => {
  it('maps to a structured QuestionBlock preserving header/description/preview', () => {
    const block = mapAskQuestionToBlock('toolu_1', qs)
    expect(block.source).toBe('structured')
    expect(block.toolUseId).toBe('toolu_1')
    expect(block.selectedIndex).toBeUndefined()
    expect(block.questions[0].header).toBe('Format')
    expect(block.questions[0].options[1].preview).toBe('x\ny')
  })

  it('carries an unreadable-checkbox flag through, and omits it otherwise', () => {
    const flagged = mapAskQuestionToBlock('toolu_2', [{ ...qs[0], multiSelect: true, multiSelectUnverified: true }])
    expect(flagged.questions[0].multiSelectUnverified).toBe(true)
    expect(mapAskQuestionToBlock('toolu_3', qs).questions[0]).not.toHaveProperty('multiSelectUnverified')
  })
})

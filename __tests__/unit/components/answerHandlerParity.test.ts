import { readFileSync } from 'fs'
import { join } from 'path'

/**
 * The two live views hold byte-identical copies of the answer handlers, and the
 * seam that drives them end to end is only exercised through one of them —
 * standing up the other costs ~120 lines of mock scaffolding to re-assert the
 * same eleven behaviours.
 *
 * So this guards the assumption that makes that acceptable: that the copies are
 * the same. It is a blunt instrument and deliberately so. It fails the moment
 * someone edits one copy and not the other, which is the exact defect the
 * duplication invites and the one that has already bitten this pair once — the
 * permission handler was fixed in ThinkingBubble and left stale in
 * TerminalOutput, and no test would have caught it.
 *
 * The real fix is one copy behind a shared hook, tracked as
 * https://github.com/RonenMars/threadbase-mobile/issues/812. Deleting this test
 * is the correct outcome of that extraction, not a regression — the issue says
 * so, so whoever does it can tell a guard they are retiring from a mistake they
 * are inheriting.
 *
 * If you modify it instead of deleting it, keep both of the guards below: the
 * named error when the anchors stop matching, and the assertion that it is
 * covering more than a handful of lines. A source-reading test that silently
 * matches nothing passes forever against nothing, which is worse than no test.
 */
const VIEWS = [
  'components/terminal/TerminalView.tsx',
  'components/conversation/LiveConversationView.tsx',
]

const START = '  const handleAnswerPermission'
const END = '  }, [activeQuestion, clearQuestion, markPending, questionKey, respondToQuestion])'

function answerHandlers(relative: string): string {
  const source = readFileSync(join(process.cwd(), relative), 'utf8')
  const from = source.indexOf(START)
  const to = source.indexOf(END)
  if (from === -1 || to === -1) {
    throw new Error(
      `${relative}: could not find the answer handlers between "${START}" and "${END}". ` +
        'If they were renamed or extracted, update or delete this test deliberately.',
    )
  }
  return source.slice(from, to + END.length)
}

describe('answer handlers are the same in both live views', () => {
  it('keeps TerminalView and LiveConversationView byte-identical', () => {
    const [terminal, conversation] = VIEWS.map(answerHandlers)
    expect(conversation).toBe(terminal)
  })

  it('is guarding something, not an empty string', () => {
    expect(answerHandlers(VIEWS[0]).split('\n').length).toBeGreaterThan(15)
  })
})

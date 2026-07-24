import {
  buildReviewFromMessages,
  formatReviewNote,
  hunkFromEdit,
  hunkFromWrite,
} from '@/lib/reviewFromConversation'
import type { Message } from '@/types/api'

function msg(content: Message['content']): Message {
  return {
    id: '1',
    uuid: 'u1',
    role: 'assistant',
    content,
    timestamp: '',
    is_sidechain: false,
    parent_uuid: null,
  }
}

describe('reviewFromConversation', () => {
  it('builds hunks from Edit tool input', () => {
    const summary = buildReviewFromMessages([
      msg([
        {
          type: 'tool_use',
          name: 'Edit',
          input: {
            file_path: 'src/a.ts',
            old_string: 'const x = 1',
            new_string: 'const x = 2',
          },
        },
      ]),
    ])
    expect(summary.files).toHaveLength(1)
    expect(summary.files[0].path).toBe('src/a.ts')
    expect(summary.files[0].kind).toBe('edited')
    expect(summary.files[0].added).toBe(1)
    expect(summary.files[0].removed).toBe(1)
    expect(summary.incomplete).toBe(false)
  })

  it('treats Write as all additions', () => {
    const summary = buildReviewFromMessages([
      msg([
        {
          type: 'tool_use',
          name: 'Write',
          input: { file_path: 'src/b.ts', content: 'one\ntwo\nthree' },
        },
      ]),
    ])
    expect(summary.files[0].kind).toBe('written')
    expect(summary.files[0].added).toBe(3)
    expect(summary.files[0].removed).toBe(0)
  })

  it('marks incomplete when edit payload is missing', () => {
    const summary = buildReviewFromMessages([
      msg([{ type: 'tool_use', name: 'Edit', input: { file_path: 'x.ts' } }]),
    ])
    expect(summary.incomplete).toBe(true)
    expect(summary.files[0].incompleteReasons).toContain('missing_edit_payload')
  })

  it('includes structured diff blocks', () => {
    const summary = buildReviewFromMessages([
      msg([
        {
          type: 'diff',
          filename: 'readme.md',
          hunks: [hunkFromEdit('a', 'b')],
        },
      ]),
    ])
    expect(summary.files[0].kind).toBe('diff')
    expect(summary.totalAdded).toBe(1)
  })

  it('formats a compact review note', () => {
    const summary = buildReviewFromMessages([
      msg([
        {
          type: 'tool_use',
          name: 'Write',
          input: { file_path: 'a.ts', content: hunkFromWrite('x').lines.map((l) => l.content).join('\n') },
        },
      ]),
    ])
    const note = formatReviewNote(summary, 'a.ts')
    expect(note).toContain('Focus: a.ts')
    expect(note).toContain('a.ts')
  })
})

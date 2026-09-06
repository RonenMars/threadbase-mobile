import { inheritedHistorySeam, type RawInheritedHistory } from '@/utils/inheritedHistory'

describe('inheritedHistorySeam', () => {
  it('returns nothing when the server sends no inherited_history', () => {
    expect(inheritedHistorySeam(undefined)).toBeUndefined()
    expect(inheritedHistorySeam(null)).toBeUndefined()
  })

  it('maps a fork boundary to a divider seam', () => {
    expect(
      inheritedHistorySeam({
        source_id: '01a075cd-f290-7d63-9bd8-b37f70c2ef5f',
        source_provider: 'codex-cli',
        through_message_index: 21,
        forked_at: '2026-09-06T17:31:07.482Z',
        unavailable_reason: null,
      }),
    ).toEqual({ kind: 'divider', beforeMessageIndex: 21, forkedAt: '2026-09-06T17:31:07.482Z' })
  })

  it('reports an unreadable parent regardless of the other fields', () => {
    expect(
      inheritedHistorySeam({ through_message_index: 0, unavailable_reason: 'source_missing' }),
    ).toEqual({ kind: 'unavailable' })
  })

  it('returns nothing for a zero boundary with no reason', () => {
    expect(inheritedHistorySeam({ through_message_index: 0 })).toBeUndefined()
  })

  it('returns nothing for malformed field types or a negative boundary', () => {
    const wrongTypes = { through_message_index: '21', forked_at: 12345 } as unknown as RawInheritedHistory
    expect(inheritedHistorySeam(wrongTypes)).toBeUndefined()
    expect(inheritedHistorySeam({ through_message_index: -3 })).toBeUndefined()
    expect(inheritedHistorySeam({ through_message_index: 2.5 })).toBeUndefined()
    expect(inheritedHistorySeam({ through_message_index: Number.NaN })).toBeUndefined()
  })

  it('drops an unusable forked_at but keeps the divider', () => {
    expect(inheritedHistorySeam({ through_message_index: 4, forked_at: '' })).toEqual({
      kind: 'divider',
      beforeMessageIndex: 4,
      forkedAt: undefined,
    })
  })

  it('ignores an unavailable_reason this build does not know', () => {
    expect(
      inheritedHistorySeam({ through_message_index: 7, unavailable_reason: 'something_new' }),
    ).toEqual({ kind: 'divider', beforeMessageIndex: 7, forkedAt: undefined })
  })
})

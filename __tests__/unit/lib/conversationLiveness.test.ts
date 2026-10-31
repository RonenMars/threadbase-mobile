import { conversationTier } from '@/lib/externalSession'

describe('conversationTier', () => {
  it('is observed for a conversation running outside Threadbase', () => {
    expect(conversationTier({ ownership: 'external', processLiveness: 'alive' })).toBe('observed')
  })

  it('keys on processLiveness alone, so the list-row and detail shapes agree', () => {
    expect(conversationTier({ processLiveness: 'alive' })).toBe('observed')
  })

  it('is undefined for a row from a streamer without the fields', () => {
    expect(conversationTier({})).toBeUndefined()
  })

  it('is undefined for ownership without liveness', () => {
    expect(conversationTier({ ownership: 'external' })).toBeUndefined()
  })
})

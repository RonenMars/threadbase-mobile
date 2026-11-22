import * as SecureStore from '@/services/secure-store'
import { useDraftsStore, hasDraft } from '@/stores/drafts'

jest.mock('@/services/secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
}))

const getItem = SecureStore.getItemAsync as jest.Mock

beforeEach(() => {
  useDraftsStore.setState({ drafts: {} })
  getItem.mockReset()
})

describe('hasDraft', () => {
  it('is true for a stored draft', () => {
    useDraftsStore.getState().setDraft('srv', 'a', 'fix the bug')
    expect(hasDraft('srv', 'a')).toBe(true)
  })

  it.each([
    ['a missing key', undefined],
    ['an empty string', ''],
    ['whitespace only', '   \n'],
  ])('is false for %s', (_name, text) => {
    if (text !== undefined) useDraftsStore.setState({ drafts: { 'srv::a': text } })
    expect(hasDraft('srv', 'a')).toBe(false)
  })

  it('is false after the draft is emptied', () => {
    useDraftsStore.getState().setDraft('srv', 'a', 'hi')
    useDraftsStore.getState().setDraft('srv', 'a', '')
    expect(hasDraft('srv', 'a')).toBe(false)
  })

  it('is false after clearDraft', () => {
    useDraftsStore.getState().setDraft('srv', 'a', 'hi')
    useDraftsStore.getState().clearDraft('srv', 'a')
    expect(hasDraft('srv', 'a')).toBe(false)
  })

  it('does not match the same session id on another server', () => {
    useDraftsStore.getState().setDraft('srv', 'a', 'hi')
    expect(hasDraft('other', 'a')).toBe(false)
  })

  it('is true after hydrating a persisted draft', async () => {
    getItem.mockResolvedValueOnce(JSON.stringify({ 'srv::a': 'hi' }))
    await useDraftsStore.getState().hydrate()
    expect(hasDraft('srv', 'a')).toBe(true)
  })

  it('stays false and does not throw on a corrupt persisted value', async () => {
    getItem.mockResolvedValueOnce('{not json')
    await expect(useDraftsStore.getState().hydrate()).resolves.toBeUndefined()
    expect(hasDraft('srv', 'a')).toBe(false)
  })
})

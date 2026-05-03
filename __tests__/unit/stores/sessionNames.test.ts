import { useSessionNamesStore } from '@/stores/sessionNames'

beforeEach(() => {
  useSessionNamesStore.setState({ names: {}, nameOrigins: {} })
})

describe('sessionNamesStore – getName/setName', () => {
  it('returns undefined for unknown session', () => {
    expect(useSessionNamesStore.getState().getName('srv1', 'sess1')).toBeUndefined()
  })

  it('stores and retrieves a name', () => {
    useSessionNamesStore.getState().setName('srv1', 'sess1', 'fix-auth', 'manual')
    expect(useSessionNamesStore.getState().getName('srv1', 'sess1')).toBe('fix-auth')
  })

  it('stores origin alongside name', () => {
    useSessionNamesStore.getState().setName('srv1', 'sess1', 'fix-auth', 'auto')
    expect(useSessionNamesStore.getState().getOrigin('srv1', 'sess1')).toBe('auto')
  })

  it('overwrites existing name', () => {
    useSessionNamesStore.getState().setName('srv1', 'sess1', 'old', 'auto')
    useSessionNamesStore.getState().setName('srv1', 'sess1', 'new', 'manual')
    expect(useSessionNamesStore.getState().getName('srv1', 'sess1')).toBe('new')
    expect(useSessionNamesStore.getState().getOrigin('srv1', 'sess1')).toBe('manual')
  })

  it('mergeFromServer does not overwrite manual names', () => {
    useSessionNamesStore.getState().setName('srv1', 'sess1', 'my-name', 'manual')
    useSessionNamesStore.getState().mergeFromServer('srv1', { sess1: 'server-name' })
    expect(useSessionNamesStore.getState().getName('srv1', 'sess1')).toBe('my-name')
  })

  it('mergeFromServer fills in missing names', () => {
    useSessionNamesStore.getState().mergeFromServer('srv1', { sess1: 'server-name' })
    expect(useSessionNamesStore.getState().getName('srv1', 'sess1')).toBe('server-name')
    expect(useSessionNamesStore.getState().getOrigin('srv1', 'sess1')).toBe('auto')
  })
})

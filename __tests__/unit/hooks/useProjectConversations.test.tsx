import { renderHook } from '@testing-library/react-native'
import { useProjectConversations } from '@/hooks/useProjectConversations'
import { createWrapper } from '@/test-utils'

const mockGet = jest.fn()

jest.mock('@/services/api-client', () => ({
  createApiForServer: () => ({ get: (...a: unknown[]) => mockGet(...a) }),
}))

beforeEach(() => mockGet.mockReset())

describe('useProjectConversations', () => {
  it('is not loading while disabled, so a card with no history shows no spinner', async () => {
    const { result } = await renderHook(
      () => useProjectConversations('/p', 's1', undefined, { enabled: false }),
      { wrapper: createWrapper() },
    )
    expect(result.current.isLoading).toBe(false)
    expect(mockGet).not.toHaveBeenCalled()
  })

  it('is loading while the first page is in flight', async () => {
    mockGet.mockReturnValue(new Promise(() => {}))
    const { result } = await renderHook(() => useProjectConversations('/p', 's1'), {
      wrapper: createWrapper(),
    })
    expect(result.current.isLoading).toBe(true)
  })
})

import React from 'react'
import { renderHook } from '@testing-library/react-native'

// jest.setup.js mocks 'expo-router' wholesale, but these are different module
// ids, so the real parser and hook load. Pinned to the exact modules expo-router
// runs for a deep link: extractExpoPathFromURL -> getStateFromPath ->
// route.params -> LocalRouteParamsContext -> useLocalSearchParams.
const { extractExpoPathFromURL } = jest.requireActual<
  typeof import('expo-router/build/fork/extractPathFromURL')
>('expo-router/build/fork/extractPathFromURL')
const { getStateFromPath } = jest.requireActual<
  typeof import('expo-router/build/fork/getStateFromPath')
>('expo-router/build/fork/getStateFromPath')
const { LocalRouteParamsContext } =
  jest.requireActual<typeof import('expo-router/build/Route')>('expo-router/build/Route')
const { useLocalSearchParams } = jest.requireActual<
  typeof import('expo-router/build/hooks/useLocalSearchParams')
>('expo-router/build/hooks/useLocalSearchParams')

type RouteParams = Record<string, string | string[]>

async function paramsDeliveredToPairScreen(url: string): Promise<RouteParams> {
  const path = extractExpoPathFromURL([], url)
  const state = getStateFromPath(path, { screens: { pair: 'pair' } })
  const route = state?.routes[0]
  const routeParams = (route?.params ?? {}) as RouteParams

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <LocalRouteParamsContext value={routeParams}>{children}</LocalRouteParamsContext>
  )
  const { result } = await renderHook(() => useLocalSearchParams(), { wrapper })
  return result.current as RouteParams
}

describe('expo-router query params for threadbase://pair', () => {
  // app/pair.tsx buildPairUri keeps `spk` on `!== undefined`, not truthiness,
  // so a present-but-empty key reaches parsePairUri and is refused. If expo-router
  // starts delivering undefined here, that allowlist never sees the parameter and
  // the plaintext path is selected for a damaged key. See issue #905.
  it('delivers a present-but-empty spk as an empty string, not undefined', async () => {
    const params = await paramsDeliveredToPairScreen(
      'threadbase://pair?url=https%3A%2F%2Fexample.test&token=pt_abc&exp=1&spk=',
    )

    expect(params.spk).toBe('')
    expect(Object.keys(params)).toContain('spk')
    expect(params.token).toBe('pt_abc')
  })

  it('delivers an empty spk that is not the last parameter as an empty string', async () => {
    const params = await paramsDeliveredToPairScreen(
      'threadbase://pair?url=https%3A%2F%2Fexample.test&spk=&token=pt_abc&exp=1&v=1',
    )

    expect(params.spk).toBe('')
    expect(params.v).toBe('1')
  })

  it('leaves spk undefined when the link carries no spk at all', async () => {
    const params = await paramsDeliveredToPairScreen(
      'threadbase://pair?url=https%3A%2F%2Fexample.test&token=pt_abc&exp=1',
    )

    expect(params.spk).toBeUndefined()
    expect(Object.keys(params)).not.toContain('spk')
  })
})

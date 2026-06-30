import type { NetInfoState } from '@react-native-community/netinfo'

// jest.mock is hoisted above imports and its factory runs during the
// query-client import (before any top-level const initializes), so the captured
// listener is stashed on the mock module itself and read back via require here.
jest.mock('@react-native-community/netinfo', () => {
  const holder: { listener?: (state: unknown) => void } = {}
  return {
    __esModule: true,
    default: {
      addEventListener: (cb: (state: unknown) => void) => {
        holder.listener = cb
        return jest.fn()
      },
    },
    __holder: holder,
  }
})

function emit(partial: Partial<NetInfoState>) {
  const mod = jest.requireMock('@react-native-community/netinfo') as {
    __holder: { listener?: (state: unknown) => void }
  }
  mod.__holder.listener?.(partial)
}

import { onlineManager } from '@tanstack/react-query'
import { shouldPersistQuery, queryClient } from '@/services/query-client'

function q(queryKey: readonly unknown[], meta?: unknown) {
  return { queryKey, meta }
}

describe('shouldPersistQuery (persistence allow-list)', () => {
  it('allows session/conversation/project/serverInfo lightweight metadata', () => {
    expect(shouldPersistQuery(q(['session', 'srv1', 's1']))).toBe(true)
    expect(shouldPersistQuery(q(['conversation', 'srv1', 'c1']))).toBe(true)
    expect(shouldPersistQuery(q(['project', 'srv1', 'p1']))).toBe(true)
    expect(shouldPersistQuery(q(['serverInfo', 'srv1']))).toBe(true)
  })

  it('does NOT persist projectChats (removed)', () => {
    expect(shouldPersistQuery(q(['projectChats', 'srv1']))).toBe(false)
  })

  it('does NOT persist sessionMessages by default', () => {
    expect(shouldPersistQuery(q(['sessionMessages', 'srv1', 's1']))).toBe(false)
  })

  it('does NOT persist arbitrary unlisted query roots', () => {
    expect(shouldPersistQuery(q(['browse', 'srv1', '/some/path']))).toBe(false)
    expect(shouldPersistQuery(q(['random-thing']))).toBe(false)
  })

  it('respects an explicit meta.persist=false override on an allowed query', () => {
    expect(shouldPersistQuery(q(['session', 'srv1', 's1'], { persist: false }))).toBe(false)
  })
})

describe('onlineManager <- NetInfo wiring', () => {
  afterEach(() => {
    onlineManager.setOnline(true)
  })

  it('registers a NetInfo listener on module load', () => {
    const mod = jest.requireMock('@react-native-community/netinfo') as {
      __holder: { listener?: unknown }
    }
    expect(mod.__holder.listener).toBeDefined()
  })

  it('flips onlineManager offline when NetInfo reports no connection', () => {
    emit({ isConnected: false, isInternetReachable: false })
    expect(onlineManager.isOnline()).toBe(false)
  })

  it('flips onlineManager back online on reconnect', () => {
    emit({ isConnected: false, isInternetReachable: false })
    emit({ isConnected: true, isInternetReachable: true })
    expect(onlineManager.isOnline()).toBe(true)
  })

  it('treats unknown reachability (null) as online so cold start does not pause', () => {
    emit({ isConnected: true, isInternetReachable: null })
    expect(onlineManager.isOnline()).toBe(true)
  })

  it('resumes paused mutations on an offline->online transition', () => {
    const resume = jest.spyOn(queryClient, 'resumePausedMutations').mockResolvedValue(undefined)
    emit({ isConnected: false, isInternetReachable: false })
    emit({ isConnected: true, isInternetReachable: true })
    expect(resume).toHaveBeenCalledTimes(1)
    resume.mockRestore()
  })

  it('does NOT resume when staying online (no transition)', () => {
    onlineManager.setOnline(true)
    const resume = jest.spyOn(queryClient, 'resumePausedMutations').mockResolvedValue(undefined)
    emit({ isConnected: true, isInternetReachable: true })
    expect(resume).not.toHaveBeenCalled()
    resume.mockRestore()
  })
})

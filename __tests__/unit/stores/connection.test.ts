import { useConnectionStore } from '@/stores/connection'
import * as SecureStore from 'expo-secure-store'

const INITIAL_STATE = {
  serverUrl: 'http://localhost:7070',
  apiKey: '',
  isConnected: false,
  serverInfo: null,
  isLoading: false,
}

beforeEach(() => {
  useConnectionStore.setState(INITIAL_STATE)
  jest.clearAllMocks()
})

describe('ConnectionStore – setConnected', () => {
  it('marks as connected', () => {
    useConnectionStore.getState().setConnected(true)
    expect(useConnectionStore.getState().isConnected).toBe(true)
  })

  it('marks as disconnected', () => {
    useConnectionStore.setState({ isConnected: true })
    useConnectionStore.getState().setConnected(false)
    expect(useConnectionStore.getState().isConnected).toBe(false)
  })

  it('stores serverInfo when provided', () => {
    const info = { version: '1.0.0', machineName: 'mac', platform: 'darwin', activeSessions: 2 }
    useConnectionStore.getState().setConnected(true, info)
    expect(useConnectionStore.getState().serverInfo).toEqual(info)
  })

  it('clears serverInfo when called without second arg', () => {
    useConnectionStore.setState({ serverInfo: { version: '1', machineName: 'm', platform: 'p', activeSessions: 0 } })
    useConnectionStore.getState().setConnected(false)
    expect(useConnectionStore.getState().serverInfo).toBeNull()
  })
})

describe('ConnectionStore – clearConnection', () => {
  it('clears apiKey and disconnects', async () => {
    useConnectionStore.setState({ apiKey: 'secret', isConnected: true, serverInfo: { version: '1', machineName: 'm', platform: 'p', activeSessions: 0 } })
    await useConnectionStore.getState().clearConnection()
    const state = useConnectionStore.getState()
    expect(state.apiKey).toBe('')
    expect(state.isConnected).toBe(false)
    expect(state.serverInfo).toBeNull()
  })

  it('calls SecureStore.deleteItemAsync', async () => {
    await useConnectionStore.getState().clearConnection()
    expect(SecureStore.deleteItemAsync).toHaveBeenCalled()
  })
})

describe('ConnectionStore – setConnection', () => {
  // setConnection uses a dynamic import() that Jest cannot intercept without
  // --experimental-vm-modules. We test what we can before the dynamic import
  // and keep the state-update tests in the onboarding E2E flow tests.

  it('persists API key to SecureStore before touching AsyncStorage', async () => {
    // Allow the call to run until the dynamic import fires, then catch that error
    await useConnectionStore.getState().setConnection('http://server.com', 'test-key').catch(() => {})
    // SecureStore.setItemAsync is called BEFORE the dynamic import on line 30
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(expect.any(String), 'test-key')
  })
})

describe('ConnectionStore – initial state', () => {
  it('starts as not loading', () => {
    expect(useConnectionStore.getState().isLoading).toBe(false)
  })

  it('starts with empty apiKey', () => {
    expect(useConnectionStore.getState().apiKey).toBe('')
  })

  it('starts as not connected', () => {
    expect(useConnectionStore.getState().isConnected).toBe(false)
  })
})

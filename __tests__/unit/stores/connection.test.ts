import { useServersStore } from '@/stores/servers'
import * as SecureStore from 'expo-secure-store'

const INITIAL_STATE = {
  servers: {},
  activeServerIds: [],
  isLoading: false,
}

beforeEach(() => {
  useServersStore.setState(INITIAL_STATE)
  jest.clearAllMocks()
})

describe('ServersStore – setConnected', () => {
  it('marks a server as connected', () => {
    useServersStore.setState({
      servers: { srv_test: { id: 'srv_test', url: 'http://test.local', apiKey: 'key', isConnected: false, serverInfo: null, connectionError: null } },
      activeServerIds: ['srv_test'],
    })
    useServersStore.getState().setConnected('srv_test', true)
    expect(useServersStore.getState().servers.srv_test.isConnected).toBe(true)
  })

  it('marks a server as disconnected', () => {
    useServersStore.setState({
      servers: { srv_test: { id: 'srv_test', url: 'http://test.local', apiKey: 'key', isConnected: true, serverInfo: null, connectionError: null } },
      activeServerIds: ['srv_test'],
    })
    useServersStore.getState().setConnected('srv_test', false)
    expect(useServersStore.getState().servers.srv_test.isConnected).toBe(false)
  })

  it('stores serverInfo when provided', () => {
    const info = { version: '1.0.0', machineName: 'mac', platform: 'darwin', activeSessions: 2 }
    useServersStore.setState({
      servers: { srv_test: { id: 'srv_test', url: 'http://test.local', apiKey: 'key', isConnected: false, serverInfo: null, connectionError: null } },
      activeServerIds: ['srv_test'],
    })
    useServersStore.getState().setConnected('srv_test', true, info)
    expect(useServersStore.getState().servers.srv_test.serverInfo).toEqual(info)
  })
})

describe('ServersStore – removeServer', () => {
  it('removes a server and calls SecureStore.deleteItemAsync', async () => {
    useServersStore.setState({
      servers: { srv_test: { id: 'srv_test', url: 'http://test.local', apiKey: 'key', isConnected: true, serverInfo: null, connectionError: null } },
      activeServerIds: ['srv_test'],
    })
    await useServersStore.getState().removeServer('srv_test')
    expect(useServersStore.getState().servers.srv_test).toBeUndefined()
    expect(useServersStore.getState().activeServerIds).not.toContain('srv_test')
    expect(SecureStore.deleteItemAsync).toHaveBeenCalled()
  })
})

describe('ServersStore – addServer', () => {
  it('persists API key to SecureStore', async () => {
    await useServersStore.getState().addServer('http://server.com', 'test-key').catch(() => {})
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(expect.any(String), 'test-key')
  })
})

describe('ServersStore – initial state', () => {
  it('starts as not loading', () => {
    expect(useServersStore.getState().isLoading).toBe(false)
  })

  it('starts with no servers', () => {
    expect(useServersStore.getState().activeServerIds).toEqual([])
  })
})

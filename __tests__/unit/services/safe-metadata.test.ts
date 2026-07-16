import {
  deriveConnectionMode,
  getSafeBuildMetadata,
  getReleaseString,
} from '@/services/safe-metadata'

describe('deriveConnectionMode', () => {
  it('classifies loopback and LAN hosts as local', () => {
    expect(deriveConnectionMode('http://localhost:8766')).toBe('local')
    expect(deriveConnectionMode('http://127.0.0.1:8766')).toBe('local')
    expect(deriveConnectionMode('http://192.168.1.42:8766')).toBe('local')
    expect(deriveConnectionMode('http://10.0.0.5:8766')).toBe('local')
    expect(deriveConnectionMode('http://172.16.3.4:8766')).toBe('local')
    expect(deriveConnectionMode('http://mymac.local:8766')).toBe('local')
    expect(deriveConnectionMode('https://mymac.local:8443')).toBe('local')
  })

  it('classifies plaintext http public hosts as local (no TLS = not remote)', () => {
    expect(deriveConnectionMode('http://example.com')).toBe('local')
  })

  it('classifies https public hosts as remote', () => {
    expect(deriveConnectionMode('https://prod.tunnel.example.com')).toBe('remote')
    expect(deriveConnectionMode('wss://relay.threadbase.dev/ws')).toBe('remote')
  })

  it('returns unknown for unparseable / empty input and never echoes the url', () => {
    expect(deriveConnectionMode('')).toBe('unknown')
    expect(deriveConnectionMode(null)).toBe('unknown')
    expect(deriveConnectionMode(undefined)).toBe('unknown')
    expect(deriveConnectionMode('not a url')).toBe('unknown')
  })

  it('output is one of the three fixed enum values (never a url substring)', () => {
    const modes = new Set(['local', 'remote', 'unknown'])
    for (const url of ['https://secret.example.com/x?key=abc', 'http://192.168.0.1', 'garbage']) {
      expect(modes.has(deriveConnectionMode(url))).toBe(true)
    }
  })
})

describe('getSafeBuildMetadata', () => {
  it('returns only safe build/runtime fields', () => {
    const meta = getSafeBuildMetadata()
    expect(meta.appVersion).toBe('1.0.0')
    expect(typeof meta.buildNumber).toBe('string')
    expect(['ios', 'android', 'web', 'windows', 'macos']).toContain(meta.platform)
    expect(typeof meta.osVersion).toBe('string')
    expect(['hermes', 'jsc']).toContain(meta.jsEngine)
    // No device name / server / url keys
    const keys = Object.keys(meta)
    expect(keys.some((k) => /name|url|host|ip|serial|udid/i.test(k))).toBe(false)
  })
})

describe('getReleaseString', () => {
  it('is name@version+build with no sensitive content', () => {
    const rel = getReleaseString()
    expect(rel).toMatch(/^threadbase-mobile@\d/)
    expect(rel.includes('+')).toBe(true)
  })
})

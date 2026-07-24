import {
  deviceHasCapability,
  parseDeviceRevokeResponse,
  parseDevicesResponse,
} from '@/types/devices'

describe('parseDevicesResponse', () => {
  it('parses a valid payload', () => {
    const parsed = parseDevicesResponse({
      available: true,
      devices: [
        {
          deviceId: 'dev-1',
          name: 'iPhone',
          capabilities: ['history:read', 'session:control', 'bogus'],
          createdAt: 1,
          lastSeenAt: 2,
          revokedAt: null,
        },
      ],
    })
    expect(parsed).toEqual({
      available: true,
      devices: [
        {
          deviceId: 'dev-1',
          name: 'iPhone',
          capabilities: ['history:read', 'session:control'],
          createdAt: 1,
          lastSeenAt: 2,
          revokedAt: null,
        },
      ],
    })
  })

  it('rejects malformed payloads', () => {
    expect(parseDevicesResponse({})).toBeNull()
    expect(parseDevicesResponse({ available: true, devices: 'x' })).toBeNull()
  })
})

describe('parseDeviceRevokeResponse', () => {
  it('parses ok + alreadyRevoked', () => {
    expect(parseDeviceRevokeResponse({ ok: true, alreadyRevoked: false })).toEqual({
      ok: true,
      alreadyRevoked: false,
    })
  })

  it('rejects missing fields', () => {
    expect(parseDeviceRevokeResponse({ ok: true })).toBeNull()
  })
})

describe('deviceHasCapability', () => {
  it('treats missing capabilities as full owner access', () => {
    expect(deviceHasCapability(undefined, 'session:control')).toBe(true)
    expect(deviceHasCapability([], 'session:control')).toBe(true)
  })

  it('checks listed capabilities and admin', () => {
    expect(deviceHasCapability(['history:read'], 'session:control')).toBe(false)
    expect(deviceHasCapability(['admin'], 'session:control')).toBe(true)
    expect(deviceHasCapability(['session:control'], 'session:control')).toBe(true)
  })
})

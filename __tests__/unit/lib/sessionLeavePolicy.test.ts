import {
  applySessionLeaveAction,
  coerceSessionLeaveAction,
  decideSessionLeave,
  isLiveAttachedPty,
  type LeaveSessionSnapshot,
} from '@/lib/sessionLeavePolicy'

const live: LeaveSessionSnapshot = {
  ptyAttached: true,
  status: 'running',
}

describe('sessionLeavePolicy', () => {
  it('coerces unknown settings to always-ask', () => {
    expect(coerceSessionLeaveAction(undefined)).toBe('ask')
    expect(coerceSessionLeaveAction('nope')).toBe('ask')
    expect(coerceSessionLeaveAction('kill')).toBe('kill')
  })

  it('treats only running/waiting_input + pty as live', () => {
    expect(isLiveAttachedPty(live)).toBe(true)
    expect(isLiveAttachedPty({ ...live, status: 'waiting_input' })).toBe(true)
    expect(isLiveAttachedPty({ ...live, status: 'idle' })).toBe(false)
    expect(isLiveAttachedPty({ ...live, status: 'on_hold' })).toBe(false)
    expect(isLiveAttachedPty({ ...live, status: 'mystery' })).toBe(false)
    expect(isLiveAttachedPty({ ...live, ptyAttached: false })).toBe(false)
    expect(isLiveAttachedPty(null)).toBe(false)
  })

  it('prompts on an empty live session the same as any other live session', () => {
    expect(decideSessionLeave({ session: live, setting: 'ask' })).toEqual({
      kind: 'prompt',
    })
  })

  it('decides prompt / apply / none', () => {
    expect(decideSessionLeave({ session: live, setting: 'ask' })).toEqual({
      kind: 'prompt',
    })
    expect(decideSessionLeave({ session: live, setting: 'kill' })).toEqual({
      kind: 'apply',
      action: 'kill',
    })
    expect(decideSessionLeave({ session: live, setting: 'leave' })).toEqual({
      kind: 'apply',
      action: 'leave',
    })
    expect(decideSessionLeave({ session: live, setting: 'kill_on_idle' })).toEqual({
      kind: 'apply',
      action: 'kill_on_idle',
    })
    expect(
      decideSessionLeave({ session: { ...live, status: 'idle' }, setting: 'ask' }),
    ).toEqual({ kind: 'none' })
  })

  it('maps kill / leave / hold to their outcomes', async () => {
    const stopSession = jest.fn(() => Promise.resolve())
    const sendHold = jest.fn(() => Promise.resolve(true))
    await expect(applySessionLeaveAction({ action: 'kill', stopSession, sendHold })).resolves.toEqual(
      { ok: true, applied: 'kill' },
    )
    expect(stopSession).toHaveBeenCalled()
    expect(sendHold).not.toHaveBeenCalled()

    stopSession.mockClear()
    await expect(
      applySessionLeaveAction({ action: 'leave', stopSession, sendHold }),
    ).resolves.toEqual({ ok: true, applied: 'leave' })
    expect(stopSession).not.toHaveBeenCalled()

    await expect(
      applySessionLeaveAction({ action: 'kill_on_idle', stopSession, sendHold }),
    ).resolves.toEqual({ ok: true, applied: 'kill_on_idle' })
    expect(sendHold).toHaveBeenCalled()
  })

  it('reports failure without throwing when kill fails', async () => {
    const stopSession = jest.fn(() => Promise.reject(new Error('stop failed')))
    const sendHold = jest.fn(() => Promise.resolve(true))
    await expect(applySessionLeaveAction({ action: 'kill', stopSession, sendHold })).resolves.toEqual(
      { ok: false, applied: 'kill' },
    )
  })

  it('reports failure when the streamer denies the hold', async () => {
    const stopSession = jest.fn(() => Promise.resolve())
    const sendHold = jest.fn(() => Promise.resolve(false))
    await expect(
      applySessionLeaveAction({ action: 'kill_on_idle', stopSession, sendHold }),
    ).resolves.toEqual({ ok: false, applied: 'kill_on_idle' })
    expect(stopSession).not.toHaveBeenCalled()
  })
})

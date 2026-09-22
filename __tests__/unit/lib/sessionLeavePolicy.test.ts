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
  it('coerces unknown settings to keep running', () => {
    expect(coerceSessionLeaveAction(undefined)).toBe('leave')
    expect(coerceSessionLeaveAction('nope')).toBe('leave')
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

  it('Keep running skips the notice for a waiting agent that got no message this visit', () => {
    const waiting = { ...live, status: 'waiting_input', promptCount: 3 }
    expect(decideSessionLeave({ session: waiting, setting: 'leave', promptsAtEntry: 3 })).toEqual({
      kind: 'none',
    })
    expect(
      decideSessionLeave({ session: { ...waiting, promptCount: 4 }, setting: 'leave', promptsAtEntry: 3 }),
    ).toEqual({ kind: 'apply', action: 'leave' })
    expect(
      decideSessionLeave({ session: { ...waiting, status: 'running' }, setting: 'leave', promptsAtEntry: 3 }),
    ).toEqual({ kind: 'apply', action: 'leave' })
    expect(decideSessionLeave({ session: waiting, setting: 'kill', promptsAtEntry: 3 })).toEqual({
      kind: 'apply',
      action: 'kill',
    })
    expect(decideSessionLeave({ session: waiting, setting: 'ask', promptsAtEntry: 3 })).toEqual({
      kind: 'prompt',
    })
    // The guard has not seen the session yet, so nothing is known about this visit.
    expect(decideSessionLeave({ session: { ...waiting, promptCount: 0 }, setting: 'leave' })).toEqual({
      kind: 'apply',
      action: 'leave',
    })
  })

  it('Keep running skips the notice once the user opted out of it', () => {
    expect(decideSessionLeave({ session: live, setting: 'leave', skipNotice: true })).toEqual({ kind: 'none' })
    expect(decideSessionLeave({ session: live, setting: 'leave', skipNotice: false })).toEqual({
      kind: 'apply',
      action: 'leave',
    })
    expect(decideSessionLeave({ session: live, setting: 'kill', skipNotice: true })).toEqual({
      kind: 'apply',
      action: 'kill',
    })
    expect(decideSessionLeave({ session: live, setting: 'ask', skipNotice: true })).toEqual({ kind: 'prompt' })
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

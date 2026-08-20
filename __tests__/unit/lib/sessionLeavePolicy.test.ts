import {
  applySessionLeaveAction,
  clearSessionLeaveInFlight,
  coerceSessionLeaveAction,
  decideSessionLeave,
  isLiveAttachedPty,
  isSessionLeaveInFlight,
  markSessionLeaveInFlight,
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

  it('maps kill / leave / hold, and hold without WS falls back to leave', () => {
    const stopSession = jest.fn()
    const sendHold = jest.fn(() => true)
    expect(applySessionLeaveAction({ action: 'kill', stopSession, sendHold })).toBe('kill')
    expect(stopSession).toHaveBeenCalled()
    expect(sendHold).not.toHaveBeenCalled()

    stopSession.mockClear()
    expect(applySessionLeaveAction({ action: 'leave', stopSession, sendHold })).toBe('leave')
    expect(stopSession).not.toHaveBeenCalled()

    expect(applySessionLeaveAction({ action: 'kill_on_idle', stopSession, sendHold })).toBe(
      'kill_on_idle',
    )
    expect(sendHold).toHaveBeenCalled()

    expect(
      applySessionLeaveAction({ action: 'kill_on_idle', stopSession, sendHold: () => false }),
    ).toBe('leave_fallback')
    expect(stopSession).not.toHaveBeenCalled()
  })

  it('treats stacked leave as one in-flight window', () => {
    clearSessionLeaveInFlight('s1')
    expect(isSessionLeaveInFlight('s1', 1_000)).toBe(false)
    markSessionLeaveInFlight('s1', 1_000)
    expect(isSessionLeaveInFlight('s1', 1_500)).toBe(true)
    expect(isSessionLeaveInFlight('s1', 3_100)).toBe(false)
  })
})

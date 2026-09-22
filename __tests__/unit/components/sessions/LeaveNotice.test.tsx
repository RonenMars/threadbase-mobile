import React from 'react'
import { AccessibilityInfo, StyleSheet } from 'react-native'
import { act, fireEvent, render, screen, within } from '@testing-library/react-native'
import { LeaveNotice } from '@/components/sessions/LeaveNotice'

type NoticeProps = React.ComponentProps<typeof LeaveNotice>

function notice(overrides: Partial<NoticeProps> = {}) {
  return (
    <LeaveNotice
      visible
      phase="idle"
      agent="Claude"
      server="Studio"
      waiting={false}
      onLeave={jest.fn()}
      onModalDismiss={jest.fn()}
      {...overrides}
    />
  )
}

async function wait(ms: number) {
  await act(async () => { jest.advanceTimersByTime(ms) })
}

// The bar is decoration to assistive tech, so it only resolves with hidden elements.
function segmentFill() {
  return screen
    .getAllByTestId('leave-notice-segment', { includeHiddenElements: true })
    .map((segment) => Math.round(parseFloat(String(StyleSheet.flatten(segment.props.style).width))))
}

beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
  jest.restoreAllMocks()
})

describe('LeaveNotice', () => {
  it('says the agent keeps running, points at the menu, then leaves after 5 seconds', async () => {
    const onLeave = jest.fn()
    await render(notice({ onLeave }))
    expect(screen.getByText('Claude is still working')).toBeTruthy()
    expect(screen.getByText('It keeps running on Studio until you end it.')).toBeTruthy()
    const hint = screen.getByTestId('leave-notice-terminate-hint')
    expect(hint).toHaveTextContent('To terminate the session, go to the menu and tap Terminate.')
    expect(within(hint).getByTestId('leave-notice-menu-icon')).toBeTruthy()
    expect(screen.queryByText(/Leaving in/)).toBeNull()
    expect(screen.getByRole('checkbox', { name: 'Skip this warning in the future' })).not.toBeChecked()
    expect(segmentFill()).toEqual([100, 100, 100, 100, 100])

    await wait(4800)
    expect(onLeave).not.toHaveBeenCalled()
    await wait(400)
    expect(onLeave).toHaveBeenCalledTimes(1)
    expect(onLeave).toHaveBeenCalledWith(false)
  })

  it('leaves right away from the X', async () => {
    const onLeave = jest.fn()
    await render(notice({ onLeave }))
    await wait(1000)
    await fireEvent.press(screen.getByRole('button', { name: 'Close' }))
    expect(onLeave).toHaveBeenCalledTimes(1)
    expect(onLeave).toHaveBeenCalledWith(false)
  })

  it('passes the ticked box on, whichever way it leaves', async () => {
    const onLeave = jest.fn()
    const { rerender } = await render(notice({ onLeave }))
    const box = () => screen.getByRole('checkbox', { name: 'Skip this warning in the future' })
    await fireEvent.press(box())
    expect(box()).toBeChecked()
    await wait(5200)
    expect(onLeave).toHaveBeenLastCalledWith(true)

    // Reopening starts unticked again.
    await rerender(notice({ onLeave, visible: false }))
    await rerender(notice({ onLeave }))
    expect(box()).not.toBeChecked()
    await fireEvent.press(box())
    await fireEvent.press(screen.getByRole('button', { name: 'Close' }))
    expect(onLeave).toHaveBeenLastCalledWith(true)

    await rerender(notice({ onLeave, visible: false }))
    await rerender(notice({ onLeave }))
    await fireEvent.press(box())
    await fireEvent.press(box())
    await fireEvent.press(screen.getByRole('button', { name: 'Close' }))
    expect(onLeave).toHaveBeenLastCalledWith(false)
  })

  it('freezes the timer and the bar while the screen is held, and continues on release', async () => {
    const onLeave = jest.fn()
    await render(notice({ onLeave }))
    await wait(2500)
    await fireEvent(screen.getByTestId('leave-notice'), 'pressIn')
    // Halfway: the last two segments have drained and the middle one is half gone.
    const frozen = segmentFill()
    expect(frozen[0]).toBe(100)
    expect(frozen[1]).toBe(100)
    expect(frozen[2]).toBeGreaterThan(30)
    expect(frozen[2]).toBeLessThan(70)
    expect(frozen[3]).toBe(0)
    expect(frozen[4]).toBe(0)
    await wait(10000)
    expect(segmentFill()).toEqual(frozen)
    expect(onLeave).not.toHaveBeenCalled()

    await fireEvent(screen.getByTestId('leave-notice'), 'pressOut')
    await wait(2300)
    expect(onLeave).not.toHaveBeenCalled()
    await wait(400)
    expect(onLeave).toHaveBeenCalledTimes(1)
  })

  it('reopens with the full 5 seconds', async () => {
    const onLeave = jest.fn()
    const { rerender } = await render(notice({ onLeave }))
    await wait(2000)
    await rerender(notice({ onLeave, visible: false }))
    await rerender(notice({ onLeave }))
    await wait(4800)
    expect(onLeave).not.toHaveBeenCalled()
    await wait(400)
    expect(onLeave).toHaveBeenCalledTimes(1)
  })

  it('stays up without counting while the leave is pending', async () => {
    const onLeave = jest.fn()
    await render(notice({ onLeave, visible: false, phase: 'pending' }))
    expect(screen.getByTestId('leave-notice')).toBeTruthy()
    await wait(10000)
    expect(onLeave).not.toHaveBeenCalled()
  })

  it('waits for the X instead of counting while a screen reader runs', async () => {
    jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(true)
    const onLeave = jest.fn()
    await render(notice({ onLeave }))
    await act(async () => {})
    expect(screen.queryByTestId('leave-notice-segment', { includeHiddenElements: true })).toBeNull()
    await wait(10000)
    expect(onLeave).not.toHaveBeenCalled()

    const close = screen.getByRole('button', { name: 'Close' })
    expect(close.props.accessibilityHint).toBe('Double-tap to leave the session.')
    await fireEvent.press(close)
    expect(onLeave).toHaveBeenCalledTimes(1)
  })
})

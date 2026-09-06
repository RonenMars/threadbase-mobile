/**
 * The banner shown on a session the streamer discovered but does not own.
 *
 * Take-over is destructive — the server SIGTERMs the process in the user's
 * terminal — so these are weighted toward the confirmation being real: a tap
 * alone must not act, and a cancel must leave the session alone.
 */
import { Alert } from 'react-native'
import { fireEvent } from '@testing-library/react-native'
import { ExternalSessionBanner } from '@/components/sessions/ExternalSessionBanner'
import { renderWithI18n } from '@/test-utils/render'

type AlertButton = { text?: string; style?: string; onPress?: () => void }

/** The buttons handed to the most recent Alert.alert call. */
function alertButtons(spy: jest.SpyInstance): AlertButton[] {
  return (spy.mock.calls.at(-1)?.[2] ?? []) as AlertButton[]
}

describe('ExternalSessionBanner', () => {
  let alertSpy: jest.SpyInstance

  beforeEach(() => {
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
  })

  afterEach(() => {
    alertSpy.mockRestore()
  })

  it('says the session was launched outside Threadbase', async () => {
    const { getByText } = await renderWithI18n(<ExternalSessionBanner onTakeOver={jest.fn()} />)

    expect(getByText('Launched outside Threadbase')).toBeTruthy()
    expect(getByText("Streaming output only — prompts can't be answered from here.")).toBeTruthy()
  })

  // The whole safety property: the tap opens a question, it does not act.
  it('does not take over on the tap alone', async () => {
    const onTakeOver = jest.fn()
    const { getByTestId } = await renderWithI18n(
      <ExternalSessionBanner onTakeOver={onTakeOver} />,
    )

    fireEvent.press(getByTestId('external-session-take-over'))

    expect(alertSpy).toHaveBeenCalled()
    expect(onTakeOver).not.toHaveBeenCalled()
  })

  it('takes over once the confirmation is accepted', async () => {
    const onTakeOver = jest.fn()
    const { getByTestId } = await renderWithI18n(
      <ExternalSessionBanner onTakeOver={onTakeOver} />,
    )

    fireEvent.press(getByTestId('external-session-take-over'))
    alertButtons(alertSpy)
      .find((b) => b.style === 'destructive')
      ?.onPress?.()

    expect(onTakeOver).toHaveBeenCalledTimes(1)
  })

  it('leaves the session alone when the confirmation is cancelled', async () => {
    const onTakeOver = jest.fn()
    const { getByTestId } = await renderWithI18n(
      <ExternalSessionBanner onTakeOver={onTakeOver} />,
    )

    fireEvent.press(getByTestId('external-session-take-over'))
    alertButtons(alertSpy)
      .find((b) => b.style === 'cancel')
      ?.onPress?.()

    expect(onTakeOver).not.toHaveBeenCalled()
  })

  // The confirmation has to name what is destroyed. "Restart" would read as
  // harmless; the process being killed is the one in the user's terminal.
  it('warns that the terminal process is stopped', async () => {
    const { getByTestId } = await renderWithI18n(<ExternalSessionBanner onTakeOver={jest.fn()} />)

    fireEvent.press(getByTestId('external-session-take-over'))

    expect(String(alertSpy.mock.calls.at(-1)?.[1] ?? '')).toMatch(/terminal/i)
  })

  it('cannot be tapped twice while the take-over is in flight', async () => {
    const onTakeOver = jest.fn()
    const { getByTestId } = await renderWithI18n(
      <ExternalSessionBanner onTakeOver={onTakeOver} isTakingOver />,
    )

    fireEvent.press(getByTestId('external-session-take-over'))

    expect(alertSpy).not.toHaveBeenCalled()
    expect(onTakeOver).not.toHaveBeenCalled()
  })
})

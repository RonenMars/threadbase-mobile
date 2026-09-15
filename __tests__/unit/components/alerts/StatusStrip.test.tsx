import { act } from '@testing-library/react-native'
import { HomeStatusStrip, STATUS_STRIP_DURATION_MS } from '@/components/alerts/StatusStrip'
import { useAlertStore } from '@/stores/alerts'
import { useErrorSheetStore } from '@/stores/errorSheet'
import { renderWithI18n } from '@/test-utils/render'
import { serverCause } from '@/types/alerts'

beforeEach(() => {
  jest.useFakeTimers()
  useAlertStore.getState().reset()
  useErrorSheetStore.setState({ open: false })
})

afterEach(() => {
  jest.useRealTimers()
})

describe('HomeStatusStrip', () => {
  it('shows a new error for 6s then collapses', async () => {
    useAlertStore.getState().upsert({
      id: 'a',
      cause: serverCause('a'),
      level: 'error',
      title: "Can't reach Studio",
      message: 'body',
      timeout: null,
    })
    const { getByTestId, getByText, queryByTestId } = await renderWithI18n(
      <HomeStatusStrip onPress={() => {}} />,
    )
    getByTestId('status-strip')
    getByText("Can't reach Studio")

    await act(async () => {
      jest.advanceTimersByTime(STATUS_STRIP_DURATION_MS)
    })
    expect(queryByTestId('status-strip')).toBeNull()
  })

  it('hides while the recovery sheet is open', async () => {
    useErrorSheetStore.setState({ open: true })
    useAlertStore.getState().upsert({
      id: 'a',
      cause: serverCause('a'),
      level: 'error',
      title: "Can't reach Studio",
      message: 'body',
      timeout: null,
    })
    const { queryByTestId } = await renderWithI18n(
      <HomeStatusStrip onPress={() => {}} />,
    )
    expect(queryByTestId('status-strip')).toBeNull()
  })

  it('does not expand for a warning', async () => {
    useAlertStore.getState().upsert({
      id: 'w',
      cause: 'host-pressure:a',
      level: 'warning',
      title: 'Host under load',
      message: 'body',
      timeout: null,
    })
    const { queryByTestId } = await renderWithI18n(
      <HomeStatusStrip onPress={() => {}} />,
    )
    expect(queryByTestId('status-strip')).toBeNull()
  })
})

import { fireEvent } from '@testing-library/react-native'
import { HomeStatusPill, StatusPill } from '@/components/alerts/StatusPill'
import { useAlertStore } from '@/stores/alerts'
import { useErrorSheetStore } from '@/stores/errorSheet'
import { renderWithI18n } from '@/test-utils/render'
import { serverCause } from '@/types/alerts'

beforeEach(() => {
  useAlertStore.getState().reset()
})

describe('StatusPill', () => {
  it('labels a single error as 1 issue', async () => {
    const onPress = jest.fn()
    const { getByTestId, getByLabelText } = await renderWithI18n(
      <StatusPill surface="error" issueCount={1} onPress={onPress} />,
    )
    getByLabelText('Error. 1 issue')
    fireEvent.press(getByTestId('status-pill'))
    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it('labels a warning as Degraded', async () => {
    const { getByLabelText } = await renderWithI18n(
      <StatusPill surface="warning" issueCount={0} onPress={() => {}} />,
    )
    getByLabelText('Warning. Degraded')
  })
})

describe('HomeStatusPill', () => {
  it('shows the server-status globe, not the bell, when there are no alerts', async () => {
    useErrorSheetStore.setState({ serversStatusOpen: false })
    const { queryByTestId, getByTestId } = await renderWithI18n(
      <HomeStatusPill onPress={() => {}} />,
    )
    expect(queryByTestId('status-pill')).toBeNull()
    fireEvent.press(getByTestId('header-server-status-btn'))
    expect(useErrorSheetStore.getState().serversStatusOpen).toBe(true)
  })

  it('shows the globe instead of the bell when alerts are suppressed', async () => {
    useAlertStore.getState().upsert({
      id: 'a',
      cause: serverCause('a'),
      level: 'error',
      title: 'A down',
      message: 'body',
      timeout: null,
    })
    const { queryByTestId } = await renderWithI18n(
      <HomeStatusPill onPress={() => {}} suppressAlerts />,
    )
    expect(queryByTestId('status-pill')).toBeNull()
    expect(queryByTestId('header-server-status-btn')).toBeTruthy()
  })

  it('shows the bell with a badge for a warning', async () => {
    useAlertStore.getState().upsert({
      id: 'w',
      cause: serverCause('w'),
      level: 'warning',
      title: 'Slow',
      message: 'body',
      timeout: null,
    })
    const { getByTestId, queryByTestId } = await renderWithI18n(
      <HomeStatusPill onPress={() => {}} />,
    )
    expect(getByTestId('status-pill-badge')).toBeTruthy()
    expect(queryByTestId('header-server-status-btn')).toBeNull()
  })

  it('hides an info-only store', async () => {
    useAlertStore.getState().upsert({
      id: 'info',
      cause: serverCause('a'),
      level: 'info',
      title: 'Connecting',
      message: 'body',
    })
    const { queryByTestId } = await renderWithI18n(
      <HomeStatusPill onPress={() => {}} />,
    )
    expect(queryByTestId('status-pill')).toBeNull()
  })

  it('hides a claimed error cause', async () => {
    useAlertStore.getState().upsert({
      id: 'a',
      cause: serverCause('a'),
      level: 'error',
      title: 'A down',
      message: 'body',
      timeout: null,
    })
    useAlertStore.getState().claimInline(serverCause('a'))
    const { queryByTestId } = await renderWithI18n(
      <HomeStatusPill onPress={() => {}} />,
    )
    expect(queryByTestId('status-pill')).toBeNull()
  })

  it('counts distinct error causes', async () => {
    useAlertStore.getState().upsert({
      id: 'a',
      cause: serverCause('a'),
      level: 'error',
      title: 'A down',
      message: 'body',
      timeout: null,
    })
    useAlertStore.getState().upsert({
      id: 'b',
      cause: serverCause('b'),
      level: 'error',
      title: 'B down',
      message: 'body',
      timeout: null,
    })
    const { getByLabelText } = await renderWithI18n(
      <HomeStatusPill onPress={() => {}} />,
    )
    getByLabelText('Error. 2 issues')
  })
})

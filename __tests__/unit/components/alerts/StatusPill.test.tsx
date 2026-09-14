import { fireEvent } from '@testing-library/react-native'
import { HomeStatusPill, StatusPill } from '@/components/alerts/StatusPill'
import { useAlertStore } from '@/stores/alerts'
import { renderWithI18n } from '@/test-utils/render'
import { serverCause } from '@/types/alerts'

beforeEach(() => {
  useAlertStore.getState().reset()
})

describe('StatusPill', () => {
  it('labels a single error as 1 issue', async () => {
    const onPress = jest.fn()
    const { getByTestId, getByText, getByLabelText } = await renderWithI18n(
      <StatusPill surface="error" issueCount={1} onPress={onPress} />,
    )
    getByText('1 issue')
    getByLabelText('Error. 1 issue')
    fireEvent.press(getByTestId('status-pill'))
    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it('labels a warning as Degraded', async () => {
    const { getByText, getByLabelText } = await renderWithI18n(
      <StatusPill surface="warning" issueCount={0} onPress={() => {}} />,
    )
    getByText('Degraded')
    getByLabelText('Warning. Degraded')
  })
})

describe('HomeStatusPill', () => {
  it('hides when there are no alerts', async () => {
    const { queryByTestId } = await renderWithI18n(
      <HomeStatusPill onPress={() => {}} />,
    )
    expect(queryByTestId('status-pill')).toBeNull()
  })

  it('hides an info-only store', async () => {
    useAlertStore.getState().upsert({
      id: 'info',
      viewport: 'home',
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

  it('counts distinct error causes', async () => {
    useAlertStore.getState().upsert({
      id: 'a',
      viewport: 'home',
      cause: serverCause('a'),
      level: 'error',
      title: 'A down',
      message: 'body',
      timeout: null,
    })
    useAlertStore.getState().upsert({
      id: 'b',
      viewport: 'home',
      cause: serverCause('b'),
      level: 'error',
      title: 'B down',
      message: 'body',
      timeout: null,
    })
    const { getByText } = await renderWithI18n(
      <HomeStatusPill onPress={() => {}} />,
    )
    getByText('2 issues')
  })
})

import { fireEvent } from '@testing-library/react-native'
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils'
import { StatusRow } from '@/components/alerts/StatusRow'
import { useAlertStore } from '@/stores/alerts'
import { renderWithI18n } from '@/test-utils/render'
import { serverCause } from '@/types/alerts'

function seed(onClose?: () => void) {
  useAlertStore.getState().upsert({
    id: 'a',
    cause: serverCause('a'),
    level: 'error',
    title: 'A down',
    message: 'body',
    timeout: null,
    onClose,
  })
  return useAlertStore.getState().alerts[0]
}

beforeEach(() => {
  useAlertStore.getState().reset()
})

describe('StatusRow dismissal', () => {
  it('dismisses through the X button', async () => {
    const onClose = jest.fn()
    const { getByTestId } = await renderWithI18n(<StatusRow entry={seed(onClose)} />)
    fireEvent.press(getByTestId('status-row-dismiss-a'))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(useAlertStore.getState().alerts).toHaveLength(0)
  })

  it.each([
    ['left', -200],
    ['right', 200],
  ])('dismisses on a %s swipe', async (_dir, translationX) => {
    await renderWithI18n(<StatusRow entry={seed()} />)
    fireGestureHandler(getByGestureTestId('status-row-swipe-a'), [
      { translationX: 0 },
      { translationX },
      { translationX, state: 5 },
    ])
    expect(useAlertStore.getState().alerts).toHaveLength(0)
  })

  it('keeps the row on a short swipe', async () => {
    await renderWithI18n(<StatusRow entry={seed()} />)
    fireGestureHandler(getByGestureTestId('status-row-swipe-a'), [
      { translationX: 0 },
      { translationX: 20 },
      { translationX: 20, state: 5 },
    ])
    expect(useAlertStore.getState().alerts).toHaveLength(1)
  })
})

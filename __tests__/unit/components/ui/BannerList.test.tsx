import { fireEvent } from '@testing-library/react-native'
import { Banner } from '@/components/ui/Banner'
import { renderWithI18n } from '@/test-utils/render'

function makeItems() {
  return [
    {
      id: 'conversations',
      title: 'History failed to load',
      message: 'History did not come through.',
      code: 'HTTP 503',
      buttonText: 'Retry',
      buttonAction: jest.fn(),
    },
    {
      id: 'sessions',
      title: 'Sessions failed to load',
      message: 'Sessions refused to load.',
      buttonText: 'Retry',
      buttonAction: jest.fn(),
    },
  ]
}

describe('Banner with items', () => {
  it('lists every failure at once and expands one row at a time', async () => {
    const { getByText, queryByText, getByTestId, findByText } = await renderWithI18n(
      <Banner title="Something went wrong" message="ignored" accent="#f85149" items={makeItems()} />,
    )

    // Both failures are on screen together — no "1 of N" sequence to click through.
    getByText('History failed to load')
    getByText('Sessions failed to load')
    expect(queryByText('HTTP 503')).toBeNull()

    fireEvent.press(getByTestId('banner-row-conversations'))
    await findByText('HTTP 503')

    fireEvent.press(getByTestId('banner-row-sessions'))
    await findByText('Sessions refused to load.')
    expect(queryByText('HTTP 503')).toBeNull()
  })

  it('keeps a long list scrolling inside the card instead of growing it', async () => {
    const many = Array.from({ length: 68 }, (_, i) => ({
      id: `s${i}`,
      title: `server-${i}`,
      message: 'unreachable',
    }))
    const { toJSON } = await renderWithI18n(
      <Banner title="Something went wrong" message="ignored" accent="#f85149" items={many} />,
    )

    const tree = JSON.stringify(toJSON())
    expect(tree).toContain('"maxHeight":"50%"')
    expect(tree).toContain('"overflow":"hidden"')
  })

  it('retries only the row that was pressed', async () => {
    const items = makeItems()
    const { getByTestId, findByTestId } = await renderWithI18n(
      <Banner title="Something went wrong" message="ignored" accent="#f85149" items={items} />,
    )

    fireEvent.press(getByTestId('banner-row-sessions'))
    fireEvent.press(await findByTestId('banner-row-retry-sessions'))

    expect(items[1].buttonAction).toHaveBeenCalledTimes(1)
    expect(items[0].buttonAction).not.toHaveBeenCalled()
  })
})

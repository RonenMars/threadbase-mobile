import { render } from '@testing-library/react-native'

import { HeaderBrandMark } from '@/components/shared/HeaderBrandMark'

describe('HeaderBrandMark', () => {
  it('shows the store icon without a QA label', async () => {
    const screen = await render(<HeaderBrandMark qa={false} />)

    expect(screen.getByTestId('header-brand-icon')).toBeTruthy()
    expect(screen.queryByTestId('header-qa-mark')).toBeNull()
    expect(screen.queryByText('QA')).toBeNull()
  })

  it('shows a yellow-orange-gray mark and a QA label for the QA app', async () => {
    const screen = await render(<HeaderBrandMark qa />)

    expect(screen.getByTestId('header-qa-mark')).toBeTruthy()
    expect(screen.getByTestId('header-qa-label')).toHaveTextContent('QA')
    expect(screen.queryByTestId('header-brand-icon')).toBeNull()
  })
})

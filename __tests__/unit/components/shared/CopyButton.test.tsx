import { act, fireEvent } from '@testing-library/react-native'
import * as Clipboard from 'expo-clipboard'
import { CopyButton } from '@/components/shared/CopyButton'
import { renderWithI18n } from '@/test-utils/render'

jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn().mockResolvedValue(true) }))

describe('CopyButton', () => {
  it('copies the value on press', async () => {
    const { getByTestId } = await renderWithI18n(
      <CopyButton value="c969cf5" accessibilityLabel="Copy sha" testID="copy" />,
    )
    await act(async () => {
      fireEvent.press(getByTestId('copy'))
    })
    expect(Clipboard.setStringAsync).toHaveBeenCalledWith('c969cf5')
  })
})

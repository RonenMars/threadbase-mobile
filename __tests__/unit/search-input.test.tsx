import React, { useState } from 'react'
import { fireEvent, render } from '@testing-library/react-native'
import '@/test-utils/i18n-setup'
import { SearchInput } from '@/components/shared/SearchInput'

function Harness({ initial }: { initial: string }) {
  const [text, setText] = useState(initial)
  return <SearchInput testID="field" value={text} onChangeText={setText} />
}

describe('SearchInput', () => {
  it('hides the clear button while the field is empty', async () => {
    const { queryByTestId } = await render(<Harness initial="" />)
    expect(queryByTestId('search-input-clear')).toBeNull()
  })

  it('shows the clear button whenever there is text and clears on press', async () => {
    const { getByTestId, queryByTestId } = await render(<Harness initial="abc" />)
    await fireEvent.press(getByTestId('search-input-clear'))
    expect(getByTestId('field').props.value).toBe('')
    expect(queryByTestId('search-input-clear')).toBeNull()
  })
})

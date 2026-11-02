import React from 'react'
import { fireEvent, render } from '@testing-library/react-native'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { ProviderSelector } from '@/components/browse/ProviderSelector'

const options = [
  { value: 'claude', label: 'Claude', color: '#d97757', unavailable: false },
  { value: 'codex', label: 'Codex', color: '#10a37f', unavailable: false },
]

const layout = (width: number) => ({ nativeEvent: { layout: { width, height: 40, x: 0, y: 0 } } })

async function setup(containerWidth: number, naturalWidth: number) {
  const onSelect = jest.fn()
  const utils = await render(
    <ThemeProvider>
      <ProviderSelector options={options} selected="claude" onSelect={onSelect} />
    </ThemeProvider>,
  )
  await fireEvent(utils.getByTestId('provider-selector'), 'layout', layout(containerWidth))
  await fireEvent(utils.getByTestId('provider-selector-measurer', { includeHiddenElements: true }), 'layout', layout(naturalWidth))
  return { ...utils, onSelect }
}

describe('ProviderSelector', () => {
  it('stays on one row while the options fit', async () => {
    const { queryByTestId, getByTestId } = await setup(400, 200)
    expect(queryByTestId('start-provider-dropdown')).toBeNull()
    expect(getByTestId('start-provider-codex')).toBeTruthy()
  })

  it('collapses to a dropdown when the options are wider than the container', async () => {
    const { getByTestId, queryByTestId, onSelect } = await setup(300, 400)
    expect(queryByTestId('start-provider-codex')).toBeNull()
    await fireEvent.press(getByTestId('start-provider-dropdown'))
    await fireEvent.press(getByTestId('start-provider-codex'))
    expect(onSelect).toHaveBeenCalledWith('codex')
    expect(queryByTestId('start-provider-codex')).toBeNull()
  })
})

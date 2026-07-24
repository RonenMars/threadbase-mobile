import React from 'react'
import { Text } from 'react-native'
import { render, fireEvent } from '@testing-library/react-native'
import { RenderErrorBoundary } from '@/components/RenderErrorBoundary'

jest.mock('@/services/sentry', () => ({
  captureHandledError: jest.fn(),
}))

function Boom(): React.ReactElement {
  throw new Error('boom-render')
}

describe('RenderErrorBoundary', () => {
  let consoleSpy: jest.SpyInstance

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => {
    consoleSpy.mockRestore()
  })

  it('contains a child render error and shows fallback', async () => {
    const { getByTestId, getByText } = await render(
      <RenderErrorBoundary rawFallback="raw line text" tag="test">
        <Boom />
      </RenderErrorBoundary>,
    )
    expect(getByTestId('render-error-fallback')).toBeTruthy()
    expect(getByText(/raw line text/)).toBeTruthy()
  })

  it('retries after a contained failure', async () => {
    let shouldThrow = true
    function Flaky() {
      if (shouldThrow) throw new Error('once')
      return <Text>recovered</Text>
    }
    const { getByTestId, getByText, rerender } = await render(
      <RenderErrorBoundary>
        <Flaky />
      </RenderErrorBoundary>,
    )
    expect(getByTestId('render-error-fallback')).toBeTruthy()
    shouldThrow = false
    fireEvent.press(getByText('Retry'))
    await rerender(
      <RenderErrorBoundary>
        <Flaky />
      </RenderErrorBoundary>,
    )
    expect(getByText('recovered')).toBeTruthy()
  })
})

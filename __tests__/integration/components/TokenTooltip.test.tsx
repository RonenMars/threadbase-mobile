import React from 'react'
import { render, fireEvent } from '@testing-library/react-native'
import { InfoTooltip } from '@/components/onboarding/components/InfoTooltip'

describe('InfoTooltip', () => {
  it('does not show tooltip body initially', async () => {
    const { queryByTestId } = await render(<InfoTooltip>Some info</InfoTooltip>)
    expect(queryByTestId('info-tooltip-body')).toBeNull()
  })

  it('shows tooltip body when trigger is pressed', async () => {
    const { getByTestId } = await render(<InfoTooltip>Some info</InfoTooltip>)
    await fireEvent.press(getByTestId('info-tooltip-trigger'))
    expect(getByTestId('info-tooltip-body')).toBeTruthy()
  })

  it('hides tooltip when Got it is pressed', async () => {
    const { getByTestId, getByText, queryByTestId } = await render(<InfoTooltip>Some info</InfoTooltip>)
    await fireEvent.press(getByTestId('info-tooltip-trigger'))
    await fireEvent.press(getByText('Got it'))
    expect(queryByTestId('info-tooltip-body')).toBeNull()
  })

  it('renders link when linkLabel and linkUrl are provided', async () => {
    const { getByTestId, getByText } = await render(
      <InfoTooltip linkLabel="Learn more" linkUrl="https://example.com">Some info</InfoTooltip>
    )
    await fireEvent.press(getByTestId('info-tooltip-trigger'))
    expect(getByText('Learn more')).toBeTruthy()
  })
})

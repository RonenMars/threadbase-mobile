import React from 'react'
import { render, fireEvent } from '@testing-library/react-native'
import { InfoTooltip } from '@/components/onboarding/components/InfoTooltip'

describe('InfoTooltip', () => {
  it('does not show tooltip body initially', () => {
    const { queryByTestId } = render(<InfoTooltip>Some info</InfoTooltip>)
    expect(queryByTestId('info-tooltip-body')).toBeNull()
  })

  it('shows tooltip body when trigger is pressed', () => {
    const { getByTestId } = render(<InfoTooltip>Some info</InfoTooltip>)
    fireEvent.press(getByTestId('info-tooltip-trigger'))
    expect(getByTestId('info-tooltip-body')).toBeTruthy()
  })

  it('hides tooltip when Got it is pressed', () => {
    const { getByTestId, getByText, queryByTestId } = render(<InfoTooltip>Some info</InfoTooltip>)
    fireEvent.press(getByTestId('info-tooltip-trigger'))
    fireEvent.press(getByText('Got it'))
    expect(queryByTestId('info-tooltip-body')).toBeNull()
  })

  it('renders link when linkLabel and linkUrl are provided', () => {
    const { getByTestId, getByText } = render(
      <InfoTooltip linkLabel="Learn more" linkUrl="https://example.com">Some info</InfoTooltip>
    )
    fireEvent.press(getByTestId('info-tooltip-trigger'))
    expect(getByText('Learn more →')).toBeTruthy()
  })
})

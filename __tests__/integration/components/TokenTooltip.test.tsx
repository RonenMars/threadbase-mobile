import React from 'react'
import { render, fireEvent } from '@testing-library/react-native'
import { TokenTooltip } from '@/components/onboarding/components/TokenTooltip'

describe('TokenTooltip', () => {
  it('does not show tooltip body initially', () => {
    const { queryByTestId } = render(<TokenTooltip />)
    expect(queryByTestId('token-tooltip-body')).toBeNull()
  })

  it('shows tooltip body when trigger is pressed', () => {
    const { getByTestId } = render(<TokenTooltip />)
    fireEvent.press(getByTestId('token-tooltip-trigger'))
    expect(getByTestId('token-tooltip-body')).toBeTruthy()
  })

  it('hides tooltip when Got it is pressed', () => {
    const { getByTestId, getByText, queryByTestId } = render(<TokenTooltip />)
    fireEvent.press(getByTestId('token-tooltip-trigger'))
    fireEvent.press(getByText('Got it'))
    expect(queryByTestId('token-tooltip-body')).toBeNull()
  })
})

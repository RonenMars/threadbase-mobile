import React from 'react'
import { fireEvent, render } from '@testing-library/react-native'
import { ServerNameStep } from '@/components/onboarding/steps/ServerNameStep'

describe('ServerNameStep', () => {
  it('renders headline, input, CTA, and skip controls', () => {
    const { getByText, getByTestId } = render(
      <ServerNameStep value="" onSubmit={jest.fn()} />,
    )
    expect(getByText('Name your server.')).toBeTruthy()
    expect(getByTestId('onboarding-server-name-input')).toBeTruthy()
    expect(getByTestId('onboarding-server-name-cta')).toBeTruthy()
    expect(getByTestId('onboarding-server-name-skip')).toBeTruthy()
  })

  it('pre-fills the input with the provided value', () => {
    const { getByTestId } = render(
      <ServerNameStep value="Work Mac" onSubmit={jest.fn()} />,
    )
    expect(getByTestId('onboarding-server-name-input').props.value).toBe('Work Mac')
  })

  it('submits the trimmed name when CTA is pressed', () => {
    const onSubmit = jest.fn()
    const { getByTestId } = render(
      <ServerNameStep value="" onSubmit={onSubmit} />,
    )
    fireEvent.changeText(getByTestId('onboarding-server-name-input'), '  Home Server  ')
    fireEvent.press(getByTestId('onboarding-server-name-cta'))
    expect(onSubmit).toHaveBeenCalledWith('Home Server')
  })

  it('submits an empty string when CTA is pressed with no input', () => {
    const onSubmit = jest.fn()
    const { getByTestId } = render(
      <ServerNameStep value="" onSubmit={onSubmit} />,
    )
    fireEvent.press(getByTestId('onboarding-server-name-cta'))
    expect(onSubmit).toHaveBeenCalledWith('')
  })

  it('submits an empty string when Skip is pressed, even if user typed a name', () => {
    const onSubmit = jest.fn()
    const { getByTestId } = render(
      <ServerNameStep value="" onSubmit={onSubmit} />,
    )
    fireEvent.changeText(getByTestId('onboarding-server-name-input'), 'Discarded')
    fireEvent.press(getByTestId('onboarding-server-name-skip'))
    expect(onSubmit).toHaveBeenCalledWith('')
  })
})

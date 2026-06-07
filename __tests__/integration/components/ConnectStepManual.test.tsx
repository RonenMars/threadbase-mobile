import React from 'react'
import { render, fireEvent } from '@testing-library/react-native'
import { ConnectStep } from '@/components/onboarding/steps/ConnectStep'

const mockPair = jest.fn()
jest.mock('@/hooks/useTBPair', () => ({
  useTBPair: () => ({ phase: 'idle', log: [], pair: mockPair }),
}))

jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn(),
}))

describe('ConnectStep – manual mode', () => {
  it('shows "Type / paste manually" card in choose mode', () => {
    const { getByText } = render(
      <ConnectStep onPaired={jest.fn()} onAdvance={jest.fn()} />
    )
    expect(getByText('Type / paste manually')).toBeTruthy()
  })

  it('shows "On your Mac" section header in manual mode', () => {
    const { getByText } = render(
      <ConnectStep onPaired={jest.fn()} onAdvance={jest.fn()} />
    )
    fireEvent.press(getByText('Type / paste manually'))
    expect(getByText('On your Mac')).toBeTruthy()
  })

  it('shows copyable tb pair command in manual mode', () => {
    const { getByText } = render(
      <ConnectStep onPaired={jest.fn()} onAdvance={jest.fn()} />
    )
    fireEvent.press(getByText('Type / paste manually'))
    expect(getByText(/tb pair/)).toBeTruthy()
  })

  it('shows "Server URL" and "Token" field labels (not faux-shell labels)', () => {
    const { getByText, queryByText } = render(
      <ConnectStep onPaired={jest.fn()} onAdvance={jest.fn()} />
    )
    fireEvent.press(getByText('Type / paste manually'))
    expect(getByText('Server URL')).toBeTruthy()
    expect(getByText('Token')).toBeTruthy()
    expect(queryByText(/\$ tb pair --server/)).toBeNull()
    expect(queryByText(/\$ tb pair --token/)).toBeNull()
  })

  it('CTA shows "Connect" not "Open handshake"', () => {
    const { getByText, queryByText } = render(
      <ConnectStep onPaired={jest.fn()} onAdvance={jest.fn()} />
    )
    fireEvent.press(getByText('Type / paste manually'))
    expect(getByText('Connect')).toBeTruthy()
    expect(queryByText('Open handshake')).toBeNull()
  })
})

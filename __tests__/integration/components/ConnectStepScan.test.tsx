/**
 * ConnectStep — camera-scan `publicUrl` parity (#904)
 *
 * `app/pair.tsx`'s `commitPending` forwards `publicUrl` from the exchange
 * result into `addServer`. `ConnectStep.commitScan` (the onboarding QR-scan
 * path) did not, so the same authenticated field survived one pairing path
 * and was silently dropped on the other. This test drives the real
 * `commitScan` through a captured `PairScannerModal.onSuccess` callback and
 * asserts the two paths agree.
 */
import React from 'react'
import { act, fireEvent, render } from '@testing-library/react-native'
import { ConnectStep } from '@/components/onboarding/steps/ConnectStep'
import type { PairResult } from '@/hooks/useTBPair'
import type { ExchangeResult } from '@/services/pair-exchange'

let capturedOnSuccess: ((result: ExchangeResult) => void) | null = null

interface ScannerProps {
  visible: boolean
  onClose: () => void
  onSuccess: (result: ExchangeResult) => void
}

jest.mock('@/components/pair/PairScannerModal', () => ({
  PairScannerModal: (props: ScannerProps) => {
    capturedOnSuccess = props.onSuccess
    return null
  },
}))

jest.mock('@/hooks/useTBPair', () => ({
  useTBPair: () => ({
    phase: 'idle',
    log: [],
    error: null,
    pair: jest.fn(),
    reset: jest.fn(),
  }),
}))

// No `serverPublicKey` means this is a legacy/non-e2ee QR, so
// `handleScanSuccess` skips the camera-identity confirm gate and calls
// `commitScan` directly.
const SCAN_FIXTURE: ExchangeResult = {
  url: 'http://192.168.1.20:8766',
  apiKey: 'tb_scan_key',
  publicUrl: 'https://public.example.test',
  machineName: 'scan-machine',
  deviceId: 'device-1',
  deviceToken: 'device-token-1',
  capabilities: null,
  serverPublicKey: null,
  e2eeRequired: false,
}

describe('ConnectStep – camera-scan publicUrl parity', () => {
  beforeEach(() => {
    capturedOnSuccess = null
  })

  it('forwards publicUrl from the scan result into onPaired, matching app/pair.tsx', async () => {
    const onPaired = jest.fn<void, [PairResult]>()
    const onAdvance = jest.fn()

    const { getByText } = await render(
      <ConnectStep onPaired={onPaired} onAdvance={onAdvance} />,
    )
    // Entering qr-explain mode renders (the mocked) PairScannerModal, which
    // captures its onSuccess prop — no need to also press "Open camera".
    await fireEvent.press(getByText('Scan QR'))

    expect(capturedOnSuccess).not.toBeNull()
    act(() => {
      capturedOnSuccess?.(SCAN_FIXTURE)
    })

    expect(onPaired).toHaveBeenCalledTimes(1)
    expect(onPaired.mock.calls[0][0]).toEqual(
      expect.objectContaining({ publicUrl: SCAN_FIXTURE.publicUrl }),
    )
    expect(onAdvance).toHaveBeenCalledTimes(1)
  })
})

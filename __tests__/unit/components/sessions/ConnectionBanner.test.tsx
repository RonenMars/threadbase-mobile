import { ConnectionBanner } from '@/components/sessions/ConnectionBanner'
import { renderWithI18n } from '@/test-utils/render'

describe('ConnectionBanner', () => {
  it('renders the reconnecting variant', () => {
    const { getByText } = renderWithI18n(<ConnectionBanner variant="reconnecting" />)
    expect(getByText('Reconnecting…')).toBeTruthy()
    expect(getByText('Connection lost — the content below may be stale.')).toBeTruthy()
  })

  it('renders the stalled variant', () => {
    const { getByText } = renderWithI18n(<ConnectionBanner variant="stalled" />)
    expect(getByText('Stream stalled')).toBeTruthy()
    expect(getByText('Connected, but no output has arrived for a while.')).toBeTruthy()
  })
})

import { render } from '@testing-library/react-native'
import { LiveSessionsHeader } from '@/components/sessions/LiveSessionsHeader'

describe('LiveSessionsHeader', () => {
  it('renders LIVE label when at least one session is live', () => {
    const { getByText } = render(<LiveSessionsHeader count={2} hasLive={true} />)
    expect(getByText('LIVE · 2')).toBeTruthy()
  })

  it('renders IDLE label when no sessions are live', () => {
    const { getByText } = render(<LiveSessionsHeader count={3} hasLive={false} />)
    expect(getByText('IDLE · 3')).toBeTruthy()
  })

  it('reflects the session count in the label', () => {
    const { getByText } = render(<LiveSessionsHeader count={1} hasLive={true} />)
    expect(getByText('LIVE · 1')).toBeTruthy()
  })

  it('exposes a header role with label for accessibility', () => {
    const { getByLabelText } = render(<LiveSessionsHeader count={1} hasLive={true} />)
    expect(getByLabelText('LIVE · 1')).toBeTruthy()
  })
})

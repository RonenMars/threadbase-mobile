import { render } from '@testing-library/react-native'
import { LiveSessionsHeader } from '@/components/sessions/LiveSessionsHeader'

describe('LiveSessionsHeader', () => {
  it('renders LIVE label when at least one session is live', async () => {
    const { getByText } = await render(<LiveSessionsHeader count={2} hasLive={true} />)
    expect(getByText('LIVE · 2')).toBeTruthy()
  })

  it('renders IDLE label when no sessions are live', async () => {
    const { getByText } = await render(<LiveSessionsHeader count={3} hasLive={false} />)
    expect(getByText('IDLE · 3')).toBeTruthy()
  })

  it('reflects the session count in the label', async () => {
    const { getByText } = await render(<LiveSessionsHeader count={1} hasLive={true} />)
    expect(getByText('LIVE · 1')).toBeTruthy()
  })

  it('exposes a header role with label for accessibility', async () => {
    const { getByLabelText } = await render(<LiveSessionsHeader count={1} hasLive={true} />)
    expect(getByLabelText('LIVE · 1')).toBeTruthy()
  })

  it('exposes live-sessions-header when the block is collapsible', async () => {
    const { getByTestId } = await render(
      <LiveSessionsHeader count={4} hasLive collapsed onToggle={() => {}} />,
    )
    expect(getByTestId('live-sessions-header')).toBeTruthy()
  })
})

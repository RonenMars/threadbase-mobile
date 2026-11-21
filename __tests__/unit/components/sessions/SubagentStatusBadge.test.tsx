import React from 'react'
import { render } from '@testing-library/react-native'
import { SubagentStatusBadge } from '@/components/sessions/SubagentStatusBadge'
import { dark } from '@/constants/theme'
import '@/test-utils/i18n-setup'

describe('SubagentStatusBadge', () => {
  it('running is a solid green dot labelled Running', async () => {
    const r = await render(<SubagentStatusBadge status="running" testID="b" />)
    const badge = r.getByTestId('b')
    expect(badge.props.accessibilityLabel).toBe('Running')
    expect(badge).toHaveStyle({ backgroundColor: dark.status.running })
  })

  it('finished is a muted check labelled Finished', async () => {
    const r = await render(<SubagentStatusBadge status="finished" testID="b" />)
    expect(r.getByTestId('b').props.accessibilityLabel).toBe('Finished')
    expect(r.getByTestId('phosphor-react-native-check-bold').props.color).toBe(dark.text.secondary)
  })

  it('quiet is a hollow amber ring labelled Quiet, and says nothing about failure', async () => {
    const r = await render(<SubagentStatusBadge status="quiet" testID="b" />)
    const badge = r.getByTestId('b')
    expect(badge.props.accessibilityLabel).toBe('Quiet, no recent activity')
    expect(badge).toHaveStyle({ borderColor: dark.status.waiting })
    expect(badge).not.toHaveStyle({ backgroundColor: dark.status.waiting })
    expect(badge.props.accessibilityLabel).not.toMatch(/fail|error/i)
  })
})

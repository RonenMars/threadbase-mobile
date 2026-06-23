// Regression test: the default session-status filter must include
// 'waiting_input'. A live session waiting for the user's reply reports
// status 'waiting_input'; if the default filter omits it, the app queries
// /api/sessions?status=running,idle and the server filters those sessions out,
// so they never appear in the Hub / Classic / Tree lists.
import { ALL_STATUSES } from '@/components/servers/FilterSortSheet'

describe('default session status filter', () => {
  it('includes waiting_input so live sessions awaiting input are visible', () => {
    expect(ALL_STATUSES).toContain('waiting_input')
  })

  it('covers all three live-list statuses', () => {
    expect([...ALL_STATUSES].sort()).toEqual(['idle', 'running', 'waiting_input'])
  })
})

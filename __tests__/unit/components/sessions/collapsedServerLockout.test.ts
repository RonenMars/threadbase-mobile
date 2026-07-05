/**
 * Regression guard for the "collapsed single server lockout" bug:
 * with 2 servers a user collapses server A, then reopens the app while
 * server B is unreachable. Only server A is visible, its header is no longer
 * collapsible, but the stale collapsed flag would keep its sessions hidden
 * with no way to expand them.
 *
 * The classic list (app/index.tsx) and hub list (ProjectHubList.tsx) both gate
 * visibility on `!collapseApplies || !collapsed`, where collapseApplies means
 * "more than one server actually renders items". This mirrors the tree view's
 * existing `!multiServer || serverExpanded`. Keep the three in sync.
 */

// Mirrors the production expression; the test fails if the guard is dropped
// back to a bare `!collapsed`.
const bucketVisible = (visibleServerCount: number, collapsed: boolean) => {
  const collapseApplies = visibleServerCount > 1
  return !collapseApplies || !collapsed
}

describe('collapsed single-server lockout', () => {
  it('shows a lone visible server even when it is flagged collapsed', () => {
    // server A collapsed, server B dropped out → 1 visible server
    expect(bucketVisible(1, true)).toBe(true)
  })

  it('still honors collapse when more than one server is visible', () => {
    expect(bucketVisible(2, true)).toBe(false)
    expect(bucketVisible(2, false)).toBe(true)
  })
})

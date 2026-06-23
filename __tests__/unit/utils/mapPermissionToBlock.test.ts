import { mapPermissionToBlock } from '@/utils/mapPermissionToBlock'

describe('mapPermissionToBlock', () => {
  it('keeps the REAL on-screen indices (not 1-based) for answering', () => {
    // A gate numbered 2 / 3 — answering option 0 must send "2", option 1 "3".
    const block = mapPermissionToBlock(
      'Claude needs your permission to use Bash',
      [
        { index: 2, label: 'Yes' },
        { index: 3, label: 'No, and tell Claude what to do differently' },
      ],
      2
    )
    expect(block.source).toBe('permission')
    expect(block.permissionIndices).toEqual([2, 3])
    expect(block.questions[0].question).toBe('Claude needs your permission to use Bash')
    expect(block.questions[0].options.map(o => o.label)).toEqual([
      'Yes',
      'No, and tell Claude what to do differently',
    ])
    // cursor=2 maps to array position 0
    expect(block.selectedIndex).toBe(0)
  })

  it('falls back to a generic prompt when none was scraped', () => {
    const block = mapPermissionToBlock(undefined, [{ index: 1, label: 'Yes' }], undefined)
    expect(block.questions[0].question).toBe('Claude needs your permission')
    expect(block.selectedIndex).toBeUndefined()
  })
})

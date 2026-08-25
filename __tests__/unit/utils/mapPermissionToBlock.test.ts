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

  it('carries the descriptive `detail` block through, keeping the prompt as the question', () => {
    const block = mapPermissionToBlock(
      'Do you want to proceed?',
      [
        { index: 1, label: 'Yes' },
        { index: 2, label: 'No' },
      ],
      1,
      'Bash command\ngit push origin main\nPush the merge commit to origin/main'
    )
    expect(block.questions[0].question).toBe('Do you want to proceed?')
    expect(block.questions[0].detail).toBe(
      'Bash command\ngit push origin main\nPush the merge commit to origin/main'
    )
  })

  it('omits `detail` when none was provided', () => {
    const block = mapPermissionToBlock(
      'Do you want to proceed?',
      [{ index: 1, label: 'Yes' }],
      undefined
    )
    expect(block.questions[0].detail).toBeUndefined()
  })

  it('carries the server gateId alongside the content key', () => {
    const block = mapPermissionToBlock(
      'Do you want to proceed?',
      [{ index: 1, label: 'Yes' }],
      undefined,
      undefined,
      'Do you want to proceed?::::1.Yes',
      'gate-instance-7'
    )
    expect(block.permissionContentKey).toBe('Do you want to proceed?::::1.Yes')
    expect(block.permissionGateId).toBe('gate-instance-7')
  })

  it('omits permissionGateId when the streamer sent none', () => {
    const block = mapPermissionToBlock(
      'Do you want to proceed?',
      [{ index: 1, label: 'Yes' }],
      undefined,
      undefined,
      'Do you want to proceed?::::1.Yes'
    )
    expect(block).not.toHaveProperty('permissionGateId')
  })
})

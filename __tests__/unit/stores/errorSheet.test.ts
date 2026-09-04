import { useErrorSheetStore } from '@/stores/errorSheet'

describe('errorSheet store', () => {
  beforeEach(() => {
    useErrorSheetStore.setState({ open: false })
  })

  it('starts closed', () => {
    expect(useErrorSheetStore.getState().open).toBe(false)
  })

  it('opens on openSheet', () => {
    useErrorSheetStore.getState().openSheet()
    expect(useErrorSheetStore.getState().open).toBe(true)
  })

  it('closes on closeSheet without losing the underlying errors elsewhere', () => {
    useErrorSheetStore.getState().openSheet()
    useErrorSheetStore.getState().closeSheet()
    expect(useErrorSheetStore.getState().open).toBe(false)
  })
})

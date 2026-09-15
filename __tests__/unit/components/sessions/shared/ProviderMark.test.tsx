import { act } from 'react'
import renderer from 'react-test-renderer'
import { ProviderMark } from '@/components/sessions/shared/ProviderMark'
import { brand, dark } from '@/constants/theme'

function renderFill(element: React.ReactElement): string | undefined {
  let tree: renderer.ReactTestRenderer | null = null
  act(() => {
    tree = renderer.create(element)
  })
  const withFill = tree!.root.findAll((n) => typeof n.props.fill === 'string')
  return withFill[0]?.props.fill as string | undefined
}

describe('ProviderMark', () => {
  it('paints every provider with theme secondary on the list', () => {
    expect(renderFill(<ProviderMark provider="claude-code" />)).toBe(dark.text.secondary)
    expect(renderFill(<ProviderMark provider="codex-cli" />)).toBe(dark.text.secondary)
    expect(renderFill(<ProviderMark provider="cursor-cli" />)).toBe(dark.text.secondary)
  })

  it('paints each provider in brand color on the detail header', () => {
    expect(renderFill(<ProviderMark provider="claude-code" variant="color" />)).toBe('#D97757')
    expect(renderFill(<ProviderMark provider="codex-cli" variant="color" />)).toBe(brand.codex)
    expect(renderFill(<ProviderMark provider="cursor-cli" variant="color" />)).toBe(brand.cursor)
  })
})

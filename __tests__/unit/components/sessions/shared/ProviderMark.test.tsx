import { act, type ReactElement } from 'react'
import { I18nextProvider } from 'react-i18next'
import renderer from 'react-test-renderer'
import { ProviderMark } from '@/components/sessions/shared/ProviderMark'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { dark } from '@/constants/theme'
import { PROVIDER_COLOR } from '@/constants/providers'
import i18n from '@/test-utils/i18n-setup'

function renderFill(element: ReactElement): string | undefined {
  let tree: ReturnType<typeof renderer.create> | undefined
  act(() => {
    tree = renderer.create(
      <ThemeProvider>
        <I18nextProvider i18n={i18n}>{element}</I18nextProvider>
      </ThemeProvider>,
    )
  })
  if (tree === undefined) {
    throw new Error('ProviderMark renderer produced no tree')
  }
  const root = tree.root as {
    findAll: (predicate: (node: { props: { fill?: string } }) => boolean) => { props: { fill?: string } }[]
  }
  const withFill = root.findAll((node) => typeof node.props.fill === 'string')
  const fill = withFill[0]?.props.fill
  return typeof fill === 'string' ? fill : undefined
}

describe('ProviderMark', () => {
  it('paints every provider with theme secondary on the list', () => {
    expect(renderFill(<ProviderMark provider="claude-code" />)).toBe(dark.text.secondary)
    expect(renderFill(<ProviderMark provider="codex-cli" />)).toBe(dark.text.secondary)
    expect(renderFill(<ProviderMark provider="cursor-cli" />)).toBe(dark.text.secondary)
  })

  it('paints each provider in brand color on the detail header', () => {
    expect(renderFill(<ProviderMark provider="claude-code" variant="color" />)).toBe(PROVIDER_COLOR.claude)
    expect(renderFill(<ProviderMark provider="codex-cli" variant="color" />)).toBe(PROVIDER_COLOR.codex)
    expect(renderFill(<ProviderMark provider="cursor-cli" variant="color" />)).toBe(PROVIDER_COLOR.cursor)
  })
})

/**
 * ServerClaudeFlagsSection.
 *
 * Guards the security-relevant behaviour:
 *   - hidden entirely against a server that predates the feature (data === null)
 *   - renders controls from the SERVER-supplied registry, not a hardcoded list
 *   - staging a dangerous value (bypassPermissions) requires confirmation, and a
 *     declined confirmation must not change anything
 */
import React from 'react'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react-native'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { ServerClaudeFlagsSection } from '@/components/servers/ServerClaudeFlagsSection'

const mockUseClaudeFlags = jest.fn()
const mockMutate = jest.fn()
const mockConfirm = jest.fn()

jest.mock('@/hooks/useClaudeFlags', () => ({
  useClaudeFlags: (...args: unknown[]) => mockUseClaudeFlags(...args),
  useUpdateClaudeFlags: () => ({
    mutate: mockMutate,
    isPending: false,
    isError: false,
    error: null,
  }),
}))

jest.mock('@/utils/confirmDangerousChange', () => ({
  confirmDangerousChange: (...args: unknown[]) => mockConfirm(...args),
}))

const REGISTRY = [
  {
    id: 'permissionMode',
    flag: '--permission-mode',
    valueType: 'enum',
    enumValues: ['acceptEdits', 'bypassPermissions'],
    risk: 'low',
  },
  { id: 'maxBudgetUsd', flag: '--max-budget-usd', valueType: 'string', risk: 'low' },
]

function seed(overrides: Record<string, unknown> = {}) {
  mockUseClaudeFlags.mockReturnValue({
    data: {
      registry: REGISTRY,
      values: {},
      extraArgs: null,
      persisted: true,
      ...overrides,
    },
    isLoading: false,
  })
}

async function renderSection() {
  return await render(
    <ThemeProvider>
      <ServerClaudeFlagsSection serverId="srv1" />
    </ThemeProvider>,
  )
}

beforeEach(() => {
  mockUseClaudeFlags.mockReset()
  mockMutate.mockReset()
  mockConfirm.mockReset()
  mockConfirm.mockResolvedValue(true)
})

// Unmount between cases: the async staging path can leave a pending state update
// attached to the previous tree, which otherwise breaks the NEXT render.
afterEach(() => {
  cleanup()
})

describe('ServerClaudeFlagsSection', () => {
  // An older streamer 404s the endpoint; the hook maps that to null.
  it('renders nothing when the server predates the feature', async () => {
    mockUseClaudeFlags.mockReturnValue({ data: null, isLoading: false })
    const { queryByTestId } = await renderSection()

    expect(queryByTestId('claude-flags-save')).toBeNull()
  })

  it('renders a control per registry entry', async () => {
    seed()
    const { getByTestId } = await renderSection()

    expect(getByTestId('claude-flag-permissionMode-acceptEdits')).toBeTruthy()
    expect(getByTestId('claude-flag-permissionMode-bypassPermissions')).toBeTruthy()
    expect(getByTestId('claude-flag-maxBudgetUsd')).toBeTruthy()
  })

  it('saves a non-dangerous value without confirmation', async () => {
    seed()
    const { getByTestId } = await renderSection()

    await fireEvent.changeText(getByTestId('claude-flag-maxBudgetUsd'), '5')
    await fireEvent.press(getByTestId('claude-flags-save'))

    await waitFor(() => expect(mockMutate).toHaveBeenCalled())
    expect(mockConfirm).not.toHaveBeenCalled()
    expect(mockMutate).toHaveBeenCalledWith({ values: { maxBudgetUsd: '5' }, extraArgs: undefined })
  })

  it('requires confirmation before staging bypassPermissions', async () => {
    seed()
    const { getByTestId } = await renderSection()

    await fireEvent.press(getByTestId('claude-flag-permissionMode-bypassPermissions'))

    await waitFor(() => expect(mockConfirm).toHaveBeenCalled())
    await fireEvent.press(getByTestId('claude-flags-save'))
    await waitFor(() => expect(mockMutate).toHaveBeenCalled())
    expect(mockMutate).toHaveBeenCalledWith({
      values: { permissionMode: 'bypassPermissions' },
      extraArgs: undefined,
    })
  })

  // Declining must leave the value unset — the whole point of the gate.
  it('does not stage a dangerous value when confirmation is declined', async () => {
    seed()
    mockConfirm.mockResolvedValue(false)
    const { getByTestId } = await renderSection()

    await fireEvent.press(getByTestId('claude-flag-permissionMode-bypassPermissions'))
    await waitFor(() => expect(mockConfirm).toHaveBeenCalled())

    await fireEvent.press(getByTestId('claude-flags-save'))
    await waitFor(() => expect(mockMutate).toHaveBeenCalled())
    expect(mockMutate).toHaveBeenCalledWith({ values: {}, extraArgs: undefined })
  })

  it('selecting a safe permission mode needs no confirmation', async () => {
    seed()
    const { getByTestId } = await renderSection()

    await fireEvent.press(getByTestId('claude-flag-permissionMode-acceptEdits'))
    await fireEvent.press(getByTestId('claude-flags-save'))

    await waitFor(() => expect(mockMutate).toHaveBeenCalled())
    expect(mockConfirm).not.toHaveBeenCalled()
  })

  // The copy is enumerated in the component instead of being assembled as
  // t(`…flags.${def.id}.label`), so a static analyser can see every key. That
  // trades a build-time key for a runtime lookup, and the lookup has to keep
  // degrading the way `defaultValue` did against a registry this build has
  // never seen — the streamer may add a flag at any time.
  it('renders translated copy for a known flag id', async () => {
    seed()
    const { getByText } = await renderSection()

    expect(getByText('Permission mode')).toBeTruthy()
    expect(getByText('How much Claude asks before acting. Bypass modes remove every confirmation.')).toBeTruthy()
    expect(getByText('Budget limit (USD)')).toBeTruthy()
  })

  it('falls back to the raw CLI flag for an id it has no copy for', async () => {
    seed({
      registry: [
        ...REGISTRY,
        { id: 'futureFlagFromANewerServer', flag: '--future-flag', valueType: 'boolean', risk: 'low' },
      ],
    })
    const { getByText, getByTestId, queryByText } = await renderSection()

    // Degrades to the flag itself rather than leaking the i18n key.
    expect(getByText('--future-flag')).toBeTruthy()
    expect(queryByText('servers:claudeFlags.flags.futureFlagFromANewerServer.label')).toBeNull()
    // …and still renders a working control for it.
    expect(getByTestId('claude-flag-futureFlagFromANewerServer')).toBeTruthy()
  })

  it('sends extra args when provided', async () => {
    seed()
    const { getByTestId } = await renderSection()

    await fireEvent.changeText(getByTestId('claude-flag-extra-args'), '--bare')
    await fireEvent.press(getByTestId('claude-flags-save'))

    await waitFor(() => expect(mockMutate).toHaveBeenCalled())
    expect(mockMutate).toHaveBeenCalledWith({ values: {}, extraArgs: '--bare' })
  })
})

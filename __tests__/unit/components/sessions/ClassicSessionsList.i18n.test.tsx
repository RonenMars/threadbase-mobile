import React from 'react'
import { cleanup } from '@testing-library/react-native'
import { ClassicSessionsList } from '@/components/sessions/classic/ClassicSessionsList'
import { renderWithI18n } from '@/test-utils/render'
import i18n from '@/test-utils/i18n-setup'

beforeEach(async () => {
  await cleanup()
  await i18n.changeLanguage('he')
})

describe('ClassicSessionsList empty state localization', () => {
  it('names both supported coding-agent providers', async () => {
    const { getByText, queryByText } = await renderWithI18n(
      <ClassicSessionsList sessions={[]} refreshing={false} onRefresh={() => {}} />,
    )

    expect(getByText('התחילו סשן Claude Code או Codex\nכדי לראות אותו כאן')).toBeTruthy()
    expect(queryByText('התחל סשן Claude Code\nכדי לראות אותו כאן')).toBeNull()
  })
})

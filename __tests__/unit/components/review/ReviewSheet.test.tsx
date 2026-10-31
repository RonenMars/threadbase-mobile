import React from 'react'
import { render } from '@testing-library/react-native'
import { ReviewSheet } from '@/components/review/ReviewSheet'
import { createWrapper } from '@/test-utils'
import '@/test-utils/i18n-setup'
import type { Message } from '@/types/api'

function editMessage(filePath: string): Message {
  return {
    id: filePath,
    uuid: filePath,
    role: 'assistant',
    content: [
      {
        type: 'tool_use',
        name: 'Edit',
        input: { file_path: filePath, old_string: 'const x = 1', new_string: 'const x = 2' },
      },
    ],
    timestamp: '',
    is_sidechain: false,
    parent_uuid: null,
  }
}

describe('ReviewSheet summary', () => {
  it.each([
    [['src/a.ts'], '1 file · +1 / −1'],
    [['src/a.ts', 'src/b.ts'], '2 files · +2 / −2'],
  ])('renders the pluralized file count for %j', async (paths, expected) => {
    const r = await render(
      <ReviewSheet visible messages={paths.map(editMessage)} onClose={jest.fn()} />,
      { wrapper: createWrapper() },
    )
    expect(r.getByText(expected)).toBeTruthy()
  })
})

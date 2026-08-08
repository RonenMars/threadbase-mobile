import React from 'react'
import { fireEvent, render } from '@testing-library/react-native'
import { useRouter } from 'expo-router'
import { QuickAccessStrip } from '@/components/quick-access/QuickAccessStrip'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { useQuickAccessStore } from '@/stores/quickAccess'
import { useServersStore } from '@/stores/servers'

describe('QuickAccessStrip', () => {
  it('opens a conversation favorite with its stored conversationId', async () => {
    const push = jest.fn()
    ;(useRouter as jest.Mock).mockReturnValue({ push })
    useServersStore.setState({ activeServerIds: ['server-1'], displayedServerIds: ['server-1'] })
    useQuickAccessStore.setState({
      favoritesEnabled: true,
      stripCollapsed: false,
      favorites: [
        {
          type: 'conversation',
          id: 'server-1::conversation::favorite-record-id',
          label: 'Pinned conversation',
          serverId: 'server-1',
          conversationId: 'stored-conversation-id',
        },
      ],
    })

    const { getByLabelText, getByText } = await render(
      <ThemeProvider>
        <QuickAccessStrip />
      </ThemeProvider>,
    )

    await fireEvent.press(getByLabelText('Pinned conversation'))
    await fireEvent.press(getByText('Open session'))

    expect(push).toHaveBeenCalledWith('/conversation/stored-conversation-id?server=server-1')
  })
})

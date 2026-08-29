import React from 'react'
import { StyleSheet, type ViewStyle } from 'react-native'
import { act, render } from '@testing-library/react-native'
import { ServerHeaderRow } from '@/components/sessions/tree/ServerHeaderRow'
import { DirectionRoot } from '@/lib/direction-root'
import i18n from '@/test-utils/i18n-setup'

function isMirrored(element: { props: { style?: ViewStyle | ViewStyle[] } }): boolean {
  const style = StyleSheet.flatten(element.props.style)
  const transform = style.transform
  if (!Array.isArray(transform)) return false
  return transform.some((entry) => 'scaleX' in entry && entry.scaleX === -1)
}

describe('ServerHeaderRow direction', () => {
  afterEach(async () => {
    await act(async () => {
      await i18n.changeLanguage('en')
    })
  })

  it('keeps server identifiers LTR and leaves the disclosure unmirrored in LTR', async () => {
    const { getByText, getByTestId } = await render(
      <DirectionRoot>
        <ServerHeaderRow
          serverId="s1"
          serverLabel="work-mac.local"
          totalCount={3}
          collapsible
          onToggle={jest.fn()}
        />
      </DirectionRoot>,
    )

    expect(StyleSheet.flatten(getByText('work-mac.local').props.style)).toEqual(
      expect.objectContaining({ direction: 'ltr', writingDirection: 'ltr' }),
    )
    expect(StyleSheet.flatten(getByText('3').props.style)).toEqual(
      expect.objectContaining({ direction: 'ltr', writingDirection: 'ltr' }),
    )
    expect(isMirrored(getByTestId('phosphor-react-native-caret-right-bold'))).toBe(false)
  })

  it('mirrors the collapsed disclosure in RTL and still isolates the server name', async () => {
    await act(async () => {
      await i18n.changeLanguage('he')
    })
    const { getByText, getByTestId } = await render(
      <DirectionRoot>
        <ServerHeaderRow
          serverId="s1"
          serverLabel="work-mac.local"
          totalCount={3}
          collapsible
          onToggle={jest.fn()}
        />
      </DirectionRoot>,
    )

    expect(StyleSheet.flatten(getByText('work-mac.local').props.style)).toEqual(
      expect.objectContaining({ direction: 'ltr', writingDirection: 'ltr' }),
    )
    expect(isMirrored(getByTestId('phosphor-react-native-caret-right-bold'))).toBe(true)
  })
})

/**
 * DirectionRoot is the single paint point for Phosphor mirroring.
 * Isolated screens do not pass `mirrored={isRTL}` — they inherit IconContext.
 */
import React from 'react'
import { StyleSheet, type ViewStyle } from 'react-native'
import { act, render } from '@testing-library/react-native'
import { CaretRight } from 'phosphor-react-native'
import { DirectionRoot } from '@/lib/direction-root'
import i18n from '@/test-utils/i18n-setup'

function isMirrored(element: { props: { style?: ViewStyle | ViewStyle[] } }): boolean {
  const style = StyleSheet.flatten(element.props.style)
  const transform = style.transform
  if (!Array.isArray(transform)) return false
  return transform.some((entry) => 'scaleX' in entry && entry.scaleX === -1)
}

function Probe() {
  return <CaretRight size={16} />
}

describe('DirectionRoot icon context', () => {
  afterEach(async () => {
    await act(async () => {
      await i18n.changeLanguage('en')
    })
  })

  it('leaves directional icons unmirrored in LTR and mirrors them in RTL', async () => {
    const ltr = await render(
      <DirectionRoot>
        <Probe />
      </DirectionRoot>,
    )
    expect(isMirrored(ltr.getByTestId('phosphor-react-native-caret-right-undefined'))).toBe(false)

    await act(async () => {
      await i18n.changeLanguage('he')
    })
    const rtl = await render(
      <DirectionRoot>
        <Probe />
      </DirectionRoot>,
    )
    expect(isMirrored(rtl.getByTestId('phosphor-react-native-caret-right-undefined'))).toBe(true)
  })
})

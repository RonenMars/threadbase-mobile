import React from 'react'
import { Dimensions, StyleSheet } from 'react-native'
import { render, screen } from '@testing-library/react-native'
import { LiveCard } from '@/components/sessions/now/LiveCard'

const TITLE = 'Ship the onboarding copy'

function setFontScale(fontScale: number) {
  Dimensions.set({
    window: { ...Dimensions.get('window'), fontScale },
    screen: { ...Dimensions.get('screen'), fontScale },
  })
}

async function renderCard() {
  await render(
    <LiveCard
      title={TITLE}
      color="#22c55e"
      emphasis="faint"
      serverLabel="Work Mac"
      onPress={() => {}}
      onMenuPress={() => {}}
      accessibilityLabel={`${TITLE}, Working`}
    >
      {null}
    </LiveCard>,
  )
  const title = screen.getByText(TITLE)
  return { title, row: StyleSheet.flatten(title.parent?.props.style) }
}

describe('LiveCard title row', () => {
  afterEach(() => setFontScale(1))

  it('puts the server chip beside the title at the default size', async () => {
    const { title, row } = await renderCard()
    expect(row.flexDirection).toBe('row')
    expect(title.props.numberOfLines).toBe(2)
  })

  it('stacks the chip under the title and lets the title wrap at a large size', async () => {
    setFontScale(1.35)
    const { title, row } = await renderCard()
    expect(row.flexDirection).toBe('column')
    expect(title.props.numberOfLines).toBe(4)
  })
})

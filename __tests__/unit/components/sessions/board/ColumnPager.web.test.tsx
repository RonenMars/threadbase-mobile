import React from 'react'
import { ScrollView, Text } from 'react-native'
import { fireEvent, render } from '@testing-library/react-native'
import { ColumnPager } from '@/components/sessions/board/ColumnPager.web'
import i18n from '@/test-utils/i18n-setup'

const pages = [<Text key="a">a</Text>, <Text key="b">b</Text>, <Text key="c">c</Text>]
const scrollTo = (x: number) => ({ nativeEvent: { contentOffset: { x, y: 0 }, contentSize: { width: 900, height: 1 }, layoutMeasurement: { width: 300, height: 1 } } })

async function mount(onIndexChange: (i: number) => void, index = 0) {
  const r = await render(<ColumnPager index={index} onIndexChange={onIndexChange}>{pages}</ColumnPager>)
  await fireEvent(r.getByTestId('board-pager'), 'layout', { nativeEvent: { layout: { width: 300 } } })
  return r
}

afterEach(async () => {
  await i18n.changeLanguage('en')
})

describe('ColumnPager.web', () => {
  it('reports the page a swipe settles on', async () => {
    const change = jest.fn()
    const r = await mount(change)
    await fireEvent.scroll(r.getByTestId('board-pager'), scrollTo(600))
    expect(change).toHaveBeenCalledWith(2)
  })

  it('reads negative offsets in RTL', async () => {
    await i18n.changeLanguage('he')
    const change = jest.fn()
    const r = await mount(change)
    await fireEvent.scroll(r.getByTestId('board-pager'), scrollTo(-300))
    expect(change).toHaveBeenCalledWith(1)
  })

  it('stays quiet while a drag has not reached another page', async () => {
    const change = jest.fn()
    const r = await mount(change)
    await fireEvent.scroll(r.getByTestId('board-pager'), scrollTo(100))
    expect(change).not.toHaveBeenCalled()
  })

  it('scrolls to a negative offset in RTL', async () => {
    await i18n.changeLanguage('he')
    const scrollToSpy = jest.spyOn(ScrollView.prototype, 'scrollTo').mockImplementation(() => {})
    const r = await mount(jest.fn())
    await r.rerender(<ColumnPager index={2} onIndexChange={jest.fn()}>{pages}</ColumnPager>)
    expect(scrollToSpy).toHaveBeenCalledWith(expect.objectContaining({ x: -600 }))
    scrollToSpy.mockRestore()
  })

  it('ignores the pages a chip tap passes on the way, then resumes', async () => {
    const change = jest.fn()
    const r = await mount(change)
    await r.rerender(<ColumnPager index={2} onIndexChange={change}>{pages}</ColumnPager>)
    const pager = r.getByTestId('board-pager')
    await fireEvent.scroll(pager, scrollTo(300))
    await fireEvent.scroll(pager, scrollTo(600))
    expect(change).not.toHaveBeenCalled()
    await fireEvent.scroll(pager, scrollTo(0))
    expect(change).toHaveBeenCalledWith(0)
  })
})

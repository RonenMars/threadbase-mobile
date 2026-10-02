import React from 'react'
import { StyleSheet } from 'react-native'
import { fireEvent, screen } from '@testing-library/react-native'
import { AttachmentPreview } from '@/components/conversation/AttachmentPreview'
import { renderWithI18n } from '@/test-utils/render'

// A notched iPhone: the status bar and Dynamic Island take 59 pt.
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 59, bottom: 34, left: 0, right: 0 }),
}))

const image = {
  id: 'att-1',
  path: '/uploads/photo.jpg',
  originalName: 'photo.jpg',
  mimeType: 'image/jpeg',
  sizeBytes: 4,
  localUri: 'file:///tmp/photo.jpg',
}

describe('AttachmentPreview', () => {
  it('keeps the close button below the status bar and reachable', async () => {
    const onClose = jest.fn()
    await renderWithI18n(<AttachmentPreview images={[image]} openIndex={0} onClose={onClose} />)

    const header = screen.getByTestId('attachment-preview-header')
    expect(StyleSheet.flatten(header.props.style).paddingTop).toBe(59)

    await fireEvent.press(screen.getByTestId('attachment-preview-close'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

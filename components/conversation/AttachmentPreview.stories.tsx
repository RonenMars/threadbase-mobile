import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { AttachmentPreview } from './AttachmentPreview'

const image = (id: string, name: string, uri: string) => ({
  id,
  path: `/uploads/${name}`,
  originalName: name,
  mimeType: 'image/png',
  sizeBytes: 1024,
  localUri: uri,
})

const meta: Meta<typeof AttachmentPreview> = {
  title: 'conversation/AttachmentPreview',
  component: AttachmentPreview,
  args: { onClose: () => {} },
}

export default meta
type Story = StoryObj<typeof AttachmentPreview>

export const SingleImage: Story = {
  args: {
    images: [image('a', 'screenshot.png', 'https://picsum.photos/seed/threadbase-a/900/1600')],
    openIndex: 0,
  },
}

export const SeveralImages: Story = {
  args: {
    images: [
      image('a', 'screenshot.png', 'https://picsum.photos/seed/threadbase-a/900/1600'),
      image('b', 'diagram.png', 'https://picsum.photos/seed/threadbase-b/1600/900'),
      image('c', 'error-dialog.png', 'https://picsum.photos/seed/threadbase-c/1200/1200'),
    ],
    openIndex: 1,
  },
}

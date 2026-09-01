import React from 'react'
import { Text, View } from 'react-native'
import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { GlassView } from './GlassView'

const meta: Meta<typeof GlassView> = {
  title: 'UI/GlassView',
  component: GlassView,
  decorators: [
    (Story) => (
      <View style={{ flex: 1, padding: 24, backgroundColor: '#1b1d4d' }}>
        <Story />
      </View>
    ),
  ],
}

export default meta

type Story = StoryObj<typeof GlassView>

export const Default: Story = {
  render: () => (
    <GlassView style={{ borderRadius: 12, padding: 16 }}>
      <Text style={{ color: '#ffffff' }}>Native Liquid Glass surface</Text>
    </GlassView>
  ),
}

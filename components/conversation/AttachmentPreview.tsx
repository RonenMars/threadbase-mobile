import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  FlatList,
  Image,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { X } from 'phosphor-react-native'
import type { ComposerAttachment } from '@/services/uploads'
import { font, spacing } from '@/constants/theme'
import { layoutDirectionStyle, ltrContentStyle } from '@/lib/rtl'

export interface AttachmentPreviewProps {
  /** Image attachments only; the pager swipes between them. */
  images: ComposerAttachment[]
  /** Index into `images` to open on. Null keeps the preview closed. */
  openIndex: number | null
  onClose: () => void
}

// Full-screen photo viewing is dark regardless of app theme, as in the system Photos app.
const BACKDROP = '#000000'
const FOREGROUND = '#FFFFFF'
const FOREGROUND_MUTED = 'rgba(255,255,255,0.7)'

export function AttachmentPreview({ images, openIndex, onClose }: AttachmentPreviewProps) {
  const visible = openIndex !== null && images.length > 0
  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
    >
      {visible ? (
        <PreviewPager
          // Remount per open so the pager starts on the tapped chip, not where it was left.
          key={openIndex}
          images={images}
          initialIndex={Math.min(openIndex, images.length - 1)}
          onClose={onClose}
        />
      ) : null}
    </Modal>
  )
}

function PreviewPager({
  images,
  initialIndex,
  onClose,
}: {
  images: ComposerAttachment[]
  initialIndex: number
  onClose: () => void
}) {
  const { t } = useTranslation('terminal')
  const { width } = useWindowDimensions()
  const [index, setIndex] = useState(initialIndex)
  const current = images[Math.min(index, images.length - 1)]

  const handleMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (width > 0) setIndex(Math.round(e.nativeEvent.contentOffset.x / width))
  }

  const counter = images.length > 1 ? t('preview.counter', { current: index + 1, total: images.length }) : null

  return (
    <View style={styles.backdrop} testID="attachment-preview">
      <FlatList
        data={images}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        // The pager is a physical left-to-right strip in every locale, matching the chip row.
        style={layoutDirectionStyle('ltr')}
        initialScrollIndex={initialIndex}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        onMomentumScrollEnd={handleMomentumEnd}
        renderItem={({ item }) => (
          <View style={[styles.page, { width }]}>
            <Image
              source={{ uri: item.localUri }}
              style={styles.image}
              resizeMode="contain"
              accessibilityLabel={item.originalName}
            />
          </View>
        )}
      />
      <SafeAreaView style={styles.header} edges={['top', 'left', 'right']} pointerEvents="box-none">
        <View style={styles.headerText}>
          <Text style={[styles.title, ltrContentStyle]} numberOfLines={1}>
            {current?.originalName}
          </Text>
          {counter ? <Text style={styles.counter}>{counter}</Text> : null}
        </View>
        <TouchableOpacity
          testID="attachment-preview-close"
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('preview.close')}
          hitSlop={12}
          style={styles.closeBtn}
        >
          <X size={22} color={FOREGROUND} />
        </TouchableOpacity>
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: BACKDROP },
  page: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  image: { width: '100%', height: '100%' },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  headerText: { flex: 1, paddingTop: spacing.sm },
  title: { color: FOREGROUND, fontSize: font.sm, fontWeight: '600' },
  counter: { color: FOREGROUND_MUTED, fontSize: font.xs, marginTop: 2 },
  closeBtn: { padding: spacing.xs, paddingTop: spacing.sm },
})

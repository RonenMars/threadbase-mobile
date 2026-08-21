import React from 'react'
import { useTranslation } from 'react-i18next'
import { Banner } from '@/components/ui/Banner'
import { useTheme } from '@/contexts/ThemeContext'
import { alertAppearance } from '@/lib/alertAppearance'
import { useBannerStore } from '@/stores/banners'

export function BannerHost() {
  const { t } = useTranslation('common')
  const theme = useTheme()
  const banners = useBannerStore((s) => s.banners)
  const dismiss = useBannerStore((s) => s.dismiss)
  const current = banners[0]
  if (!current) return null

  const appearance = alertAppearance(current.level, theme, current.accent)
  const Icon = appearance.Icon

  function handleClose() {
    current.onClose?.()
    dismiss(current.id)
  }

  return (
    <Banner
      title={current.title}
      message={current.message}
      details={current.details}
      accent={appearance.accent}
      icon={current.icon ?? (
        <Icon size={28} color={appearance.accent} weight={appearance.iconWeight} />
      )}
      action={current.buttonText
        ? { label: current.buttonText, onPress: current.buttonAction, variant: current.buttonVariant }
        : undefined}
      secondaryAction={current.hideCloseButton
        ? undefined
        : { label: t('button.close'), onPress: handleClose }}
    />
  )
}

import React from 'react'
import { Banner } from '@/components/ui/Banner'
import { useBannerStore } from '@/stores/banners'

export function BannerHost() {
  const banners = useBannerStore((s) => s.banners)
  const dismiss = useBannerStore((s) => s.dismiss)
  const current = banners[0]
  if (!current) return null

  return (
    <Banner
      {...current}
      onDismiss={() => dismiss(current.id)}
    />
  )
}

import { useEffect } from 'react'
import { useBannerStore, type BannerEntry } from '@/stores/banners'
import type { AlertSpec } from '@/types/alerts'

export function useBannerSync(id: string, spec: AlertSpec | null) {
  const upsert = useBannerStore((s) => s.upsert)
  const dismiss = useBannerStore((s) => s.dismiss)

  // Refresh callbacks every commit; upsert is a no-op notify when the fingerprint is unchanged.
  useEffect(() => {
    if (!spec) {
      dismiss(id)
      return
    }
    const entry: BannerEntry = { ...spec, id }
    upsert(entry)
  })

  useEffect(() => () => {
    dismiss(id)
  }, [id, dismiss])
}

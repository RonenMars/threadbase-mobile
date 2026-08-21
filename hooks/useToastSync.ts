import { useEffect } from 'react'
import { useToastStore, type ToastEntry } from '@/stores/toasts'
import type { AlertSpec } from '@/types/alerts'

export function useToastSync(id: string, spec: AlertSpec | null, viewport: string) {
  const upsert = useToastStore((s) => s.upsert)
  const dismiss = useToastStore((s) => s.dismiss)

  // Refresh callbacks every commit; upsert is a no-op notify when the fingerprint is unchanged.
  useEffect(() => {
    if (!spec) {
      dismiss(id)
      return
    }
    const entry: ToastEntry = { ...spec, id, viewport }
    upsert(entry)
  })

  useEffect(() => () => {
    dismiss(id)
  }, [id, dismiss])
}

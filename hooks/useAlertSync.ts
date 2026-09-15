import { useEffect, useMemo, useRef } from 'react'
import { useAlertStore, type AlertInput } from '@/stores/alerts'
import type { AlertSpec } from '@/types/alerts'

export function useAlertListSync(entries: readonly AlertInput[]) {
  const upsert = useAlertStore((s) => s.upsert)
  const dismiss = useAlertStore((s) => s.dismiss)
  const idsRef = useRef<string[]>([])

  useEffect(() => {
    const nextIds = entries.map((entry) => entry.id)
    const prevIds = idsRef.current
    for (const id of prevIds) {
      if (!nextIds.includes(id)) dismiss(id)
    }
    for (const entry of entries) {
      upsert(entry)
    }
    idsRef.current = nextIds
  })

  useEffect(() => () => {
    for (const id of idsRef.current) dismiss(id)
    idsRef.current = []
  }, [dismiss])
}

export function useAlertSync(id: string, spec: AlertSpec | null) {
  const entries = useMemo(
    (): AlertInput[] => (spec ? [{ ...spec, id }] : []),
    [spec, id],
  )
  useAlertListSync(entries)
}

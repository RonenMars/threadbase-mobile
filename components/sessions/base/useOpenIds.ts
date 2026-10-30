import { useCallback, useState } from 'react'

/** Which collapsible cards are open, keyed by id. */
export function useOpenIds() {
  const [openIds, setOpenIds] = useState<ReadonlySet<string>>(new Set())
  const toggleOpen = useCallback((id: string) => {
    setOpenIds((prev) => {
      const next = new Set(prev)
      if (!next.delete(id)) next.add(id)
      return next
    })
  }, [])
  return { openIds, toggleOpen }
}

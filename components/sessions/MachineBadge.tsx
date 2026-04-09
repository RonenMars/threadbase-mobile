import React from 'react'
import { Badge } from '@/components/ui/Badge'
import { dark } from '@/constants/theme'

interface Props {
  machineName: string
}

export function MachineBadge({ machineName }: Props) {
  return (
    <Badge
      label={machineName}
      color={dark.text.accent}
      bg={`${dark.text.accent}20`}
    />
  )
}

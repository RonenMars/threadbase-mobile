import React from 'react'
import { Badge } from '@/components/ui/Badge'
import { useTheme } from '@/contexts/ThemeContext'

interface Props {
  machineName: string
}

export function MachineBadge({ machineName }: Props) {
  const theme = useTheme()
  return (
    <Badge
      label={machineName}
      color={theme.text.accent}
      bg={`${theme.text.accent}20`}
    />
  )
}

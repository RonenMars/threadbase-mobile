import { ALERT_LEVEL_RANK, type AlertEntry, type AlertLevel } from '@/types/alerts'

export type ArbitratedAlerts = {
  critical: AlertEntry | null
  errors: AlertEntry[]
  warnings: AlertEntry[]
  infos: AlertEntry[]
  /** Error-level winners whose cause is claimed by an on-screen surface. */
  inline: AlertEntry[]
  /** Error-level winners with no inline claim — the pill/sheet audience. */
  global: AlertEntry[]
  /** Cause-deduped winners, highest severity first, insertion order within a rank. */
  all: AlertEntry[]
}

export function arbitrate(
  alerts: readonly AlertEntry[],
  claims: Readonly<Record<string, number>> = {},
): ArbitratedAlerts {
  const byCause = new Map<string, AlertEntry>()
  for (const alert of alerts) {
    const existing = byCause.get(alert.cause)
    if (!existing) {
      byCause.set(alert.cause, alert)
      continue
    }
    if (ALERT_LEVEL_RANK[alert.level] > ALERT_LEVEL_RANK[existing.level]) {
      byCause.set(alert.cause, alert)
    }
  }

  const winners = [...byCause.values()]
  const all = [...winners].sort((a, b) => {
    const rank = ALERT_LEVEL_RANK[b.level] - ALERT_LEVEL_RANK[a.level]
    if (rank !== 0) return rank
    return 0
  })

  const errors = winners.filter((alert) => alert.level === 'error')
  const inline = errors.filter((alert) => (claims[alert.cause] ?? 0) > 0)
  const global = errors.filter((alert) => (claims[alert.cause] ?? 0) <= 0)
  const criticals = winners.filter((alert) => alert.level === 'critical')

  return {
    critical: criticals[0] ?? null,
    errors,
    warnings: winners.filter((alert) => alert.level === 'warning'),
    infos: winners.filter((alert) => alert.level === 'info'),
    inline,
    global,
    all,
  }
}

export function globalSurface(arb: ArbitratedAlerts): AlertLevel | null {
  if (arb.critical) return 'critical'
  if (arb.global.length > 0) return 'error'
  if (arb.warnings.length > 0) return 'warning'
  if (arb.infos.length > 0) return 'info'
  return null
}

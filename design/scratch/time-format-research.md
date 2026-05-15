# Relative time format — research & decision

**Date:** 2026-05-15
**Status:** Locked
**Context:** User flagged that the list shows "23h" three times in a row for items in the same hour bucket. We need exact time when ambiguous.

---

## Convention across major apps

| App | <60s | Same day | Yesterday | Same week | Same year | Older |
|---|---|---|---|---|---|---|
| **Gmail** | — | `10:35 AM` (exact) | `10:35 AM` (still exact) | `Mar 5` | `Mar 5` | `3/5/24` |
| **iMessage** | — | `10:35 AM` | `Yesterday` | `Monday` (weekday) | `Mar 5, 10:35 AM` | `3/5/24, 10:35 AM` |
| **Slack** | — | `2:35 PM` | `Yesterday at 2:35 PM` | `Monday at 2:35 PM` | `Mar 5` | `3/5/2024` |
| **WhatsApp** | — | `14:35` | `Yesterday` | weekday | `5 Mar` | `5/3/24` |
| **Discord** | `just now` | `Today at 2:35 PM` | `Yesterday at 2:35 PM` | weekday | date | date+year |

**Convergent pattern:**

1. **Today** → **exact time** (`14:35` or `2:35 PM`). Never `23h ago`.
2. **Yesterday** → the literal word `Yesterday` (sometimes with `at HH:mm`).
3. **2–6 days ago** → weekday (`Monday`, `Tuesday`).
4. **Same year** → short date (`Mar 5` or `5 Mar`).
5. **Older** → date with year (`3/5/24` or `Mar 5, 2024`).

**What none of them use as the primary list label:** `23h ago`, `4h ago`, `47m ago`. Those relative tokens appear in *notifications* and *tooltips on hover*, not in list rows. Reason: when many items share the same hour bucket, the relative token loses its disambiguating power — exactly the problem you flagged.

---

## Where the current app uses relative tokens

`components/sessions/hub/hubUtils.ts` exports `dateLabel(timestamp, multipleToday)` and `formatElapsed(ms)`. The `multipleToday` branch is a half-step toward the right answer (it switches to `HH:mm` only when multiple same-day items exist), but it still produces `23h ago` for any timestamp older than a few hours.

`TreeRow` and `DrillRow` use a different helper (`latestActivityLabel`) that always renders relative tokens (`23h`, `4d`).

The two helpers diverge. The redesign uses one helper.

---

## Decision — `formatListTime(timestamp, now)` helper

A single pure utility, `components/sessions/shared/formatListTime.ts`. Returns one of these formats based on age relative to `now`:

| Age | Format | Example |
|---|---|---|
| < 60 seconds | `now` | `now` |
| Same calendar day | `HH:mm` (24h, locale-aware) | `14:35` |
| Yesterday (calendar day) | `Yesterday` | `Yesterday` |
| 2–6 days, same week | Weekday short name | `Mon` |
| Same calendar year | Day + short month | `5 Mar` |
| Older | Day + short month + 2-digit year | `5 Mar 24` |

**Locale handling:** uses `Intl.DateTimeFormat` with the device locale. The English example above becomes `14:35` everywhere (24h is the global default per `i18n.dateStyle`); date order (`5 Mar` vs `Mar 5`) follows locale.

**Why no `47m` / `2h` tokens:** they're inconsistent (the user reported the bug), they trail by a clock so the same row drifts label every minute, and the convention research above shows none of the reference apps use them as their primary list label. Relative tokens stay reserved for two narrow places:

1. **Notifications** (`expo-notifications` body text, where time-since-event matters more than absolute time).
2. **Live indicators** in the same row (e.g. the "running for 4m" elapsed counter under a session that is currently running). That's a different signal from "when was the last message" — it's a duration, not a wall-clock.

**Width budget:** every output ≤ 7 characters at 11pt mono. Right-aligned column auto-sizes to the widest visible label so columns line up.

**Accessibility:** `accessibilityLabel` on every row's time cell expands to the absolute timestamp (`Wednesday May 15 2026 at 14:35`). The visual label stays concise; assistive tech gets the full version.

**Test cases the pure helper must pass:**

- `now → 'now'`
- 30s ago → `'now'`
- 5 min ago, same day → `'14:30'`
- 23h ago, still same calendar day → `'00:35'` (the original `23h` problem — fixed)
- 23h ago, crossed midnight into prior day → `'Yesterday'`
- 4 days ago (same week) → `'Mon'`
- 14 days ago, same year → `'1 May'`
- 400 days ago → `'5 Apr 25'`
- DST boundary → uses calendar-day comparison, not 24h subtraction
- Future timestamp (clock skew) → render as `'now'`, don't blow up

---

## Migration impact

- New file: `components/sessions/shared/formatListTime.ts` + unit tests.
- `components/sessions/hub/hubUtils.ts` → `dateLabel` and `formatElapsed` deleted; consumers re-pointed at the new helper.
- `components/sessions/tree/treeUtils.ts` → `latestActivityLabel` deleted; consumers re-pointed at the new helper.
- All four list views (hub-drill, hub-root, classic, tree-drill) and the quick-access chips inherit the new format automatically through `ConversationListItem`.

No backend / data changes. The timestamp data flowing through `MultiSession.startedAt`, `MultiConversation.lastActivity`, etc. is already the right type (ISO string or epoch ms).

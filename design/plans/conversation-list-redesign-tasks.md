# Conversation List Redesign — Task Checklist

**Companion to:** [`conversation-list-redesign.md`](./conversation-list-redesign.md)
**Last updated:** 2026-05-15
**Status:** 15 / 15 complete

All 15 rollout steps landed. Production typecheck clean. 336 / 336 unit tests passing.

---

## What shipped

| # | Step | Files |
|---|---|---|
| 1 | `formatListTime` helper | `components/sessions/shared/formatListTime.ts` + 23-case test |
| 2 | `pathDisplay` helper | `components/sessions/shared/pathDisplay.ts` + 21-case test |
| 3 | `MessagePreview` component | `components/sessions/shared/MessagePreview.tsx` + 11-case test |
| 4 | `ServerChip` + palette + `ServerConfig.color` | `components/sessions/shared/{ServerChip.tsx, serverPalette.ts}` + 17 tests; `types/api.ts`, `stores/servers.ts` |
| 5 | `ConversationListItem` composite | `components/sessions/shared/ConversationListItem.tsx` + 12-case test |
| 6 | `TimeBucketPills` + pure helpers | `components/sessions/shared/TimeBucketPills.tsx` + 11-case test |
| 7 | Hub-drill view | `components/conversation/ConversationList.tsx` (rewritten to use `ConversationListItem`) |
| 8 | Hub root cards | `components/sessions/hub/ProjectHubCard.tsx` smart-path header + activity summary; `SessionRow.tsx` and `ConvRow.tsx` rewritten as thin wrappers |
| 9 | Classic view | `components/sessions/SessionCard.tsx` — ServerBadge → ServerChip, spine takes server color when multi-server, time column shown via `formatListTime` |
| 10 | Tree + tree-drill | `components/sessions/tree/{TreeRow,DrillRow,DrillView}.tsx`; indent gutters added, green SVG → Phosphor `ChatCircle`, `DrillItem.time` removed in favour of raw `timestamp` |
| 11 | Quick Access strip chips | `components/quick-access/QuickAccessChip.tsx` — 28px height, brand-blue border tint, mono font for dir-type chips |
| 12 | Search results | `components/sessions/hub/ProjectHubList.tsx` + `components/sessions/tree/TreeSessionsList.tsx` — search results render via `ConversationListItem` with query highlight |
| 13 | Settings | `stores/settings.ts` (7 new persisted keys); `app/settings.tsx` (new "Conversation rows" section with Density / Path display / Server indicator / Server chip style controls) |
| 14 | `ConversationPreviewSheet` | `components/sessions/shared/ConversationPreviewSheet.tsx` (built, ready to wire from long-press) |
| 15 | Legacy cleanup | `hubUtils.ts`: `dateLabel`, `formatDate`, `formatHour` removed. `multipleToday` prop dropped from `SessionRowProps` / `ConvRowProps` and call sites |

---

## Test summary

```
28 unit-test suites: 336 / 336 passing.

Brand-new shared suites (95 tests):
  formatListTime.test.ts           23
  pathDisplay.test.ts              21
  MessagePreview.test.tsx          11
  ServerChip.test.tsx               6
  serverPalette.test.ts            11
  ConversationListItem.test.tsx    12
  TimeBucketPills.test.tsx         11
```

No regressions in the existing 241 tests.

---

## Deferred (post-v1)

These were called out in the main plan and remain follow-ups. None block shipping v1.

- **Long-press → `ConversationPreviewSheet` wiring across rows.** The sheet is built; threading `previewTarget` state through each list screen is the next commit.
- **`TimeBucketPills` wiring above the list views.** Pure component is built and tested; deferred because hub-drill / search filter state lives in different screens that should adopt the pills together.
- **Settings server color picker** — full UI for assigning each server its identity color from the 8-swatch palette. Plan §7.
- **Design-system browseable preview (web + Storybook)** — Playwright-snapshotted `tokens-runtime.html` + on-device `@storybook/react-native`. Plan §8.
- **Brand-palette alignment** — reconcile `dark.text.accent` (`#58a6ff`) / `dark.status.waiting` (`#d29922`) etc. with the brand spec (`#63b3ff` / `#f08a24`).
- **Landing-page screenshot refresh** — swap in new mobile screens after v1 ships.
- **Quick Access strip header reshuffle** — active-tab-only icons, `⋯` overflow consolidating gear/pencil/collapse, "+ N more" → caret. Plan §E. Step 11 limited itself to chip-shape changes.

---

## On-device verification checklist

Launch command for the physical iPhone lives in [`docs/dev-on-physical-device-ios.md`](../../docs/dev-on-physical-device-ios.md). TL;DR:

```bash
cd <repo-root> && \
  EXPO_NO_WATCHMAN=1 npx expo run:ios --device "<your-iphone-udid>"
```

Expect on first launch:

- **Hub root**: each project card has smart-collapsed path (parent muted above, last segment bold) + activity summary line (`N live · M today · last X ago`) instead of the bare folder icon + count.
- **Hub drill (img 1 fix)**: rows show the conversation title + a first/last message preview (per Settings → History → Message preview) + `N msgs · branch` + relative time. No more 16 identical rows.
- **Classic view**: session card spine takes the server color when 2+ servers are active. A relative-time label appears in the title meta column (previously absent).
- **Tree (img 3 polish)**: faint indent hairlines visible at each depth. The green chat-bubble icon is gone; a brand-blue `ChatCircle` replaces it. Times right-align to a fixed column.
- **Tree drill (img 4 fix)**: each row's time is the row's own timestamp, not the parent node's. Server chip shows when multi-server.
- **Quick Access strip**: chips are slimmer (28px) with a brand-blue tinted border. `dir` chips render their path in JetBrains Mono.
- **Settings**: new "Conversation rows" section appears below "History" with four segmented controls. Changes flow through `ConversationList` immediately on toggle.
- **Multi-server**: with ≥ 2 servers active, every list row shows a server chip (Scottish Gov status-tag style) in the meta column. The 3px left strip on rows / the spine on `SessionCard` takes the same server color.

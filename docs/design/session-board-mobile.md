# Session board (mobile)

Design for the **Board** segment on the home screen (Now | Projects | Sub-agents | Board): the web board's state columns, fitted to a phone, with each session's sub-agents folded under it.

Design artifact (dark LTR, light, Hebrew RTL; reduce-motion notes on the frames): https://claude.ai/artifact/3zyhSEoHuyeTYgDnH42FYk

## Columns

Same four columns as the web board: Needs you, Working, Observed, Earlier.
Resumable, can't-resume and tierless history all land in Earlier (`lib/boardColumns.ts`).
Needs you sorts longest wait first; every other column sorts by last activity.

A phone shows one column at a time.
A wrapping chip strip picks it: each chip is a tab with the tier colour, label and count, at least 44pt tall.
The board opens on the first column that has something in it.

## Built

- Fourth hub segment, local state, not persisted.
- The board reads the same rows as Now, so the hub's filter sheet and search apply to it.
- Rows reuse the Now cards (`NeedsYouCard`, `WorkingCard`, `EarlierRow`); stale servers dim as on Now.
- Sub-agents come from `useAllSubagents` and fold under their parent in a `CollapsibleCard`, closed by default. A parent matches on the session id, `conversationId` or `boundConversationId`.
- Earlier pages more history when scrolled to the end.
- An empty column shows one plain line.
- RTL: the chip strip and the fold indent follow the Yoga direction, no `I18nManager`.
- Reduce motion: the fold opens in place (inherited from `CollapsibleCard`); chip switches never animate.

## Designed, not built

- Swiping between columns. `react-native-pager-view` has no web implementation and its RTL behaviour under a Yoga-direction root is unverified, so chips only for now.
- Sub-agents whose parent is not on the board are not shown here; they stay on the Sub-agents tab.
- The web board's Earlier time window and per-column "visible / total" counts.

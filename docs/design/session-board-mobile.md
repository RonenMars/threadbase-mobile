# Session board (mobile)

Design for the session board on the home screen: the web board's state columns, fitted to a phone, with each session's sub-agents folded under it.

Status: approved 2026-10-30 (option C, refined) and built on `feat/mobile-board`.
The design canvas's Notes list is the spec and wins over older frames.

Design artifact (dark, light, Hebrew and Arabic RTL): https://claude.ai/artifact/3zyhSEoHuyeTYgDnH42FYk

## Entry point

The board opens from an icon button in the hub header, not from a tab and not from the Filter & Sort drawer.

- Position: inside `headerRight`, immediately before the settings gear, in the same 32x32 `headerButton`.
- It is a view switcher with no selected state: `Kanban` on the list, `ListBullets` on the board.
  Leaving the board puts you back on the tab you came from, still selected.
- The tabs hide while the board shows.
- Narrow phones keep all five header controls; below about 330pt the app name hides and its icon stays.
- After a restart the board reopens if it was open (`boardOpen` in settings).

## Columns

Same four columns as the web board: Needs you, Working, Observed, Earlier.
Resumable, can't-resume and tierless history all land in Earlier (`lib/boardColumns.ts`); an unknown tier lands there too rather than disappearing.
With the default order, Needs you sorts longest wait first and every other column by last activity; another order from the drawer applies to every column.

The board starts on Needs you when anything waits, otherwise on the last column you were on (`boardColumn` in settings), otherwise on the first with something in it.

### Phone (below 768)

One column at a time, full width, no peek.
`ColumnPager` uses `react-native-pager-view`; on web, which it does not support, `ColumnPager.web.tsx` is a snapping `ScrollView`.
Under the header is one horizontally scrolling line of chips, each with the tier colour, label and count of cards, at least 44pt tall, and below it the pager dots.
The selected chip scrolls into view.
An empty column keeps its chip, dimmed, with a 0, and stays reachable by swipe.

### Tablet and desktop (768 and up, on web and iPad in both orientations)

`DesktopBoard`: 264pt columns side by side in a horizontal `ScrollView`.
Chips scroll a column into view, and arrows move one column and hide when everything fits.
An empty column folds to a narrow strip and unfolds by itself when a session arrives.
Reduce motion turns the smooth scroll off.

## Cards

A card (`BoardSessionCard`) has a state rail, the project above the title, and an activity line joined with " · ".
With no sub-agents the whole card opens the session and there is no chevron.
With sub-agents the left side opens the session, and a counter and chevron fold them; the counter counts sub-agents only and hides at 0.
Sub-agents start collapsed everywhere.

Needs you cards get the warning border and tint.
The open prompt's question replaces the activity line, on one line, so the card keeps its height.
An eye at the start of that line marks that it opens the question.

Sub-agents whose parent session is not on the board still show, under a "Sub-agents of other sessions" heading after the sessions of the column, as `SubagentGroupCard`s titled by the parent's title (or "Session" plus a short id when the server sends none).
A group with any active sub-agent goes in Working; otherwise Earlier.

An empty column shows an icon, "Nothing here" and one hint line.
If sub-agents fail to load, one line replaces those cards and the rest of the board stays.

## Questions

Tapping the eye or the question opens `BoardQuestionModal`: full height and scrollable on a phone, a centred 560pt panel from 768 up.
There is no inline reply on the card.
X closes it without answering and the session stays in Needs you.
Tapping a reply sends it.
A prompt with several questions is settled by one POST covering all of them, so it collects a reply per question and sends on the last.
A prompt this build cannot answer (not single-choice, no options, or secret) shows the question with no buttons and a line sending you to the session.

The questions come from `pendingPrompts` on the list rows, which need the streamer change that adds them.
An older streamer, or a permission request with no options and no prompt record, shows the last line of the terminal tail with no eye, and tapping it opens the session.
A change in `hasOpenPrompt` is the cue to refetch, because `session_update` frames do not carry the prompts.

## Filter & Sort on the board

The drawer keeps Agent, Active within, Order and Servers.
Show, the presets and Tree view leave it.
A tier choice made on the list is ignored on the board and survives Reset there.

## RTL and motion

Direction comes from i18next, so the root is mirrored by Yoga while `I18nManager` stays LTR.
Native scroll offsets stay physical, web RTL `scrollLeft` runs negative (`boardScrollX`), and the pager gets its direction through `layoutDirection`.
The modal sits outside the RTL root and applies `layoutDirectionStyle` itself.
Hebrew and Arabic strings beyond the shipped keys are drafts and need a translator pass.

## Sources

From the web:

- 37signals, Bringing Card Table to the small screen: primary column open, others collapsed, one screen. https://dev.37signals.com/bringing-card-table-to-the-small-screen/
- saasui.design, kanban board UX patterns: status headers carry counts, scan-first cards. https://www.saasui.design/blog/saas-kanban-board-ux-patterns
- Linear, Board layout: fixed column order, showing empty groups is a choice. https://linear.app/docs/board-layout
- Material Components, Chip: chip groups wrap by default, single selection, 48dp targets. https://github.com/material-components/material-components-android/blob/master/docs/components/Chip.md
- uxcel, Apple HIG segmented controls (a secondary summary, not the HIG page): 2 to 5 equal segments, order mirrored in RTL. https://app.uxcel.com/courses/apple-hig/essential-ui-controls-166/segmented-controls-3793
- NN/g, Accordions on mobile: one tap target per header. https://www.nngroup.com/videos/accordions-on-mobile/
- KanbanFlow, GitScrum and Targetprocess mobile boards: swipe between columns. https://kanbanflow.com/mobile-app , https://docs.gitscrum.com/en/mobile/kanban-board , https://www.targetprocess.com/blog/targetprocess-mobile-releases-ios-board-beta-and-plenty-of-useful-improvements/
- GitHub Projects, board layout: columns come from one single-select field. https://docs.github.com/en/enterprise-server@3.9/issues/planning-and-tracking-with-projects/customizing-views-in-your-project/customizing-the-board-layout
- Not found: Trello, Jira or Linear mobile board specifics.

From the workflow-ai-ai-captain board (local checkout, `web-app/src/features/board/Board.tsx`, read only; patterns, not code):

- Needs-you first inside a column with a stronger card; we take the tint and drop the pulse.
- Unknown states are shown, not dropped.
- Done work folds into one "Done · N" section; Earlier plays that role.
- Empty columns shrink but stay; our empty chips dim with a 0.
- A meta line joined with " · ".
- One column per screen at phone width.
- A clear way back to the main list; ours is the header switcher.
- It has no error state; ours adds the sub-agent load line.

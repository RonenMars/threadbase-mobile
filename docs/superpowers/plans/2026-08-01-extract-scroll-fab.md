# Extract the three near-identical scroll-to-edge FABs into one component

Repo `threadbase-mobile`. Branch from `land/integration-prep` after pulling from origin, which now contains `ad16c92e` — the top-FAB overlay fix (#476) that made the third copy converge on the other two and explicitly deferred this extraction.

## Background

Three components each hand-roll the same affordance: a small pill pinned to the top or bottom edge of a scrolling list that fades in when you have scrolled away from that edge, and scrolls you back when tapped.

- `components/conversation/ConversationHistoryList.tsx` — top pill only (its bottom control is a different shape; see below)
- `components/conversation/ConversationList.tsx` — top and bottom pills
- `components/terminal/TerminalOutput.tsx` — top and bottom pills

Before #476 the first one was visibly wrong: an opaque accent-blue pill that occluded message text. #476 brought it in line with the other two. That is what makes the duplication newly obvious — and it is why this ticket exists rather than being folded into that PR.

## Read this before deciding anything

**This may not be worth doing.** The three copies look alike but are not interchangeable, and a careless extraction silently changes behavior on two of three screens. Read all three implementations end to end first, then decide. Reporting back "not worth it, here is why" is an acceptable and possibly correct outcome — say so early rather than forcing a shared component into existence.

The parts that genuinely differ:

### 1. The visibility rules contradict each other

| | top pill shows when | bottom pill shows when |
|---|---|---|
| `ConversationHistoryList` | `y > 200` (direction-agnostic) | `distFromBottom > 100` |
| `ConversationList` | `!scrollingUp && y > 120` (scrolling **down**) | `scrollingUp && distFromBottom > 120` |
| `TerminalOutput` | `scrollingUp && y > 100` (scrolling **up**) | `distFromBottom >= 50` |

`ConversationList` reveals its top pill while you scroll **down**; `TerminalOutput` reveals its top pill while you scroll **up**. Those are opposite. Any shared component that owns the visibility rule has to keep all three as configuration, which means the "shared" part is a styled shell and a scroll callback — not the logic.

Do not unify these thresholds or directions. If you think one of them is a bug, that is a separate ticket with its own evidence; do not fix it under cover of a refactor.

### 2. The scroll plumbing differs for a documented reason

`ConversationList` drives an `Animated.FlatList` with `useAnimatedScrollHandler` and writes shared values from the worklet.

`TerminalOutput` and `ConversationHistoryList` drive FlashList v2 and deliberately do **not** use `useAnimatedScrollHandler`. There is a comment at `TerminalOutput.tsx:126-130` recording why: FlashList v2 calls `onScroll` via an `Animated.event` listener, and the worklet wrapper raises `undefined is not a function` inside `RecyclerView`. Preserve that constraint. A shared component that assumes a worklet scroll handler will break both FlashList call sites at runtime, and it will break them in a way unit tests do not catch.

Note that the two FlashList copies solve it differently — `TerminalOutput` keeps `useState` and mirrors it into a shared value during render (`TerminalOutput.tsx:136-137`), while `ConversationHistoryList` writes the shared value directly from a plain JS `useCallback`. The second is cheaper (no re-render per scroll event) and is the newer of the two. If you converge them, converge on the direct-write approach and say so — but that is a behavior-adjacent change, so verify it on device, not just in Jest.

### 3. The styling is close but not identical

| | background | border | text |
|---|---|---|---|
| `ConversationHistoryList`, `ConversationList` | `rgba(31, 111, 235, 0.14)` | `rgba(88, 166, 255, 0.2)` | `rgba(230, 237, 243, 0.6)` |
| `TerminalOutput` | `rgba(31, 111, 235, 0.18)` | `rgba(88, 166, 255, 0.25)` | `rgba(255, 255, 255, 0.7)` |

`TerminalOutput` sits on a fixed dark `#0d1117` terminal surface, so it is slightly more opaque and its text is pure white — it is not theme-aware, and it should not become theme-aware here. It also carries `minHeight: MIN_TOUCH_TARGET` + `justifyContent: 'center'` that the other two lack; that came from the a11y touch-target work in #405 and must survive. The fade duration is 200ms in `TerminalOutput` and 220ms in the other two.

Decide deliberately whether the shared component takes a variant prop or whether the terminal keeps its own styling, and justify it in the PR.

### 4. One "sibling" is not a sibling

`ConversationHistoryList`'s **bottom** control is not a pill at all. It is a 40×40 round `CaretDown` icon button in the bottom-right gutter, opaque `theme.text.accent`, with a shadow, still conditionally mounted via `useState`. It was deliberately left alone by #476 because it sits in the gutter and does not occlude text.

Do not sweep it into the extraction to make the numbers look symmetrical. Either leave it exactly as-is, or treat converting it as an explicit, separately-justified decision — it is a different control with a different visual language and a different reason to exist.

## What a good outcome looks like

Whatever shape you land on, these must hold:

- No user-visible behavior change on any of the three screens: same reveal thresholds, same reveal directions, same fade durations, same styling per surface.
- The FlashList worklet constraint is preserved and the comment explaining it survives in a findable place.
- The `MIN_TOUCH_TARGET` floor on the terminal pills survives.
- The net line count goes **down**. If the shared component plus three call sites is longer than the three copies, the abstraction is not paying for itself — abandon it and report that.
- No new props exist "for future flexibility". Every prop must be used by at least two of the three call sites; a prop used by exactly one is a sign the thing should not have been shared.

## Hard constraints

**Do not touch the FlashList tuning in `ConversationHistoryList`.** `drawDistance`, `maintainVisibleContentPosition`, `getItemType`, and `contentContainerStyle` were set by #470 after measuring content-height swings up to ±19,898pt causing viewport teleports. Read `git show 48cf2943 -- components/conversation/ConversationHistoryList.tsx` before you start. The FABs are overlays that live *next to* the list — the extraction must not reach into list props.

**Keep `testID="conversation-scroll-top"`.** `e2e/07_conversation_scroll_gaps.yaml` asserts and taps it. If the extraction changes which element carries the testID, the e2e flow must still pass unmodified — the point of that assertion is that a restyle cannot silently break the control.

**Do not change the i18n keys.** `nav.scrollToTop` / `nav.scrollToBottom` in `common.json` (en, he, ru, ar) and `action.scrollToBottom` in `conversation.json` are all live. `conversation.json`'s key is used only by the round `CaretDown` button; if you touch that button you risk orphaning the key, and the i18n CI job fails on dead keys.

## Verification

1. **Jest.** `npx jest --ci --runInBand --testPathPattern "onversation|erminal" --forceExit` — currently 26 suites / 277 tests green. `TerminalOutput.test.tsx` asserts both pills by accessibility label; those assertions must keep passing untouched.
2. **e2e.** `e2e/07_conversation_scroll_gaps.yaml` must pass **without edits**. Mock server on port 7071 (`node e2e/mock-server.js`), Release build required (`node e2e/ensure-release-build.js`).
3. **Visual.** Screenshot all three surfaces before and after at a scroll offset where the pill is visible, and confirm they are pixel-comparable. A refactor that shifts a pill by 4pt is a regression.
4. `npm run lint`, `npm run typecheck`, `npm run test:i18n`.

Known pre-existing conditions on this base, none of them yours: `npx tsc --noEmit` reports 14 errors, `npm run lint` reports 5 warnings, and `npm run lint:i18n` fails its `--max-warnings=0` gate on `app/session/[id].tsx`. Confirm each against the base branch with your changes stashed before attributing any of them to your work.

Gotchas that cost real time recently:

- Export `SENTRY_DISABLE_AUTO_UPLOAD=true` or the Release build fails at symbol upload with xcodebuild error 65.
- `e2e/ensure-release-build.js` reuses **any** `Threadbase-*` Release build it finds in DerivedData, including one built from a different worktree. It will silently test stale code. Build explicitly with `npx expo run:ios --configuration Release --device <UDID>` and confirm the installed `main.jsbundle` contains a string you just added before trusting any result.
- `npx expo run:ios` hangs waiting on an interactive device prompt when several simulators exist; always pass `--device <UDID>`.
- Maestro 2.6.1's `hideKeyboard` does not dismiss the iOS 26 keyboard; `07_conversation_scroll_gaps.yaml` pairs inline instead of via `setup.yaml`.

## Workflow

Work in an isolated worktree:

```bash
git fetch origin land/integration-prep
git worktree add .worktrees/extract-scroll-fab -b refactor/extract-scroll-fab origin/land/integration-prep
cd .worktrees/extract-scroll-fab && npm ci && (cd ios && bundle exec pod install)
```

`bundle exec pod install` in a fresh worktree rewrites three path-dependent checksums in `ios/Podfile.lock` (`ExpoModulesCore`, `ExpoWidgets`, `hermes-engine`). That is environmental drift documented in `CLAUDE.md`; run `scripts/reset-podfile-lock-path-noise.sh` or `git checkout -- ios/Podfile.lock` and keep it out of your commit.

Open the PR against `land/integration-prep` and stop there — do not merge without being asked.

## Deliverables

1. Either the extraction, or a written recommendation not to do it with the specific evidence that led there
2. If extracted: proof of no behavior change on all three surfaces, including before/after screenshots
3. `07_conversation_scroll_gaps.yaml` passing unmodified
4. A net reduction in lines, stated explicitly in the PR

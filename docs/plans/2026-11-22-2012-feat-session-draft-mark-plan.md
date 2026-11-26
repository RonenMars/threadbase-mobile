---
title: Session Draft Mark - Plan
type: feat
date: 2026-11-22
artifact_contract: ce-unified-plan/v1
product_contract_source: ce-plan-bootstrap
execution: code
---

# Session Draft Mark - Plan

## Goal Capsule

- **Objective:** A user scanning the session lists can tell which sessions hold text they typed but never sent, without opening each one.
- **Means:** A small pencil mark on session rows, driven by the draft text the composer already persists (KTD1).
- **Authority:** The request, then this plan, then repo conventions in `CLAUDE.md`.
- **Stop conditions:** Stop and ask if drafts turn out not to be keyed by the id the list rows carry (see Risks).
- **Finishes the work:** `ce-work` implements; a PR is opened only when asked.

## Product Contract

### Summary

Every session row whose composer holds unsent text shows a draft mark, the pencil icon chat apps use for an unsent message.
The mark disappears when the draft is sent or emptied.

### Problem Frame

The composer already saves what the user typed per session and restores it on return, but nothing on the list says a draft exists.
A user who leaves a session mid-sentence has no cue to go back, and the text sits unnoticed.

### Requirements

- R1. A session row shows the draft mark when its draft contains non-whitespace text.
- R2. The mark does not show for a missing, empty, or whitespace-only draft.
- R3. The mark appears on every surface that lists a session: the Now cards, the earlier rows, the hub rows, the tree and drill rows, and the board cards.
- R4. Marks are correct right after a cold start, before any composer has mounted.
- R5. The mark is exposed to screen readers as "Unsent draft" and translated in all four locales (`ar`, `en`, `he`, `ru`).

### Scope Boundaries

- Text drafts only. Attachment drafts live in memory in `stores/attachmentDrafts.ts` and are not persisted, so they are not marked.
- No draft preview text on the row and no tap-to-clear action. Considered and not built: the request asks for a mark, and a preview would put typed text on a list screen. Evidence that would change the call: user feedback asking to read drafts from the list.
- No change to how drafts are written, persisted, or cleared.

#### Deferred to Follow-Up Work

- Pruning drafts whose session no longer exists. They are never shown, so they only cost storage.

## Planning Contract

### Key Technical Decisions

- KTD1. **Read the existing drafts store; add no new state.** `stores/drafts.ts` already holds `drafts` keyed `${serverId}::${sessionId}` and persists it. The mark is a pure read of that record, so there is nothing to keep in sync.
- KTD2. **One self-subscribing mark component, not a prop threaded through rows.** A `SessionDraftMark` takes `serverId` and `sessionId`, subscribes with a selector that returns a boolean, and renders nothing when false. A row re-renders only when its own flag flips, and no list parent has to subscribe to the whole record. Each surface mounts it through the row's existing `trailing` slot or its title row (R3).
- KTD3. **Whitespace-only counts as no draft.** The selector trims before testing, because `setDraft('')` leaves an empty-string entry rather than deleting the key (R2).
- KTD4. **Hydrate the drafts store at app start.** `hydrate` is currently called only from `hooks/useComposerState.ts`, so a cold-start list would show no marks until a composer mounted. Calling it beside the other store hydrations in `app/_layout.tsx` fixes that (R4). The composer's own call stays, since write-through persistence makes a second hydrate harmless.
- KTD5. **Icon:** Phosphor `PencilSimpleLine` in `theme.text.secondary`, per the repo's Phosphor-only rule. The label is a new `row.hasDraft` key in `locales/<lng>/sessions.json`.

### Assumptions

- Draft keys use the same `serverId` and `sessionId` the list rows already carry (`MultiSession.serverId`, `session.id`). Verify in U3 before wiring.
- Placing the mark in the tail column beside the time, server chip, and provider mark fits every compact row without a layout change.

## Implementation Units

### U1. Draft selector and startup hydration

- **Goal:** Expose a boolean "has a draft" read and make the store populated at launch.
- **Requirements:** R1, R2, R4
- **Dependencies:** none
- **Files:** `stores/drafts.ts`, `app/_layout.tsx`, `__tests__/unit/stores/drafts.test.ts`
- **Approach:**
  - Add a `hasDraft(serverId, sessionId)` selector helper beside `getDraft` that trims before testing (KTD3).
  - Call the store's `hydrate` in the startup effect in `app/_layout.tsx` next to `hydrateSessionNames` and `hydrateQuickAccess` (KTD4).
- **Patterns to follow:** The existing `void hydrateQuickAccess()` calls in `app/_layout.tsx`.
- **Test scenarios:**
  - Covers R1. A draft of `"fix the bug"` for a key returns true.
  - Covers R2. A missing key, `""`, and `"   \n"` each return false.
  - After `setDraft(s, id, "")` following a non-empty draft, the helper returns false.
  - After `clearDraft`, the helper returns false.
  - Covers R4. With SecureStore holding `{"srv::a":"hi"}`, calling `hydrate` makes the helper return true for `srv::a`.
  - A corrupt SecureStore value leaves the helper false and does not throw.
- **Verification:** The selector answers correctly for all of the above and the startup effect hydrates drafts.

### U2. `SessionDraftMark` component, locale string, story

- **Goal:** One reusable mark that renders only when the session has a draft.
- **Requirements:** R1, R2, R5
- **Dependencies:** U1
- **Files:** `components/sessions/shared/SessionDraftMark.tsx`, `components/sessions/shared/SessionDraftMark.stories.tsx`, `locales/en/sessions.json`, `locales/ar/sessions.json`, `locales/he/sessions.json`, `locales/ru/sessions.json`, `__tests__/unit/components/SessionDraftMark.test.tsx`
- **Approach:**
  - Props are `serverId` and `sessionId`; subscribe through the U1 helper so the component re-renders only when the boolean flips (KTD2).
  - Render the Phosphor icon (KTD5) with `accessibilityLabel` from `t('row.hasDraft')` and a stable `testID` derived from the session id.
  - Add `row.hasDraft` to all four locale files in the same commit, so `npm run test:i18n` stays green.
  - The story is mandatory for a new `components/**` file; show the with-draft and without-draft states.
- **Patterns to follow:** `components/sessions/shared/ProviderMark.tsx` for size and tail placement, and its `.stories.tsx` for CSF3 shape.
- **Test scenarios:**
  - Covers R1. With a stored draft, the mark is in the tree with accessibility label "Unsent draft".
  - Covers R2. With no draft, an empty draft, and a whitespace-only draft, nothing renders.
  - Sending (store `clearDraft`) while mounted removes the mark without a remount.
  - Typing into a different session's draft does not render this session's mark.
- **Verification:** The component test passes, the story renders both states, and the i18n status check reports no missing or unused keys.

### U3. Mount the mark on every session surface

- **Goal:** Show the mark wherever a session is listed.
- **Requirements:** R3, R5
- **Dependencies:** U2
- **Files:** `components/sessions/now/LiveCard.tsx`, `components/sessions/now/NeedsYouCard.tsx`, `components/sessions/now/WorkingCard.tsx`, `components/sessions/now/EarlierRow.tsx`, `components/sessions/now/NowList.tsx`, `components/sessions/now/CantResumeRow.tsx`, `components/sessions/hub/SessionRow.tsx`, `components/sessions/hub/ProjectHubList.tsx`, `components/sessions/tree/DrillRow.tsx`, `components/sessions/tree/TreeSessionsList.tsx`, `components/sessions/board/BoardSessionCard.tsx`, `__tests__/integration/components/SessionDraftMarkRows.test.tsx`
- **Approach:**
  - List rows built on `ConversationListItem` pass the mark through its `trailing` slot.
    That is the `ConversationListItem` prop, not the `trailing` swipe-action prop that `EarlierRow`, `SessionRow` and `DrillRow` hand to `SwipeableRow`.
    The two are unrelated and the mark touches only the first.
    No caller passes the `ConversationListItem` slot today, so there is no collision.
  - The session renderers that bypass the shared row components need the same treatment: the session search-result renderer in `ProjectHubList`, and in `TreeSessionsList` both the search-result session item and the live-sessions list.
  - `CantResumeRow` lists ended sessions in `NowList` and has no tail slot.
    Give it an optional mark slot and fill it from `CantResumeSessionRow` only.
    `CantResumeConversationRow` lists a conversation and stays unmarked.
  - `LiveCard` gets an optional mark slot in its title row, next to the provider mark and server chip; `NeedsYouCard` and `WorkingCard` fill it from `session.serverId` and `session.id`.
  - `BoardSessionCard` gets the mark in its header with the same two ids.
  - On `LiveCard` and the `BoardSessionCard` open pressable, the parent carries an explicit `accessibilityLabel` that a screen reader announces in place of any child label.
    There, append `t('row.hasDraft')` to the parent label when the session has a draft, driven by the same boolean selector (R5).
    Keep the visual mark out of the accessibility tree on those two surfaces to avoid a double announcement.
    `ConversationListItem` rows set no explicit label, so the mark's own label is aggregated and needs no change.
  - Confirm first that the ids passed match the keys the composer writes (Assumptions); stop and ask if they do not.
- **Test scenarios:**
  - Covers R3. For each of the Now cards, the earlier row, the ended-session row in `NowList`, the hub row, the hub search result, the drill row, the tree search result, the tree live-sessions row, and the board card, a stored draft for the row's session shows the mark and no draft shows none.
  - Covers R3. A conversation row in `NowList` does not show the mark.
  - Covers R5. On the Now cards and the board card, the pressable's accessibility label contains "Unsent draft" with a stored draft and does not without one.
  - A draft for the same `sessionId` on a different `serverId` does not mark the row.
- **Verification:** Every surface in R3 shows the mark in the integration test, and existing row tests still pass.

## Verification Contract

| Check | Command | Applies to |
|---|---|---|
| Unit and integration tests | `npx jest --ci --runInBand --testPathPattern "drafts\|SessionDraftMark"` | U1, U2, U3 |
| Existing row and composer suites | `npx jest --ci --runInBand --testPathPattern "useComposerState\|LiveConversationView\|SessionScreen"` | U1 |
| Existing session-row suites | `npx jest --ci --runInBand --testPathPattern "EarlierRow\|SessionRow\|DrillRow\|NeedsYouCard\|NowList\|ProjectHubList\|TreeSessionsList\|BoardCard"` | U3 |
| Types | `npx tsc --noEmit --pretty false` | all |
| Lint | `npx eslint <changed files>` | all |
| Locale parity and dead keys | `npm run test:i18n` | U2 |
| Story coverage | the `pre-commit` hook runs `scripts/check-story-coverage.js` | U2 |

Run the `SessionScreen.*` suites serially, per the repo's Jest note, before calling a batch failure real.

## Definition of Done

- R1–R5 each have a passing test named in U1–U3.
- The mark shows on a real device or simulator after a cold start with a saved draft, and disappears after sending (a manual check, since jest cannot see the platform).
- On the same device check, a row with a long title and a server chip still shows the mark and its time, and a screen reader announces "Unsent draft" on a Now card.
- No commented-out or abandoned attempt code remains in the diff.
- The commit carries conventional-commit title `feat(sessions): add draft mark to session rows`, with no AI attribution.

## Risks

- **Draft key may not match the row's ids.** `app/session/[id].tsx` rebinds ids in some flows, so a draft written under a pre-bind id would never match a row. U3 checks this before wiring and stops if it fails.
- **Whole-record replacement on hydrate.** `hydrate` replaces `drafts` wholesale. Running it at startup, before any composer mounts, avoids losing an in-flight keystroke; the composer's later calls read the same persisted value.

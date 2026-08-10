# Release readiness — 2026-08-10

Every open bug, issue, feature and follow-up in `docs/`, checked against the tree and the GitHub API rather than against the docs, then ranked by what it costs at a **public release**.

Sources swept: [`BACKLOG.md`](../BACKLOG.md) (33 bugs + 2 issues), [`ROADMAP.md`](../ROADMAP.md) (Features 1–36), [`IDEAS.md`](../IDEAS.md), [`roadmap/index.md`](../roadmap/index.md), `followups/mobile/` (7 briefs), `followups/streamer/` (3), `followups/repo-health/` (6), [`e2e-remaining-work.md`](../e2e-remaining-work.md), [`privacy-policy/privacy-follow-up-checklist.md`](../privacy-policy/privacy-follow-up-checklist.md).

**Severity** is what a real user experiences. **Priority** is how much it should gate shipping. They diverge, which is why both are here.

The headline is that [`RELEASE-BACKLOG.md`](./RELEASE-BACKLOG.md) — written 2026-08-09 at 17:45 — was overtaken within hours. Its two highest-severity items merged that same evening, and six `BACKLOG.md` bugs have been fixed or made obsolete since they were filed.

Re-verify before acting; this is a snapshot.

---

## Solved since the last snapshot — do not re-open

Each row was checked directly. Do not re-fix these by grepping for the original symptom.

| Doc item | Verified state |
|---|---|
| RELEASE-BACKLOG #1 — streamer project path decode (**was Critical / P0**) | streamer PR **#461 MERGED** 2026-08-09 18:44 |
| RELEASE-BACKLOG #13 — drop dead `projects.message_count` | streamer PR **#462 MERGED** 2026-08-09 19:38 |
| "streamer fork half unimplemented" | streamer PR **#463 MERGED** 2026-08-09 14:08 |
| RELEASE-BACKLOG #14 — dependabot ignore list | mobile **#588** merged; `.github/dependabot.yml` pins jest 30 and TypeScript 7 with the reason inline |
| Bug 5 — multi-attachment send produces no output | `hooks/useComposerState.ts:94` — `escapePath` escapes spaces in `@path` payloads. PR #345 was closed; the content landed by another route |
| Bug 16 — back from a never-typed-in session leaves it alive | `app/session/[id].tsx:537-542` — `beforeRemove` listener gated on `promptCount === 0` |
| Feature 35 — crash-reporting consent model | `services/sentry.ts:359,477` — `reportOneShot` and `submitFeedbackViaSentry` both self-init and tear down |
| Bug 22 — Settings QR-scanner button is a no-op | `app/settings.tsx:474` `settings-scan-qr-btn` + scanner modal; `e2e/settings_qr_scanner.yaml` is wired into `test:e2e:mock` |
| Bug 26 — hide the Edit pencil when the active tab is empty | `components/quick-access/QuickAccessStrip.tsx:148` — gated on `!stripCollapsed && allItems.length > 0` |
| Bug 29 — remove the redundant right-side chevron | The strip is Favorites-only; no chevron remains |
| Bug 30 — add-to-favorites is non-functional | `stores/quickAccess.ts` has add / remove / reorder with persistence, plus `app/manage-favorites.tsx` |
| Bug 28 — show IP+port when a server has no name | `components/sessions/shared/serverDisplayName.ts` |
| Bug 31 — theme change doesn't apply across the app | `dark.*` references went **605 → 6**; `useTheme()` went **8 → 118**. See the residual below |
| Bugs 23 and 24 — Popular tab "Unable to load directories" and its black-on-black error | Obsolete, not fixed — the Popular tab was removed with the Quick Access redesign |
| Bug 21 — "Open Session" from Recents lands on "Session not found" | Obsolete — Recents was removed |
| Bug 33 — simplify the browse→session `transitionEnd` dance | `app/browse.tsx:208-235` — now `router.back()` plus one `requestAnimationFrame`, with the reasoning recorded in a comment |
| Bug 17 — jumpy scroll on stream and reconnect | `maintainVisibleContentPosition` at `components/conversation/LiveConversationView.tsx:276` and `ConversationHistoryList.tsx:254`. Worth one on-device confirmation, but the mechanism is in place |
| Issue 2 — Hub accordion stalls ~9 s on 1,266 items | #576 made the body lazy: `ProjectHubCard` renders only the loaded page plus a "See more" affordance. The inline `.map` remains but is now bounded by page size, not by project size |
| Feature 3 — attach multiple files to one message | `hooks/useComposerState.ts:34,48,95` — `attachments` is an array and all refs are joined into one payload. With Bug 5's escaping, this is complete |
| Feature 21 — tree view: drilled-folder rows at full fidelity | `components/sessions/tree/DrillView.tsx:55-80` — `DrillItem`s carry status, branch, lastOutput, message counts |
| Feature 32 — handle batched `conversation_events` | `hooks/useConversationStream.ts:160` subscribes to the batched frame |
| Feature 25 — clear react-hooks v5 lint warnings | Down to **1** warning across `app/`, `components/`, `hooks/` — see [#621](https://github.com/RonenMars/threadbase-mobile/issues/621) |

---

## Still open — P0

Ships broken to a real user, or blocks the store listing.

| # | Item | Sev | Pri | Issue | Evidence |
|---|---|---|---|---|---|
| 1 | [`threadbase://pair` hits "Unmatched Route"](./mobile/07-pair-deep-link-route.md) | **High** | **P0** | [#597](https://github.com/RonenMars/threadbase-mobile/issues/597) | No `app/pair*.tsx` route exists; only `services/pair-exchange.ts`. `parsePairUri` and `classifyPairCredential` already parse the URI correctly — only the route is missing. Onboarding instructs users to paste the full link, so this is a first-run failure on the path the product itself documents |
| 2 | Privacy and store compliance — 15 unchecked items (Feature 36) | **High** | **P0** | [#601](https://github.com/RonenMars/threadbase-mobile/issues/601) | [`privacy-follow-up-checklist.md`](../privacy-policy/privacy-follow-up-checklist.md): Apple App Privacy labels, Play Data Safety form, Sentry region placeholder, server-side IP scrubbing, retention statement, GDPR / UK GDPR and international-transfer wording, deletion-request flow, notification-payload audit, on-device speech verification. All human-only, none of it code |
| 3 | [`e2e/ensure-release-build.js` silently reuses a stale `.app`](./repo-health/04-ensure-release-build-staleness.md) | **High** | **P1** | [#598](https://github.com/RonenMars/threadbase-mobile/issues/598) | No mtime or staleness check anywhere in the file. One full suite run tested a week-old build and reported it as current. Pre-release this invalidates verification itself — every other sign-off on this page inherits the doubt |
| 4 | No working regression gate | **High** | **P1** | [#599](https://github.com/RonenMars/threadbase-mobile/issues/599), [#600](https://github.com/RonenMars/threadbase-mobile/issues/600) | The E2E workflow **failed both runs on 2026-08-09**. `.github/workflows/e2e.yml`'s two `if: failure()` steps only capture and upload artifacts — nothing notifies ([repo-health 01](./repo-health/01-scheduled-run-notifications.md)); the scheduled job failed 2026-06-01, 07-01 and 08-01 undetected. The suite sits at 11/15, so red is the expected state and new breakage is indistinguishable from the familiar four ([repo-health 03](./repo-health/03-e2e-suite-signal.md), [mobile 06](./mobile/06-mock-suite-remaining-failures.md)) |
| 5 | `threadbase.sh/privacy` returns **404** | **High** | **P0** | [#624](https://github.com/RonenMars/threadbase-mobile/issues/624) | Site root is 200; `/privacy` 404s on every variant. Apple requires a working Privacy Policy URL and it is declared on the v1.0 listing, so this fails App Review on the first click. The shipped app also links to it from `app/settings.tsx:833` and `app/help-feedback.tsx:47,304`, so it is already broken for TestFlight users. Found 2026-08-10; it was live in June, so it regressed silently |
| 6 | [Feature 4](../ROADMAP.md#feature-4--auto-deploy-to-app-store--google-play) — no automated store deploy, listings unpopulated | Medium | **P0 for the listing** | [#602](https://github.com/RonenMars/threadbase-mobile/issues/602) | App Store Connect needs screenshots, description, privacy-policy URL, support URL and the ratings questionnaire; Play Console needs graphics, content rating, target audience and the data-safety form. Content and legal work, not infrastructure, and it gates the first production submission on both stores |

---

## Still open — P1

| # | Item | Sev | Pri | Issue | Evidence |
|---|---|---|---|---|---|
| 6 | [Retire `useEagerConversations`](./mobile/01-retire-eager-conversations.md) | High | P1 | [#603](https://github.com/RonenMars/threadbase-mobile/issues/603) | Still live in `hooks/useConversations.ts`, `app/index.tsx` and `app/manage-favorites.tsx`. The last ~13-sequential-page fetch per server per refresh — real battery, data and latency cost on device. Blocks Wave C, and may close [#565](https://github.com/RonenMars/threadbase-mobile/issues/565) outright by deleting the cache it patches |
| 7 | [Colocate Hub subscriptions](./mobile/03-colocate-hub-subscriptions.md) | High | P1 | [#604](https://github.com/RonenMars/threadbase-mobile/issues/604) | `ProjectsHub` re-rendered hundreds of times and never settled; `serverFetchStatus` alone accounted for 57 of 120 commits before #566. Visible jank |
| 8 | [Feature 5](../ROADMAP.md#feature-5--polish-the-onboarding-flow) — onboarding closeout | Medium | P1 | [#605](https://github.com/RonenMars/threadbase-mobile/issues/605) | The top XS/S wins shipped on `feat/onboarding-polish-top5`. Still open: manual `tb pair` token exchange in `useTBPair`, and the NotificationsStep re-wire. Onboarding is the OSS first impression, which is why this outranks its raw severity |
| 9 | Local `npm run typecheck` is red — 14 Expo Router typed-route errors | Medium | P1 | [#606](https://github.com/RonenMars/threadbase-mobile/issues/606) | `npx tsc --noEmit --pretty false` reports 14 `TS2345` errors across `app/_layout.tsx`, `app/index.tsx`, `app/session/[id].tsx`, `components/sessions/**` and `components/conversation/ConversationList.tsx`. **CI is green only because `.expo/types/router.d.ts` is not generated there** — so the local and CI signals disagree, and a genuine type error would hide in the noise |

---

## Still open — P2

| Item | Sev | Pri | Note |
|---|---|---|---|
| [Patch the conversation cache instead of invalidating](./mobile/02-conversation-cache-patch.md) | Medium | P2 | **Tracked as [#565](https://github.com/RonenMars/threadbase-mobile/issues/565)** — half shipped. #566's 1000 ms debounce is in `lib/eagerCacheSync.ts:50-58`; line 56 still invalidates the whole query root, so the drain is paced rather than removed. **Sequence after [#603](https://github.com/RonenMars/threadbase-mobile/issues/603)** — retiring `useEagerConversations` deletes one of the caches this would patch, and may close this outright |
| [Measure the render target](./mobile/04-render-measurement.md) | Medium | P2 | ADR 0001's actual criterion — ~1 render per real data change — has **never been measured**. Mechanism evidence exists and is explicitly not the criterion. This is the proof that items 6, 7 and #565 worked — [#607](https://github.com/RonenMars/threadbase-mobile/issues/607) |
| [Bug 20](../BACKLOG.md#bug-20--new-session-from-tree-view-with-path-completion-errors-on-path) — new session from tree view errors on "Path" | Medium | P2 | Undiagnosed and not statically verifiable — needs a repro with the request body captured. May have been fixed incidentally by the streamer path-decode merge (#461); confirm before spending time on it — [#608](https://github.com/RonenMars/threadbase-mobile/issues/608) |
| Bug 31 residual — theming | Low | P2 | 6 surviving `dark.*` references, all in `components/conversation/DiffViewer.tsx:124-179`, plus 124 hex/rgb literals across `app/` and `components/` (some intentional — status colors, brand) — [#609](https://github.com/RonenMars/threadbase-mobile/issues/609) |
| [Feature 17](../ROADMAP.md#feature-17--expand-maestro-e2e-coverage-to-high-value-flows) / [Feature 20](../ROADMAP.md#feature-20--visual-regression-gate-on-maestro-screenshots) — Maestro coverage and screenshot gate | Medium | P2 | Follows item 4; there is no point widening coverage on a suite that cannot signal — [#610](https://github.com/RonenMars/threadbase-mobile/issues/610) |
| [`05_chat_flow` `hideKeyboard`](./mobile/05-chat-flow-hidekeyboard.md) | Low | P3 | A Maestro 2.6.1 / iOS 26.x platform break, not a flow bug. The flow currently fails *earlier*, at `first-session-card` — [#611](https://github.com/RonenMars/threadbase-mobile/issues/611) |

---

## Still open — P3 and deferred

| Item | Note |
|---|---|
| [`/api/projects` cannot see Codex](./streamer/03-decide-api-projects-source.md) | A `readdirSync(~/.claude/projects)` scan structurally cannot see Codex rollouts. Mobile moved to `/api/projects/summary` in #576 — **find the remaining consumers before ranking this**; there may be none — [#612](https://github.com/RonenMars/threadbase-mobile/issues/612) |
| [15 nested worktrees](./repo-health/05-nested-worktree-cleanup.md) | Local developer environment only. Zero release impact — **deliberately not filed as an issue**, since it is one machine's cleanup on a public tracker |
| [Retire the integration branch](./repo-health/06-integration-branch-decision.md) | A decision, not a task. Blocks no release, but #575 and #580 stay orphaned until it is answered — [#613](https://github.com/RonenMars/threadbase-mobile/issues/613) |
| Features 6–15 — the orchestration cluster | Mission Control, cross-session search, tagging, saved views, split view, snippets, workspace sync, Live Activities, voice, scheduled prompts. Suggested order is in [`ROADMAP.md`](../ROADMAP.md); none gate a first release — [#617](https://github.com/RonenMars/threadbase-mobile/issues/617) |
| Features 19, 21–30, 32, 34 | Composer queue UX, tree-view row parity, small UX parity items, React Compiler prerequisites, build-time warning cleanup, batched WS events, Codex prompt cards — [#614](https://github.com/RonenMars/threadbase-mobile/issues/614), [#615](https://github.com/RonenMars/threadbase-mobile/issues/615), [#616](https://github.com/RonenMars/threadbase-mobile/issues/616), [#620](https://github.com/RonenMars/threadbase-mobile/issues/620), [#621](https://github.com/RonenMars/threadbase-mobile/issues/621) — Features 3, 21 and 32 are shipped (above) |
| [Smartwatch session surfaces](../roadmap/tasks/smartwatch-session-surfaces.md) | Explicitly sequenced after Feature 12 — [#619](https://github.com/RonenMars/threadbase-mobile/issues/619) |
| [`IDEAS.md`](../IDEAS.md) | Nothing outstanding — all 10 brainstormed ideas were promoted to Features 6–15 on 2026-05-22 |

### Doc hygiene

- **Deleted 2026-08-10:** `leftovers.md` (inventory of a merged PR's worktree), `KICKOFF-fresh-integration.md` and `fix-maestro-session-flow-prompt.md` (one-shot briefs whose work is done and whose target flows no longer exist), and `audit-nativewind-refactor.md` (an audit prompt premised on SDK 55 for a migration the codebase completed by a different route). Records and postmortems were kept and banded instead.
- `mobile/07-pair-deep-link-route.md` is titled `# 08` internally. Cosmetic, but it breaks anything matching filenames to headings.
- [`RELEASE-BACKLOG.md`](./RELEASE-BACKLOG.md) is superseded by this file, and [`pre-relase-backlog-and-roadmap-analysis-2026-07-18-open-items.md`](../pre-relase-backlog-and-roadmap-analysis-2026-07-18-open-items.md) is three weeks older still.

All three are tracked in [#618](https://github.com/RonenMars/threadbase-mobile/issues/618).

---

## If only three things happen before release

**Ship item 1, then items 2 and 3.**

Item 1 is a first-run failure on the onboarding path the product documents, and the parsing half already exists — only the route is missing. Item 2 is the long pole and has no code in it at all, so starting it late is what makes it the blocker. Item 3 means you cannot trust that anything else here is actually fixed, including the fix for item 1.

---

## Execution plan — what runs in parallel, what does not

The constraints are not the code. There are exactly two: **`app/index.tsx`**, which items 6 and 7 both rewrite in overlapping regions, and **one simulator**, which every device task needs exclusively.

```
WAVE A — fully parallel, no shared files
  A1  pair deep-link route             app/pair.tsx + app/_layout.tsx        [item 1]
  A2  ensure-release-build staleness   e2e/ensure-release-build.js           [item 3]
  A3  scheduled-failure notification   .github/workflows/e2e.yml             [item 4a]
  A4  privacy / store / legal          no code — start day one               [items 2, 5]
  A5  retire useEagerConversations     owns app/index.tsx                    [item 6]

WAVE B — after A2 — device-exclusive, serial within itself
  B1  E2E suite triage: 11/15 to a known-good set                            [item 4b]
  B2  05_chat_flow hideKeyboard                                              [P2]

WAVE C — after A5 — the two run in parallel with each other
  C1  conversation cache-patch                                               [issue #565]
  C2  colocate Hub subscriptions                                             [item 7]

WAVE D — alone, device-exclusive, nothing else building
  D1  measure the ADR 0001 render target                                     [P2]
```

Every serial edge, and why it is real rather than cautious:

- **A2 → B.** You cannot triage a pass set on a harness that reuses a week-old `.app`. Any "known-good four" derived before A2 lands is a guess.
- **A5 → C.** C1 and C2 both build on the retirement, and C2 also owns `app/index.tsx` — running it alongside A5 conflicts in the file that is hardest to review.
- **C → D.** Measuring before C removes the last two sources of the render loop produces a number you will throw away.
- **A1 before A5.** A1 adds one `Stack.Screen` line to `app/_layout.tsx`; landing it first means A5 rebases onto it rather than the reverse.
- **All device work serializes on the one simulator** — A2's verification, all of Wave B, and D1 — regardless of what the dependency graph permits. Two Release builds on one Mac also skew any timing D1 collects.

**A4 is the long pole and has zero code dependencies.** Store console fields, legal review and Sentry dashboard settings are human latency, not engineering latency. Started on day one it runs underneath everything; started last it becomes the thing every other item waits on.

Items 8 and 9 are unblocked and fit anywhere. Item 9 is worth doing early anyway — it restores trust in local `tsc` for every task that follows.

---

## What was re-checked rather than trusted

The older docs were written across several sessions and a number of their claims had already moved. These are the ones that matter:

| Claim in an existing doc | Verified state, 2026-08-10 |
|---|---|
| streamer #461 open, decode bug live on `main` | **Merged** 2026-08-09 18:44 |
| streamer #462 open | **Merged** 2026-08-09 19:38 |
| Bug 5 / Bug 16 / Feature 35 "in flight" on PRs #345 / #346 / #343 | All three PRs are **CLOSED, not merged** — but all three fixes are present in the tree, having landed by another route. Check the code, not the PR |
| Bug 31 — "605 `dark.*` references to migrate" | **6 remain**, all in one file. The migration happened |
| Bug 30 — "add-to-favorites is non-functional, needs a spec" | Fully wired in `stores/quickAccess.ts` |
| Bugs 21 / 23 / 24 / 29 open | Obsolete — Recents and Popular were removed, so the surfaces they describe no longer exist |
| Issue 2 — "9 s accordion stall, needs virtualization" | #576's lazy summaries bound the render to the loaded page. Unmeasured, but no longer O(project size) |
| `dependabot.yml` ignore list unstarted | Merged as #588 |

The general lesson, which is why every row above carries its evidence: **branch names and doc status markers record intent, not outcome.** Read the tree.

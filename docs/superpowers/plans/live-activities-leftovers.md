# Live Activities — actionable leftovers

Snapshot: 2026-08-01, superseding the 2026-07-25 one. Every structural claim below was re-verified on that date; where a fact could not be checked from this machine it says so.

Both halves have shipped, so most of what follows is now history rather than a to-do list. The three items still open are §1.1, §1.2 and §1.3.

| Repo | PRs | Outcome |
|---|---|---|
| tb-mobile | #419–#423 | **all closed unmerged** — the work reached `land/integration-prep` as five direct commits instead: `9f3dbcfe`, `19b00296`, `58ae32f5`, `9a2f84c9`, `67d1e21e` |
| tb-streamer | #292–#294 | **all merged** |

The earlier snapshot named the mobile base as `integration-merge-354-355-376`. That branch does not exist on origin; the one that does is `integration-merge-354-355-376-v2`.

Docs branches `docs/live-activities-runbook` (tb-mobile, `f326f838`) and `docs/live-activities-prompt` (tb-streamer, `bad442d`) are still committed locally, still unpushed, still without PRs. Neither is present on `land/integration-prep`.

---

## 1. Owner-only — nobody else can do these

### 1.1 Uncheck Mac availability in App Store Connect — still open, unverifiable from here
**Why:** stops ITMS-90863 from mattering, and removes the crash risk for anyone who installed via "Designed for iPad" on an Apple silicon Mac. The app is untested on macOS, so this is honest rather than a workaround.

**Path:** App Store Connect → Threadbase → Pricing and Availability → uncheck **"Make this app available on Mac"** → Save.

**First check whether it is even on.** If it is already unchecked the warning is inert and this is a no-op. Nothing on this machine can tell you which it is.

### 1.2 File the Expo issue for ITMS-90863 — the draft has been lost
The draft lived in a session scratchpad under `/private/tmp/`, and the 2026-07-25 snapshot flagged that it should be moved somewhere durable. It was not, and that directory is now gone. Whether the issue was ever filed is not recorded here.

So this is now "rewrite the draft if you still want to file it", not "send the draft". §3.3 has the bisection the draft was built from, which is the part that took the work.

**Why it is still the only real fix path:** the missing symbols are inside `ExpoModulesCore`; nothing in this repo can patch them, and there is still no 57.x to upgrade into.

### 1.3 Decide on the docs branches — still open exactly as written
Two commits exist locally and are unpushed. Either push and open PRs so the runbook is reviewable, or leave them local. No downside either way; just do not lose track of them.

Re-verified 2026-08-01: neither branch is on origin, and the runbook is not on `land/integration-prep`. It exists only in the local `docs/live-activities-runbook` worktree, which puts it one `git worktree remove` away from being lost.

---

## 2. The wire contract — shipped, so re-verify after a rebase rather than before a merge

These were written as pre-integration gates. Both halves have since shipped, so treat this as the contract of record: a decode mismatch does not error, the surface just stops updating.

### 2.1 Seconds vs milliseconds — the highest-risk item
The streamer's `aps` envelope (`timestamp`, `stale-date`) is in **seconds**, while `startedAt` inside content-state is **epoch milliseconds**.

### 2.2 Token `kind` values must match
Mobile must register with `kind: 'liveactivity_start'` (push-to-start, app-wide) or `'liveactivity_update'` (per-activity, requires `activityId`). Omitting `kind` still works and defaults to `expo`, which would silently route Live Activity tokens into the wrong bucket.

### 2.3 Renewal depends on a push-to-start token
Without one registered, a renewal **ends the old activity but starts no replacement**. Symptom looks like "renewal is broken" when the real cause is a missing token. Check this before debugging the scheduler.

### 2.4 Update-token registration payload
For update tokens, mobile must send `sessionId`, `startedAt`, and `staleDate` so renewal can preserve timer continuity across the swap.

### 2.5 Contract field-by-field
Both sides agreed exactly as of the last check:

```ts
{ sessionId, serverId, projectName, status, startedAt, lastOutput, serverLabel? }
```

`status` is `'running' | 'waiting_input'`; `startedAt` is `number` (epoch ms); `lastOutput` ≤ 90 chars, collapsed to one line. Re-verify after any rebase.

---

## 3. Known issues

### 3.1 `staleDate` silent expiry — resolved by the streamer merge
`expo-widgets` hardcodes `staleDate: nil` in three places (`ios/LiveActivity.swift:23`, `:35`, `ios/LiveActivityFactory.swift:30`) with no JS override, which meant Phase 1a shipped silent expiry: at ~8h the surface vanishes and reads to the user as "the session ended" while the session is still running.

**Resolved.** The fix was always Phase 1b — streamer-side renewal — and #292–#294 are now merged, which removes the 8h ceiling entirely. The `expo-widgets` limitation still exists upstream; it just no longer reaches the user.

**Still do not patch expo-widgets.** The reason the original decision pointed at renewal instead is unchanged.

### 3.2 pbxproj build-phase reorder — resolved, issue #424 closed
The concern was that the next `expo prebuild` would reintroduce the build-phase cycle, breaking it for whoever ran prebuild next rather than whoever wrote it. Tracked as #424, `chore(ios): make the live-activity embed-phase reorder survive expo prebuild`, now **closed**.

Note for anyone revisiting: the fix shape was a `withXcodeProject` config plugin reordering the parsed `buildPhases` array — **not** `mergeContents` text-patching, which suits Groovy but not a pbxproj.

### 3.3 ITMS-90863 — no code fix exists, and none has appeared
Bisected conclusively:

| Build | expo-modules-core | Result |
|---|---|---|
| 171 | 57.0.1 | clean |
| 172 | 57.0.1 | clean |
| **173** | **57.0.7** | **ITMS-90863** |

`expo-modules-core` 57.0.7 is still what resolves in `node_modules` as of 2026-08-01.

**Downgrade is not an option.** `@expo/ui` (pinned `~57.0.7`, transitively via `expo-router`) references `expo.modules.kotlin.types.ColorCompat`, which only exists in `expo-modules-core` >= 57.0.6. On 57.0.1 the Android release build fails at `:app:minifyReleaseWithR8`. The pin trades a cosmetic iOS warning for a working Android build — the right side of that trade.

**Expect it to recur.** Now that Live Activities has shipped, the `.appex` adds a second binary to the same Mac-eligibility scan. The trigger is still `supportsTablet: true`, not the extension.

### 3.4 Pre-existing red CI — mobile side addressed
**tb-mobile:** the integration base carried 3 typecheck errors (`makeSearchStyles` undefined in `app/conversation/[id].tsx`, plus two i18n signature errors in `ConnectStep.tsx`) alongside i18n and integration-test failures, none of them attributable to Live Activities. `5fb19a58` — `fix(ci): unblock integration and i18n jobs on the integration base (#454)` — has since landed against exactly this.

**tb-streamer:** lint was red on `__tests__/server.test.ts` (useTemplate ×3) and `__tests__/codex-scan.test.ts` (noUnusedVariables), on the untouched base. Not re-checked for this snapshot.

### 3.5 tb-streamer #293/#294 CI coverage — moot
The concern was that the full workflow gates on base branch, so only #292 ran it while #293/#294 showed Snyk only. All three are now merged, so this is history. The underlying gap — that a green Snyk badge is not "CI passed" — is worth remembering on any future stack.

---

## 4. Corrections to earlier claims — the runbook and prompt are wrong on these

Both documents are still unpushed (§1.3), so these corrections still need applying if either is ever published.

### 4.1 `/api/push/register` was never a stub on the integration branch
The runbook and streamer prompt both assert it is `c.json({ ok: true })` discarding tokens. **That is true on `main` only.** On `integration/missing-prs-2026-07-23` a prior C7 PR already landed real storage: an async handler, `src/db/repositories/push.repository.ts`, migration `012_create_push_tokens.sql`, and `__tests__/push-repository.test.ts`.

Verified directly. PR #292 therefore *extended* that schema (adding `kind`) rather than replacing a no-op.

### 4.2 Scheduler is DB-persisted, not Temporal
The prompt offered Temporal as the preferred option. `@temporalio/client` turned out to be reachable only under `MULTI_AGENT_FLOW`, where the PTY path this observes does not run. The agent correctly chose DB-persisted deadlines with boot re-arm — which was the specified fallback.

---

## 5. Reference

**Runbook:** `docs/superpowers/plans/2026-07-25-live-activities-two-phase-runbook.md` — on the local `docs/live-activities-runbook` branch only, not on origin and not on `land/integration-prep`.
**Integration prompt:** `docs/superpowers/plans/live-activities-prompt-3-integration.md` — same situation, on `docs/live-activities-prompt` in tb-streamer.
**Expo issue draft:** gone. It lived in a `/private/tmp/` session scratchpad that has since been cleaned. See §1.2.

**APNs env vars** (all five required; `APNS_KEY` is PEM contents, not a path):
```bash
export APNS_KEY="$(op read 'op://Personal/Threadbase-p8-file-Notifications-APNs/AuthKey_BX4B6855WV.p8')"
export APNS_KEY_ID=BX4B6855WV
export APNS_TEAM_ID=GUW6BN8X57
export APNS_BUNDLE_ID=com.ronenmars.threadbase
export APNS_HOST=api.sandbox.push.apple.com
```
Env vars do not cross shell sessions — re-export in any new terminal. The feature is off when `APNS_KEY` is unset.

**Production switch:** `APNS_HOST=api.push.apple.com` **and** flip the app's `aps-environment` entitlement from `development`. The key already covers Sandbox & Production.

---

## 6. Housekeeping

- `tb-mobile/tb-mobile-worktrees/` still exists inside the repo root and is still **not gitignored**. It is down to 8K of empty directories, so `git status` no longer reports it and it can no longer be committed by accident — but it should still go, since `CLAUDE.md` requires worktrees to be siblings of the repo rather than nested inside it. `.worktrees/` and `.claude/worktrees/` are ignored; this name is not.
- The pin commit `4ed3dfb8` shipped with **all three test-plan boxes unchecked**, including "smoke-check iOS build still links after ExpoModulesCore 57.0.7 pod bump" — the check that would have caught ITMS-90863 pre-submission. A process gap worth closing when iOS ships ride on Android-motivated dependency changes.
- Of the five dependabot PRs the earlier snapshot listed, four are now closed (#415, #414, #413, #353). Only **#291** (`chore(deps-dev): bump typescript from 6.0.3 to 7.0.2`) is still open. None touched `expo-modules-core`, so none ever affected ITMS-90863.

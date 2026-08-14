# Integration summary — integration/2026-08-12-rehearsal (real run) (2026-08-12)

**Verdict:** ready to land
**Branch:** `integration/2026-08-12-rehearsal` @ `9cf8a12e` (pushed to `origin` as `9cf8a12e796e58f7`) — 11 PRs, 21 commits ahead of `main` @ `a1bf6ef8`
**CI:** not triggered by this push (no PR opened yet) — all five required checks verified green locally during the rehearsal; tree is unchanged, so that verification still holds
**Full log:** [2026-08-12-real-log.md](2026-08-12-real-log.md) — cites [2026-08-12-rehearsal-log.md](2026-08-12-rehearsal-log.md)

This run replayed the 2026-08-12 rehearsal with zero deviation: `origin/main` and all 11 PR heads were
byte-identical to what the rehearsal used, so the rehearsal's branch and worktree were reused as-is and
simply pushed to `origin`. No PR was opened and no merge to `main` occurred — both require separate
explicit consent per the integration-branch skill.

---

## 1. Final refs

| What | Ref | SHA |
|---|---|---|
| Integration branch | `origin/integration/2026-08-12-rehearsal` | `9cf8a12e796e58f71d4d1f061e71637f3826e02d` |
| Cut from | `origin/main` | `a1bf6ef8` |
| Backup / archive | — none (nothing was overwritten; a fresh branch push needs no backup) | |

---

## 2. What is in the branch

| PR | Title | Effect in one line |
|---|---|---|
| #645 | test(e2e): dismiss the browse modal by dragging, not by pressing back | fixes a Maestro flow |
| #654 | fix(terminal): resolve absolute cursor moves against the TUI viewport | terminal CUP fix |
| #657 | fix(hub): source merged-mode search from the server | search correctness fix |
| #658 | test(e2e): match the resume button's flattened accessibility text | Maestro assertion fix |
| #659 | docs: track the agent prompt files in git | docs/tracking only |
| #666 | docs(integration): record the branch retirement and audit the stale refs | docs only |
| #667 | ci(e2e): run Maestro suite on Android | CI workflow addition |
| #671 | feat(live-activity): honour the streamer's liveActivityPush flag | live-activity feature |
| #672 | fix(terminal): rejoin user prompts the PTY wrapped with an indent | terminal fix |
| #673 | feat(browse): show files in the Explorer as view-only rows | Explorer feature |
| #674 | fix(hub): stop re-filtering server search results in the merged list | search fix, stacked on #657 |

### Not included

| PR / branch | Why | Standing exclusion? |
|---|---|---|
| #651 | Full no-op — content already shipped under merged PR #644; rebase produced an empty diff | one-off, user should confirm/close #651 |
| #589–#593 (dependabot) | Excluded by explicit user scope decision for this run | one-off (not a standing rule) |

---

## 3. The order that actually worked

**Final order:** unchanged from the rehearsal (`#645 → #654 → #657 → #674 → #658 → #659 → #666 → #667 → #671 → #672 → #673`, per the rehearsal's determined order — see its log §4 for the exact sequence).

| Constraint | Kind | Reason |
|---|---|---|
| #674 after #657 | stacked | #674's base is #657's own branch; rebase correctly auto-skipped #657's already-applied commit |

No reordering happened mid-run; nothing was re-merged.

---

## 4. Conflicts that mattered

— none. Zero conflicts across all 11 PRs in the rehearsal, unchanged in this replay.

---

## 5. Silent problems found (and the ones still possible)

— none found. **Sweeps run clean** (in the rehearsal, carried over): call-site grep for moved/extracted
functions, blanket per-file resolution check, flag/wiring check — all clean, no merges occurred in this
run to introduce new risk. **Sweeps not run:** none applicable — no new merge activity in this run.

---

## 6. Verification

| | Baseline (`main`) | Final (integration) | Δ |
|---|---|---|---|
| Lint | 0 err / 5 warn | 0 err / 5 warn | unchanged |
| Type check | clean | clean | unchanged |
| Unit tests | 996 passed | 1017 passed | +21 |
| Integration tests | 295 passed | 299 passed | +4 |
| i18n | 55 passed / 1 skip | 55 passed / 1 skip | unchanged |
| Native deps / build | n/a (no native code in scope) | n/a | — |
| Scripts (extra, `scripts/` in scope) | 91 passed | 94 passed | +3 |

**Not verified:** no real iOS/Android device build (not needed — no native code touched). Maestro E2E
not hand-dispatched for #645/#658/#667 in either the rehearsal or this run. GitHub CI was not triggered
by this push since no PR was opened against the branch — "CI green" for this exact push is inferred
from the rehearsal's identical local run, not from a fresh GitHub Actions run.

---

## 7. Obstacles worth remembering

| # | Obstacle | Fix | Recurs? | Automate? |
|---|---|---|---|---|
| 1 | `node_modules/.bin` vanished mid-rehearsal, breaking `test:scripts` twice | `npm rebuild` / reinstall; root cause undiagnosed | maybe | worth a follow-up if it recurs a third time |
| 2 | `test:scripts`'s `land-version-bump.test.js` mutates real `app.json`/`android/app/build.gradle` as a side effect (discarded each time) | none applied — noted only | yes, every run touching `scripts/` | yes — hermetic test fixture |

(Both carried over verbatim from the rehearsal; this run introduced no new obstacles.)

---

## 8. Follow-ups

| Item | Why it is open | Next action | Owner | Issue |
|---|---|---|---|---|
| Close #651 as superseded | It's a no-op already shipped under #644 | User confirms and closes on GitHub | user | — |
| Open a PR for `integration/2026-08-12-rehearsal` (optional) | Not yet consented to in this run | Ask user if CI visibility on the combined branch is wanted | user | — |
| Land the 11 PRs individually onto `main` | This skill never merges to `main` — that's separate | Rebase + squash-merge each PR in dependency order, per repo convention | user | — |
| `test:scripts` hermetic fixture fix | Real-file mutation side effect (Obstacle #2) | File a follow-up if it causes a false failure | user | — |
| Expiry of `integration/2026-08-12-rehearsal` | Per skill Step 9 — an integration branch is a staging area, not a parallel trunk | Delete (local + remote) once `main` holds all 11 PRs' content, via their individual PR merges. **Do not develop on this branch.** | user, on request | — |

---

## 9. Rules learned

- When a real run's preconditions match the rehearsal exactly (unchanged `origin/main`, unchanged PR
  heads), the real run reduces to a single `git push` of the already-built branch — no re-merge, no
  re-test needed, but say so explicitly rather than silently skipping verification.
- Pushing a branch with no PR does not trigger the required-checks workflow set on this repo; "CI
  green" claims for a pushed-but-PR-less branch must cite the local run that established it, not GitHub.

---

## 10. Cost

Wall-clock: ~15 minutes total (precondition check ~5 min, push+confirm ~1 min, log/summary write-up
~7 min). Zero conflicts resolved (all 11 PRs, zero conflicts, in both the rehearsal and this replay).
No time sinks — this was the fast path the rehearsal exists to enable.

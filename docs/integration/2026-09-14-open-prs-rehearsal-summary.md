# Integration summary — integration/2026-09-14-open-prs (2026-09-14) — REHEARSAL

**Verdict:** ready to land, with one INT follow-up to replay
**Branch:** `integration/2026-09-14-open-prs` @ `d9918adb` — 5 PRs, 12 commits ahead of cut-point `main` @ `72fd3970`
**CI:** not run on this branch. Final local checkpoint: lint, typecheck, unit 2187, integration 533, i18n 460 passed / 1 skipped, scripts 253 / 40, native-deps pass after #1090.
**Full log:** [2026-09-14-open-prs-rehearsal-log.md](2026-09-14-open-prs-rehearsal-log.md)

Five green PRs onto today's `main`, plus INT follow-up `e8795ed1` so #1085's e2ee protocol-mismatch returns carry the `namedId` that #1089's AlertHost type requires. Nothing pushed. #952 and #1039 stay out.

---

## 1. Final refs

| What | Ref | SHA |
|---|---|---|
| Integration branch | `integration/2026-09-14-open-prs` | `d9918adb` (local only) |
| Cut from | `origin/main` at start | `72fd3970` |
| Base PR branch | #1085 `feat/web-e2ee-webcrypto` | `b359c2bf` |
| Worktree | `../tb-mobile-worktrees/int-2026-09-14` | own `npm ci` (again after #1090) |
| Backup / archive | — | prior local INT `integration/2026-09-12-open-prs` left in `../tb-mobile-worktrees/int-2026-09-12`; never on origin |

During the run origin/main advanced to `58bbd07a` (`#1090` squash). Ahead counts in the log are vs the cut point.

---

## 2. What is in the branch

| PR | Title | Effect in one line |
|---|---|---|
| #1085 | feat(e2ee): pair and connect encrypted from the web client | Web client pairs and connects with WebCrypto e2ee; protocol mismatch is named on the server row |
| #1088 | ci(e2e): speed mock suite with arm64 builds, caches, and weighted shards | Mock Maestro suite is faster (arm64, caches, weighted shards) |
| #1089 | feat(alerts): add the AlertHost arbiter and cause-keyed store | Toasts go through a cause-keyed AlertHost arbiter |
| #1090 | fix(deps): pin react-dom to 19.2.3 to match react | `react-dom` 19.2.8 → 19.2.3 (also landed on origin as `58bbd07a` during the run) |
| #1091 | docs(providers): record cursor-cli history indexing [skip-ci] | add-provider skill + session-list README note cursor-cli history indexing |
| INT | `e8795ed1` | `namedId` on the two e2ee protocol-mismatch `ServerStateMessage` returns |

### Not included

| PR / branch | Why | Standing exclusion? |
|---|---|---|
| #952 jest-preset 0.87.1 | CI red; nothing in the set repairs it | no — one-off until green |
| #1039 react-native 0.87.1 | CI red (typecheck + suites) | no — one-off until green |

**Drafts:** none in the set.

---

## 3. The order that actually worked

**Final order:** `#1085 → #1088 → #1089 → (INT namedId follow-up) → #1090 → #1091`

| Constraint | Kind | Reason |
|---|---|---|
| #1089 after #1085 | overlap, not stack | shares `ServerStateMessage.tsx` and its i18n test; chronological already puts #1089 later |
| INT follow-up immediately after #1089 | forced | auto-merge left `namedId` off the e2ee returns; typecheck red until `e8795ed1` |

---

## 4. Conflicts that mattered

— none (git raised zero markers). The overlap was a semantic-sweep + typecheck item, not a ledger `J` row.

---

## 5. Silent problems found (and the ones still possible)

| Found | Where | How it was caught |
|---|---|---|
| `namedId` missing on two `e2eeProtocolMismatch` returns | `components/servers/ServerStateMessage.tsx` | `tsc` TS2741 after #1089; git did not flag |

**Sweeps run clean:** overlapping `ServerStateMessage.tsx` and i18n test kept e2ee copy **and** AlertHost/`useAlertSync` wiring · no moved functions · no whole-file resolutions. **Sweeps not run:** Maestro / simulator / device builds; `pod install` (JS-only `react-dom` pin).

---

## 6. Verification

| | Baseline (`main` `72fd3970`) | Final (integration `d9918adb`) | Δ |
|---|---|---|---|
| lint | green | green | 0 |
| typecheck | green | green | 0 (red between #1089 merge and `e8795ed1`) |
| unit | 2147 / 212 | 2187 / 215 | +40 tests, +3 suites |
| integration | 531 / 71 | 533 / 71 | +2 |
| i18n | 460 passed / 1 skipped (1211 keys) | same jest; 1222 keys | +11 keys |
| scripts | 235 / 39 | 253 / 40 | +18 tests, +1 suite |
| native-deps | skipped | pass after #1090 | — |

**Not verified:** Maestro e2e, device/simulator build, Flow C (push). Jest workers force-exited (pre-existing leak); suites still reported pass.

---

## 7. Obstacles worth remembering

| # | Obstacle | Fix | Recurs? | Automate? |
|---|---|---|---|---|
| O1 | Overlap auto-merge omitted a field a later PR made required | INT `e8795ed1`; replay after #1089 in Flow C | yes | typecheck after every overlapping merge (already required) |
| O2 | #1090 squash-merged to origin mid-rehearsal | replay from `refs/integration/pr/1090`; do not skip | yes | re-read PR state immediately before taking it (already required) |

---

## 8. Follow-ups

| Item | Why it is open | Next action | Owner | Issue |
|---|---|---|---|---|
| Flow C | rehearsal complete; origin still read-only for this branch | ask whether to replay against `origin` | operator | — |
| `e8795ed1` | INT-only union of #1085 + #1089 | land equivalent on one of those PRs, or replay the follow-up in Flow C | operator | — |
| #952 / #1039 | red RN 0.87 bumps | keep out until green | — | — |
| #1090 on origin | already on `main` as `58bbd07a` | Flow C can skip re-landing it on GitHub; INT still carries the pin vs the cut point | — | — |

---

## 9. Rules learned

- Overlap without a conflict marker still needs a typecheck before the next merge: #1089's rebase was clean and still dropped `namedId` from #1085's new returns. Record the sweep **and** run `tsc`.
- A PR that lands on origin mid-rehearsal is not dropped from the INT; replay the fetched private ref so the cut-point tree still contains it.

---

## 10. Cost

Wall-clock ~30 min of suite time across six full checkpoints (baseline + five PRs; #1089 ran typecheck twice). 5 PRs, 0 git conflicts, 1 silent type hole. Biggest sinks: the unit+integration checkpoints.

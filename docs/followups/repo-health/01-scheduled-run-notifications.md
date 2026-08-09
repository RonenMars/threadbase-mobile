# 01 — Nothing reports a failed scheduled workflow

**Priority: highest.** A monitor nobody reads is worse than no monitor — it implies coverage that is not there.

## State of play

The Maestro E2E job failed three consecutive monthly runs and nobody noticed:

| Scheduled run | Result | Failing step |
|---|---|---|
| 2026-06-01 | failure | Build and install iOS app (Release) |
| 2026-07-01 | failure | Build and install iOS app (Release) |
| 2026-08-01 | failure | Build and install iOS app (Release) |

It surfaced only because someone dispatched the workflow by hand while working on something unrelated.

The cause is structural: a `schedule`-triggered run has no PR to report into, so a red result lands in the Actions tab and nowhere else. The E2E workflow (`.github/workflows/e2e.yml`, dispatch + monthly cron) is the only scheduled job in the repo, so it is the only one with this blind spot.

The plan already exists — `docs/deploy-failure-notifications-plan.md`, last checklist item:

```
- [ ] (Optional) Mirror the same job into `test.yml` if CI-test failures also warrant a push alert.
```

Three silent months is the argument for dropping "optional". Reuse whatever path the deploy-failure alert already uses rather than inventing a second mechanism.

## Scope

Scope this to `schedule`-triggered runs. Per-PR CI already reports through checks; adding alerts there is noise, and the plan doc says as much.

Mirroring into `test.yml` as the doc suggests is broader than the problem — `e2e.yml` alone would close it. Either is acceptable; note which you chose and why.

## Done when

- A failed scheduled E2E run produces a notification through the same path deploy failures use.
- The mechanism is exercised at least once — a deliberately failing run, or the alert step invoked directly. Do not ship this one unverified; an unverified notifier is the exact failure mode being fixed.
- `docs/deploy-failure-notifications-plan.md`'s checklist item is ticked or amended to match what was built.

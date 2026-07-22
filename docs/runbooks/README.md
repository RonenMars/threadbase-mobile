# Runbooks

Executable procedures. A runbook tells you how to carry out work that is risky, sequential, or easy to get subtly wrong — and, critically, what failure looks like at each step.

**A runbook is not a postmortem / merge report.** A report records what happened at a point in time and stops changing once written; a runbook is a living document, edited every time reality moves. A runbook should link to its report for the *why* rather than restating it — two copies of the same analysis drift.

## Files here

| File | What it is |
|---|---|
| [`_template.md`](_template.md) | The format. Copy it to `YYYY-MM-DD-<slug>.md` and fill it in. It opens with the seven rules its sections encode. |
| [`_example-streamer-land-open-prs.md`](_example-streamer-land-open-prs.md) | A **reference example** — the same template filled in for the *streamer* repo's PR-landing chain. Use it to see the shape of a completed runbook; its PR numbers and paths are streamer-specific and do not apply here. |
| `2026-07-22-land-open-prs.md` | *(to be authored)* the mobile PR-landing runbook, derived from [`../integration-merge-report-2026-07-22.md`](../integration-merge-report-2026-07-22.md). |

The `_`-prefix marks files that are not themselves runbooks (the template and the cross-repo example), so a directory listing separates them from real, dated runbooks.

# Triage Labels

The skills speak in terms of five canonical triage roles.
This file maps those roles to the actual label strings used in this repo's issue tracker.

| Label in mattpocock/skills | Label in our tracker | Meaning                                  |
| -------------------------- | -------------------- | ---------------------------------------- |
| `needs-triage`             | `needs-triage`       | Maintainer needs to evaluate this issue  |
| `needs-info`               | `needs-info`         | Waiting on reporter for more information |
| `ready-for-agent`          | `ready-for-agent`    | Fully specified, ready for an AFK agent  |
| `ready-for-human`          | `ready-for-human`    | Requires human implementation            |
| `wontfix`                  | `wontfix`            | Will not be actioned                     |

All five exist on `RonenMars/threadbase-mobile`.
`wontfix` predates this setup; the other four were created on 2026-08-14.

When a skill mentions a role (e.g. "apply the AFK-ready triage label"), use the corresponding label string from this table.

## These are additive, not a replacement

This repo already has a label taxonomy defined canonically in [`threadbase/docs/issue-tracker.md`](https://github.com/RonenMars/threadbase/blob/main/docs/issue-tracker.md):

- **Priority** — exactly one of `P0`, `P1`, `P2`, `P3`, mirrored as the `P<N>:` title prefix
- **Type** — exactly one of `bug`, `enhancement`, `documentation`, `question`, `tech-debt`
- **Area** — zero or more of `ci`, `e2e`, `native`, `performance`, `platform`, `provider`, `security`, `ux`, `observability`

A triage label answers *"what happens to this issue next"*.
Priority, type, and area answer *"what is this issue"*.
They are orthogonal, so applying a triage label never means removing or substituting one of the others — a well-formed issue carries a priority, a type, and (while in flight) a triage state.

Two near-collisions worth naming, because reaching for the existing label instead of the triage one loses information:

- `question` is a **type** — "further information is requested" as a permanent classification of the issue. `needs-info` is a **state** — "blocked on the reporter right now". An issue can be `question` + `ready-for-human`, or `bug` + `needs-info`.
- `wontfix` is the one label serving both roles at once. Applying it is a terminal decision, not a state to move out of.

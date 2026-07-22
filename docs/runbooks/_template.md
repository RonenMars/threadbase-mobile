# Runbook template

Copy this to `docs/runbooks/YYYY-MM-DD-<slug>.md` and fill it in. Delete any section that genuinely does not apply — an empty heading is worse than no heading.

A runbook is **not** a postmortem. A postmortem records what happened at a point in time and should stop changing once written; a runbook is an executable procedure with a lifetime, edited every time reality moves. Keep them in separate files, and have the runbook link back to the postmortem for the *why* rather than restating it.

## What makes these useful (the rules the sections below encode)

1. **State what failure looks like, not just what to do.** A step that says "resolve the conflict" is worthless next to one that says "this merge is clean and silently drops the freeze — open the method and check."
2. **Anything already decided goes at the top.** Exclusions, closures and "do not merge this" belong in one table, not scattered across the body.
3. **Order by risk, not by identifier.** Group the mechanical work together and the dangerous work together; say which must go first and why.
4. **Point at existing analysis, do not restate it.** Link the postmortem section that documents each conflict. Restating invites the two copies to drift.
5. **Record the traps that produce green signals.** Those are the only ones a careful operator still walks into.
6. **Say who should run it.** Match the operator — model and reasoning effort — to the failure mode of each phase, not to the apparent difficulty.
7. **Name the stop points, and the non-stop points.** A runbook an agent can execute needs both: where it must hand back control, and the reversible majority where asking would just be noise. A stop list without a do-not-stop list gets ignored wholesale.

---

# <Title> — <one line on what this gets you>

**Source:** link to the postmortem/analysis this derives from. Note the naming used for cross-references.
**Status:** live procedure — edit it as the work proceeds.

<One paragraph: what the preceding work established, what this document does that the preceding work did not, and the single most important thing to know before starting.>

## Who should run this

<Only split by phase if the phases genuinely differ in failure mode. If uniform, say so in a sentence.>

| Phase | Character of the work | Model | Effort |
|---|---|---|---|
| | | | |

<Explain the split in terms of what failure looks like, not command difficulty. Name any model that should not be used, and why. Include a **reasoning effort** per phase, and justify both ends: why not lower (what gets skipped when the operator is in a hurry) and why not higher (what extra deliberation would not buy). Effort is worth raising specifically where the failure is *absence* — something missing that no error reports.>

**Operating constraints:**

- <Context/session boundaries — where exhaustion mid-step would corrupt state.>
- <Serialisation requirements — what must never run in parallel, and what breaks if it does.>
- <Verification discipline specific to this task.>

## Before starting — decide these once

| Item | Decision |
|---|---|
| | **Excluded / Close / Land.** Reason, plus anything worth salvaging first. |

That leaves **N items**.

## Pre-flight

<A concrete command that sweeps for blockers, plus how to read its output: which states are normal and handled later, and which are genuine blockers. Record any tooling quirk that makes the output lie — lazy computation, caching, needing a second run.>

Found this way, <date>: <list what the sweep actually caught, so the next reader knows it earns its keep.>

## The per-item loop

<Numbered, one item at a time. Include the verification gate and what to do when it is red. Flag any step that cannot be satisfied for a subset of items, and what to substitute.>

## Stop and wait for approval

<Hard stops for an agent running this unattended. Two lists, both necessary:>

<**Always stop before** — irreversible or outward-facing actions: writes to shared branches, commits, force-pushes, closing others' work, anything published. For each, say what evidence to present at the stop.>

<**Stop and ask when the situation is not the one this document describes** — a conflict not documented, a check that comes back wrong, CI red after one re-run, a blocker the pre-flight did not predict, or a claim that cannot be proven mechanically. These are the stops that matter most: the first list is obvious, this one is what stops an agent confidently doing the wrong thing.>

<**Do not stop for these** — the reversible majority. Naming them explicitly is what keeps the stop list credible; an agent that asks about everything gets waved through on everything.>

## Order

<Grouped by risk. For each group: which items, why they are grouped, which must go first. Name the specific conflicts each will hit and link the analysis.>

## Known traps

<One subsection per trap that produces a *green* signal. For each: the mechanism, why it is invisible, and the exact check to run afterwards. This is the highest-value section — a trap that announces itself does not need a runbook.>

## Moving target

<Anything that invalidates preparation done in advance: an auto-updating dependency, a branch that advances, an external service. Say how far ahead preparation stays valid.>

## Content that exists nowhere else

<Work that lives only in the intermediate artefact and will have to be re-derived. Before listing something here, verify the source fails on it alone — otherwise it belongs at the source and listing it here sends the next operator into a red build with no diagnosis.>

## Definition of done

<An observable end state, not "all items processed". Ideally one that makes leftovers self-evident.>

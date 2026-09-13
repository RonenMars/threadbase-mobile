# Prompt to paste into Claude Code

`README.md` is the **specification**, not the prompt. It is deliberately longer than a prompt should be, because it is the thing you want in context while work happens. Paste one of the prompts below instead and let it read the spec itself.

Run from the root of a `threadbase-mobile` checkout, with this folder copied in (e.g. to `docs/design/session-list/`).

---

## 1. Start here — plan mode

Run this in **plan mode** (shift+tab twice). The task is entirely reads plus a plan, so plan mode enforces read-only structurally instead of relying on an instruction — which is why the prompt does not need to say "do not write code".

If the audit contradicts this brief, **the audit wins**: it is reading today's `main`.

```
Read docs/design/session-list/README.md in full, plus the screenshots in
docs/design/session-list/screenshots/.

Then verify the brief against this repo before doing anything else. For each of
the 15 items under "Known defects this brief fixes", find the code it names and
tell me whether the claim still holds on main — quote path:line. Flag anything
the brief gets wrong; it was written from a read of main and the repo moves.

Then give me the PR sequence from the brief as a plan, with the files each PR
touches and the locale keys it adds and removes.
```

Suggested effort: `xhigh` — the audit's value is in how many files it reads before answering.

## 2. Then, one PR at a time

Approve the plan, then leave plan mode **per PR**. Do not hand it the whole ten-PR plan with edits enabled.

```
Implement PR 1 from docs/design/session-list/README.md: the liveness gate.

Constraints from the brief and CLAUDE.md:
- Branch fix/live-gate-process-liveness, one PR, rebase onto origin/main first.
- No new colour tokens, no new locale strings beyond the brief's i18n list.
- i18next/no-literal-string runs at error; npm run test:i18n fails on unused
  keys too, so remove retired keys in the same PR across en, he, ar, ru.
- Every new component under components/** needs a matching *.stories.tsx or the
  pre-commit hook blocks the commit.
- Phosphor icons only, no emoji.
- Unit-test the gate. Confirm any SessionScreen failure serially with
  npx jest --ci --runInBand --testPathPattern "SessionScreen" before treating it
  as real.

Show me the diff before committing.
```

Repeat for PRs 2–10, in that order — they are sequenced by dependency. PRs 1 and 2 are shippable on their own and do not require the redesign.

Suggested effort per PR: `medium` for 1, 2 and 10 (precisely described, mechanical); `high` for 3, 5, 7 and 8; `xhigh` for 4, 6 and 9 (many edge cases, design fidelity, or a migration plus Maestro flows). Effort names are calibrated per model — don't carry these settings across a model switch.

## 3. For the two PRs that need judgement

**PR 4 (titles)** — write `lib/displayTitle.ts` test-first. The six rules in the brief map to test cases; the fixtures worth using are the real failures from the screenshots: `<image name=[Image #1] path="/var/folders/…">`, `# Implement \`ws\` v1: feature-centric cross-repo workspaces`, `<user_action>`, `hi` / `hey` / `Ahoy` / `Hello there`, `Look for the real projects in this library total 48280 drwxr-xr-x@ 84 …`, and `no git · 145h 30m`.

**PR 9 (Tree retirement)** — persisted `sessionsLayout: 'tree'` must migrate, and `e2e/browse.yaml` plus `e2e/feat1_tree_drill_new_session.yaml` reference the Tree layout. Ask before deleting a flow.

---

## Answer the open questions first if you can

The brief ends with four questions (per-project today counts, `waiting_input` start time, Cursor's wire value, where the settings migration belongs). Three are answerable from the streamer's API and the settings store. Answering them before PR 6 avoids designing around a guess.

---

## What not to do

- Do not port the HTML or its CSS. It is a design reference; rebuild in RN / NativeWind with the existing components.
- Do not implement forked / duplicate row handling. Explicitly out of scope.
- Do not add a parsed-question UI or an "Answer" button to the list — the Needs-you card shows `session.lastOutput` verbatim and nothing more.
- Do not render determinate progress. There is no percentage in the API.
- Do not introduce a new hue. The two Rosé Pine `status.running` overrides are the only palette change.

---

## 4. Replying to the audit (and using the design MCP)

If Claude Code has the **claude-design MCP**, point it at the live design doc instead of the PNGs — it can read geometry off the nodes rather than measuring a screenshot.

Open `Session List Redesign.dc.html` in that workspace. It is organised as turns, newest first, and every option carries a visible id badge:

| id | What | Status |
|---|---|---|
| `4a` | Now — surfaces, glass header, canvas, spacing | **spec** |
| `3a` | Now — content and row anatomy | **spec** |
| `5a` | Projects — card states, path drill entry | **spec** |
| `2b` | Filter &amp; sort, rebuilt | **spec** |
| `5b` | Edge states + multi-machine grouping | **spec** |
| `1d` | State tiers + title pipeline, written | **spec** |
| `2a`, `1a` | Today's UI annotated | the *before*, for diffing |
| `1b`, `1c`, `1e` | Earlier Now / Projects / filter passes | superseded |
| `3b`, `3c` | Colour and badge options | decided (A, T3) |

Rules for the reply prompt: the audit wins over the brief; the audit's PR sequence replaces the one below; and **any PR that changes a decision updates the README in the same PR**, so the doc does not drift from the code.


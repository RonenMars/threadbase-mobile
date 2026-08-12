# Project skills

Repo-scoped skills for Claude Code. Each subdirectory is one skill, with its instructions in `SKILL.md`.

**Nothing registers them.** Claude Code discovers every `.claude/skills/<name>/SKILL.md` in the project
automatically — there is no list in `CLAUDE.md` or `AGENTS.md`, no settings entry, no build step. Adding
a directory is the whole installation.

A directory without a `SKILL.md` is not a skill, which is what makes `_shared/` work: it holds fragments
the ship skills include (`pre-ship-checks.md`), and discovery walks straight past it. This `README.md` is
skipped for the same reason.

Where `CLAUDE.md` mentions a skill, it is giving repo context at the place that context is needed, not
registering anything. Do not add a skill to `CLAUDE.md` just to make it visible; it already is.

## What is here

| Skill | Use it when |
|---|---|
| [`expo-local-ship`](expo-local-ship/SKILL.md) | **The default ship path.** Building and shipping iOS locally on macOS with native CLI tooling — every release operation unless another is named explicitly |
| [`ship-expo-cloud`](ship-expo-cloud/SKILL.md) | EAS cloud build and submit — **only** when the user types `/ship-expo-cloud` |
| [`ship-fastlane`](ship-fastlane/SKILL.md) | Vanilla fastlane TestFlight pipeline — **only** when the user types `/ship-fastlane` |
| [`ship`](ship/SKILL.md) | Pushing a committed branch, opening a PR, watching CI, merging on confirmation — the git-side ship, not a release |
| [`setup-cloudflared`](setup-cloudflared/SKILL.md) | Exposing Metro over HTTPS through a Cloudflare tunnel for remote dev |
| [`integration-branch`](integration-branch/SKILL.md) | Staging a set of open PRs on one disposable branch to test them together, with a merge log and summary |
| `_shared` | Not a skill — shared fragments the ship skills include |

The three release skills overlap deliberately and their descriptions carry the routing rules, because
picking the wrong one ships through the wrong pipeline. `expo-local-ship` is the default; the other two
require the user to name them.

## Adding one

```
.claude/skills/<kebab-case-name>/SKILL.md
```

```markdown
---
name: <same as the directory name>
description: <what it does, then the phrasings that should trigger it>
---

# <Title>

## Step 1 — …
```

Two things decide whether a skill is any use:

- **The `description` is the trigger.** It is the only part read when deciding whether to invoke, so it
  must carry both what the skill does *and* the words a user would actually say. Where two skills could
  both match, say which wins — that is exactly what the `ship-*` descriptions do.
- **The body is executed, not read for inspiration.** Write imperative steps with the real commands. Put
  the traps inline at the step where they bite, not in a section at the end.

Conventions in this repo:

- Directory name, `name:` field, and the title all match.
- State plainly what the skill must never do (push to `main`, submit a build, delete a branch unasked).
- **Never tell a skill to write the skip tag by hand.** The `commit-msg` hook appends it automatically
  when a commit touches nothing in `scripts/git-hooks/ci-paths.txt`. It exits early whenever the literal
  tag appears **anywhere in the message**, so typing it yourself overrides the path check — and, less
  obviously, so does merely *discussing* it in the commit body, which silently costs a docs-only commit
  its tag and runs the full matrix. Write "the skip tag" in prose; let the hook write the real one.
  (CI itself is stricter and reads only the commit subject and PR title, so body prose cannot skip a
  real run — the failure is a wasted matrix, not a missed one.)
- A skill that claims CI is green must name the checks that gate `main` — Lint, Type check, Unit tests,
  Integration tests, i18n. `test:unit` alone is a false green, and Maestro E2E never runs on a PR.
- Cite repo docs by relative path rather than restating them — `CLAUDE.md` and `docs/` stay canonical.
- Skills carrying their own templates keep them in `docs/`, not inside the skill directory, so humans can
  find them without knowing a skill exists.

Personal skills live in `~/.claude/skills/` and are discovered the same way; put a skill here only when
it is about *this* repo.

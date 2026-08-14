# Prompt — introduce an app `env` and gate the sentry-cli requirements on it

Hand this to a fresh agent session opened in `~/dev/ai-tools/tb-mobile`.

> **Work in a new git worktree, outside the repo root.** Do not edit the main checkout — other sessions and verification runs use it, and a stray edit there gets read by whoever is mid-task. The exact command is under [Workflow](#workflow).
>
> If `../tb-mobile-worktrees/app-env-sentry` or the branch `feat/app-env-sentry-gating` already exists, someone is running this now or has run it before — check `git worktree list` and `gh pr list` before starting, and pick a unique suffix rather than reusing them.

---

## The defect

A Release build fails outright when the Sentry source-map upload credentials are absent, even in contexts that have no use for uploaded source maps.

Observed 2026-08-14 in E2E run [31813189915](https://github.com/RonenMars/threadbase-mobile/actions/runs/31813189915), building `integration/2026-08-14-rebuild` @ `0984f89a`:

```
error: sentry-cli -   INFO  Loaded file referenced by SENTRY_PROPERTIES (sentry.properties)
error: sentry-cli - error: An organization ID or slug is required (provide with --org, set SENTRY_ORG, or use an org-scoped auth token)
error: sentry-cli - To disable source maps auto upload, set SENTRY_DISABLE_AUTO_UPLOAD=true in your environment variables. Or to allow failing upload, set SENTRY_ALLOW_FAILURE=true
##[error]Process completed with exit code 65.
```

**No Maestro flow ran.** The job died in `Build and install iOS app (Release)`, so the ~$3 macOS runner was spent producing no test signal at all.

## Verified state

Checked 2026-08-14 against `origin/main` @ `2580f910`:

- `grep -n SENTRY .github/workflows/e2e.yml` → **no matches.** The E2E workflow passes no Sentry environment whatsoever.
- `.github/workflows/deploy.yml:162-164` and `:398-400` both set `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` from repo secrets.
- That difference is the whole bug: the `@sentry/react-native/expo` config plugin (`app.json:97`) injects an Xcode build phase that shells out to `sentry-cli` on **every** Release build. Deploy supplies the credentials, E2E does not, and the same commit therefore builds green in one workflow and red in the other — confirmed on `0984f89a`, where `Ship iOS` succeeded twenty minutes before `E2E maestro (iOS)` failed.
- The last five E2E dispatches all failed: runs `31813189915`, `31579631027`, `31577598833`, `31572797484`, `31569739088`. I confirmed the cause only for the most recent one; **do not assume the other four share it** — check before claiming this fixes them.
- `.env.example` already documents `SENTRY_AUTH_TOKEN` as a secret that must live only in the build environment, never in a committed env file. That rule stays.
- `services/sentry.ts:48-56` already has a `resolveEnvironment()` returning `'development'` when `__DEV__`, else the EAS channel, else `'production'`. **This is runtime tagging for event metadata only.** It is not readable at build time and is not the thing being introduced here. Decide deliberately whether the new build-time env feeds it or stays separate, and say which in the PR body.
- There is no `app.config.js` — configuration is the static `app.json`. Introducing a build-time env may mean adding one; that is your call.

## What to build

A single `env` concept for the app, with exactly two behaviours around the sentry-cli credentials:

| `env` | sentry-cli env vars (`SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`) |
|---|---|
| `production` | **Required.** Absent → fail, early and with a message naming which var is missing. |
| `development` | **Optional.** Absent → skip the upload and continue; the build must succeed. |

Two properties matter more than the mechanism:

1. **`production` must fail early, not at the Xcode build phase.** The current failure arrives ~90 seconds into a compile, buried in clang output. A missing credential is knowable before the first file compiles.
2. **`development` must not silently degrade a production build.** Whatever selects the env must make the wrong value hard to reach by accident — a default of `development` that a release pipeline can inherit by forgetting a flag is worse than the current loud failure.

`sentry-cli` names its own escape hatches in the log above: `SENTRY_DISABLE_AUTO_UPLOAD=true` and `SENTRY_ALLOW_FAILURE=true`. These are the obvious lever for the `development` path. They are not equivalent — one skips the upload, the other tolerates its failure — so pick one on purpose and write down why in a comment.

Prefer the smallest thing that holds. A resolved env var plus one guard script that both workflows call is likely enough; a config layer, a schema, or a typed env module is almost certainly more than this needs. If you find yourself adding a third env value, stop and ask.

## Scope

Files you own:

- `.github/workflows/e2e.yml` — must build Release without Sentry credentials
- `.github/workflows/deploy.yml` — must keep requiring them
- `.env.example` and whatever selects the env
- `app.json` / a new `app.config.js`, if the mechanism needs it
- `scripts/` for the guard, if you add one
- tests under `__tests__/`

Do not touch `services/sentry.ts`, `services/sanitize.ts`, or anything under `app/` — the runtime reporting path is not in scope and is governed by privacy invariants documented in that file's header.

If you add a root-level script directory or config file, **`scripts/git-hooks/ci-paths.txt` and `docs/ci-significant-paths.md` both need the entry** — see the rule in `CLAUDE.md`. A missing entry gets real changes silently tagged `[skip-ci]`.

## What "fixed" looks like

1. An E2E dispatch against a branch completes the Release build and **actually runs the Maestro flows**, with no Sentry credentials present. Whether the flows pass is a separate question — reaching them is the bar here.
2. A Deploy run still uploads source maps and still fails, early and legibly, if a credential is missing.
3. `npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm run test:integration` and `npm run test:i18n` all stay green — these five gate `main`.

Leave one runnable check behind for the guard logic — the smallest thing that fails if the env branch inverts. No framework, no fixtures.

## The trap that will cost you an hour

**A `workflow_dispatch` definition is read from the default branch.** Your fix to `e2e.yml` does nothing on a feature branch: dispatching `E2E -f ref=your/branch` runs `main`'s copy of the workflow against your branch's code. You cannot verify property (1) above until the PR lands.

Plan for that: verify the guard script and the build locally (`npm run ios --configuration Release`, or an `xcodebuild` archive with the Sentry vars unset), state plainly in the PR that the workflow half is unverified until merge, and dispatch E2E once immediately after it lands. Do not describe it as verified before then.

## Workflow

```bash
git -C ~/dev/ai-tools/tb-mobile fetch origin
git -C ~/dev/ai-tools/tb-mobile worktree add ../tb-mobile-worktrees/app-env-sentry -b feat/app-env-sentry-gating origin/main
cd ~/dev/ai-tools/tb-mobile-worktrees/app-env-sentry
npm ci
```

`npm ci` in the worktree is not optional — a copied or symlinked `node_modules` makes Metro bundle the main repo and hides lockfile drift.

Then: implement, run the five checks, `npx eslint` the staged files, and open a PR against `main` titled `fix(ci): gate the sentry-cli credentials on an app env` (or a better `type(scope): summary` of your choosing). One sentence per line in the PR body. No AI attribution anywhere.

## Open question to resolve, not to guess

Does the new build-time `env` subsume `resolveEnvironment()` in `services/sentry.ts`, or sit beside it? Two sources of truth for "what environment is this" is exactly the kind of thing that reads as fine for six months and then tags a production crash as `development`. Decide, justify it in the PR body, and if they stay separate, add a comment in each pointing at the other.

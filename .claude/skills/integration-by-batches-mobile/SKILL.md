---
name: integration-by-batches-mobile
description: threadbase-mobile's side of batched PR integration - QA through a pushed test tag and qa.yml, jest/pod/shard specifics for building a batch, landing under the main protection ruleset, and the streamer-pairing rules. Use together with the shared skill threadbase-skills:integration-by-batches when the user says "batch the open PRs", "integrate in batches", or "group the PRs and QA each group" in this repo.
---

# Integration by batches (mobile)

The method (hard rules, grouping, plan and log, QA findings, landing loop, cleanup) lives in the shared skill `threadbase-skills:integration-by-batches`. Read it first. This file holds only what is specific to this repo. Where it is stricter than the shared skill, follow it.

Origin: a 24-PR, 8-batch run on tb-mobile (2026-10-03 to 10-08).

## Building a batch

- Real `npm ci` in the batch worktree, which sits outside the repo (`../tb-mobile-worktrees/int-<date>-bN`).
- Reconcile "+N suites" with `git diff --name-status` (`A` files) and `jest --listTests`.
- Heavy suites report false failures in a batch run. Confirm any failure with `npx jest --ci --runInBand --testPathPattern <suite>` alone before classifying it.
- Register new test files in the shard manifest (`scripts/ci-*-shards.json`, and `ci-script-test-shards.json` for script tests) or CI goes red while the code is fine.
- After any change to `package.json`: `bundle exec pod install` (never bare), commit `ios/Podfile.lock` with it except the four path-dependent checksums, and use `scripts/reset-podfile-lock-path-noise.sh`, never `git checkout --`.
- Validate with `tsc --pretty false` (ANSI output defeats `grep -c`), eslint on changed files, the full jest suite against the baseline delta, and `npm run test:i18n` when locales moved.
- Grouping: a change that does not touch the app binary needs CI only, no device QA build. `jest-expo` pins jest 29; if a dependency bump drags jest 30 in, stop. A React Native upgrade (with its jest preset) goes alone and last. Order batches app code first, tooling and docs next, dependencies last.

## Deploying to QA through a test tag

QA builds a ref on origin and the integration branch must not be there, so push an annotated tag (naming in `CLAUDE.md`, "Rollup / Snapshot Tag Naming"):

```bash
git tag -a test-<env>/v<version>-<sha7>-<date> <tip> -m "<batch>: PRs ..."
git push origin refs/tags/test-<env>/v<version>-<sha7>-<date>         # explicit refspec, never bare
gh workflow run qa.yml -f deploy_ref=<tag> -f platform=<ios|android> -f groups=qa
```

- Ask which platform(s) before dispatching. Never assume both. `block-multi-platform-deploy.js` enforces this.
- Use the full SHA if you dispatch by SHA. A short SHA dies at `actions/checkout`.
- Pin the run id, ref and release ids to the batch in the log, with one `qa_head` line per PR (shared Step 5). A QA checkpoint can span days.
- **The tag is the QA'd tree.** A fix found in QA goes on its PR branch; then re-cut the batch, push a new tag and dispatch again. Never cherry-pick a fix onto the batch past the tag: what lands would then differ from what was tested (shared hard rule 10).
- **Confirm the release reached Firebase** before telling the user a build is ready. A green `qa.yml` is not the proof. The `firebase-tools` CLI has no releases-list command, so call the API with its cached token, and never print the token:

```bash
npx -y firebase-tools appdistribution:groups:list --project threadbase-10d42 >/dev/null  # refreshes the cached token; run from the scratchpad
APP=$(gh variable get FIREBASE_APP_ID_IOS --repo RonenMars/threadbase-mobile); P=$(echo "$APP" | cut -d: -f2)
TOKEN=$(jq -r .tokens.access_token ~/.config/configstore/firebase-tools.json)
curl -s -H "Authorization: Bearer $TOKEN" -H "x-goog-user-project: threadbase-10d42" \
  "https://firebaseappdistribution.googleapis.com/v1/projects/$P/apps/$APP/releases?pageSize=3" \
  | jq -r '.releases[] | "\(.name|split("/")[-1]) \(.displayVersion) (\(.buildVersion)) \(.createTime)"'
```

  Use `FIREBASE_APP_ID_ANDROID` for Android. Record the release id beside the `qa_head` lines; the user's `qa_verdict` names that build.

## Pairing with the streamer

- A pair is a server half plus a client half behind a capability flag (`GET /api/info`, `GET /api/config/feature-flags`, `/api/providers` health). This app is inert until the flag appears, so the server half can land first.
- Compatibility is advisory, not a gate. For a rename, removal or changed status vocabulary on the streamer side, `rg -n "<identifier>" services hooks stores components types` here, report file:line and whether the call site is in a shipped build, then proceed.
- This app owns degradation ("Server contract - degrade, don't break" in `CLAUDE.md`). QA the pair both ways.
- Match pairs by the endpoint or field `services/api-client.ts` actually calls, never by feature name.
- Running a streamer build for QA takes over port 8766 and shares `~/.threadbase/`. Say so before starting it, restore prod afterwards, and never leave the takeover marker behind.

## Landing

`main` is protected by the `main protection` ruleset, strict status checks. See `CLAUDE.md`, "Merging PRs". Land each PR with the shared `land-pr.sh`, one at a time in plan order, from the PR's worktree after a real `npm ci` there:

```bash
<skill-dir>/land-pr.sh <pr> --log <log> --min-checks 20 \
  --test 'npx tsc --noEmit --pretty false && npx jest --ci --findRelatedTests $(git diff --name-only origin/main...HEAD)'
```

- `--min-checks 20`: the PR rollup carries about 20 checks, so a partial rollup never reads as done.
- The single quotes matter: the file list is computed after the rebase, inside the script.
- After a squash-merge the next PR is `BEHIND`; the next `land-pr.sh` run rebases it.
- The repo auto-deletes merged branches, so merging a parent closes its stacked children. The script refuses with `CHILDREN`; retarget them to `main` first.
- `gh pr merge --delete-branch` also removes a clean local worktree and branch. The script never passes it.

## Traps seen on this repo

| Trap | Guard |
|---|---|
| Shell-exported `EXPO_PUBLIC_*` in a dev bundle | dev reads `.env` files; release builds inline from `process.env` |
| Dev client serves a cached bundle | uninstall and reinstall to force a fresh fetch |
| Edits inside a Metro-served worktree reload the phone | work in a different worktree |
| New script test not in `ci-script-test-shards.json` | register it or CI goes red twice |
| Module-scope constant reading `process.env` | tests mutate env per case, keep it inside the component |
| A local branch looks like the PR | compare to `origin/<branch>` before rebasing |
| A green `qa.yml` reported as "the build is on Firebase" | the release list above, quoted |
| A worktree `node_modules` borrowed from another branch | a real `npm ci` before `--test` |

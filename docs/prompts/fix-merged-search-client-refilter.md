# Prompt — stop the hub re-filtering server search results

Issue: **https://github.com/RonenMars/threadbase-mobile/issues/646** (remaining half)

Hand this to a fresh agent session opened in `~/dev/ai-tools/tb-mobile`.

> **Work in a new git worktree, outside the repo root.** Do not edit the main checkout — other sessions and verification runs use it, and a stray edit there gets read by whoever is mid-task. The exact command is under [Workflow](#workflow); the rules around it are not style preferences and are explained there.
>
> If `../tb-mobile-worktrees/search-refilter` or the branch `fix/merged-search-client-refilter` already exists, someone is running this now or has run it before — check `git worktree list` and `gh pr list` before starting, and pick a unique suffix.

---

## Read this first

The other half of #646 is already fixed in **https://github.com/RonenMars/threadbase-mobile/pull/657**.
That PR made `mergedClassicItems` take its conversations from `useConversationSearch` while a query is active, instead of from the paged set.

Check whether #657 has merged before you start.
If it has not, base your work on it rather than on `main`, or you will be filtering a list that is still built from the wrong source and nothing you do will be observable.

Do not redo #657's change. This prompt is only about what the client does to the list *after* it arrives.

## The defect

`/api/search` matches **message bodies**. The client then re-filters what it returns on **`title` and `preview` only**.

So a conversation the server correctly matched — because the query appears deep in its message history — is fetched over the network and then silently discarded on the device, because neither its title nor its preview happens to contain the term.

That is precisely the case server-side search exists to serve: *"I remember discussing wombat timeouts, I have no idea which conversation it was."*
The feature fails hardest exactly where it is most valuable, and it fails invisibly — the user sees an empty result list, not an error.

## Verified state, 2026-08-12

Re-check these line numbers, the file moves often.

`MergedClassicList` (`app/index.tsx:601` on `origin/main`) filters in `filteredItems` (`:640`):

```js
const c = item.item as MultiConversation
return (
  c.title?.toLowerCase().includes(q) ||
  c.preview?.toLowerCase().includes(q)
)
```

That predicate is correct when the list is the locally-paged set. It is wrong when the list came from the server, where re-matching two fields can only ever remove correct results.

The same memo also filters **session** rows, and those must keep filtering client-side — `/api/search` does not cover sessions.
The two cases have to be separated; that separation is the substance of this task.

## What to build

When the conversation list came from the server, do not filter it again — it is already filtered.
When it came from the paged set, filter it as today.
Sessions filter client-side in both cases.

The suggested mechanism is to tell `MergedClassicList` which regime it is in — it already receives `searchQuery`, so a sibling boolean is the smallest change that expresses it.
If you find a cleaner approach, take it and explain the choice in the PR.

What must be true at the end: **a conversation returned by `/api/search` is never dropped by the client**, and session rows still respond to the query.

Resist a larger refactor of `filteredItems`. The defect is one predicate applied in one situation it does not fit.

## Scope

Files you own:

- `app/index.tsx`
- tests under `__tests__/`
- `e2e/fixtures/search-results.json` — only if you extend it, see below

Do not touch `e2e/*.yaml`, `docs/`, `.github/`, or `package.json`.

## The trap: a green e2e suite proves nothing here

`e2e/06_search_anchor.yaml` passes **with this bug present**.

`e2e/fixtures/search-results.json` gives the anchor a `preview` of "Where did we set the wombat timeout for the retry loop?", which contains the query `wombat`, so the client-side predicate keeps it either way.

Do not use that flow as evidence. It cannot distinguish fixed from broken.

If you extend the fixture with a conversation whose match is body-only, say so explicitly in the PR — that file is shared with the e2e flow, and changing it changes what that flow exercises.

## Tests

Write a unit test that **fails without your fix**. Prove it fails by reverting your change, running it, and restoring — do not assume.

The essential case: a conversation present in the server results whose query term appears in **neither** `title` nor `preview` still reaches the rendered list.

Also cover, because they are easy to break while fixing the above:

- With no active query, the paged list still filters normally.
- Session rows still filter by the query while conversations are server-backed.

## Do not use the iOS simulator

It may be in use for verification runs. Implement and verify with jest, eslint and tsc only — no Maestro, no `npm run ios`, no `xcodebuild`.
List the on-device check steps in your PR for whoever runs it next.

## Workflow

```bash
/opt/homebrew/bin/git -C /Users/ronenmars/dev/ai-tools/tb-mobile fetch origin
/opt/homebrew/bin/git -C /Users/ronenmars/dev/ai-tools/tb-mobile worktree add \
  ../tb-mobile-worktrees/search-refilter -b fix/merged-search-client-refilter origin/main
cd /Users/ronenmars/dev/ai-tools/tb-mobile-worktrees/search-refilter
cp -Rc /Users/ronenmars/dev/ai-tools/tb-mobile/node_modules ./node_modules
```

If #657 has not merged, branch from its head instead of `origin/main`.

Repo rules that are not style preferences:

- Worktrees live **outside** the repo root. A nested one gets discovered by jest, eslint and Metro and produces failures from a stale branch.
- `node_modules` must be a **real copy**, never a symlink, or Metro silently bundles the main checkout and you test code you did not write.
- jest needs `--watchman=false` in a fresh worktree or it hangs with no output.
- Use the absolute git binary `/opt/homebrew/bin/git`; a shell function shadows `git` on this machine.

## Verify before claiming done

`npx tsc --noEmit --pretty false` — the baseline is **14** pre-existing `TS2345` Expo Router typed-route errors, tracked as https://github.com/RonenMars/threadbase-mobile/issues/606. Adding any is a regression.

**`.expo/types/router.d.ts` does not exist in a fresh worktree**, and without it tsc reports 0 — a false clean that would hide a real regression. Generate it first (briefly run `npx expo start`, then kill it) before trusting the count.

Then `npx eslint app/index.tsx` and `npx jest --ci --watchman=false --runInBand --testPathPattern "index|search"`.

## Deliverable

Conventional commit title (`fix(hub): …`), one sentence per line in the body, **no AI attribution anywhere**.

Push and open a PR against `main` with `gh pr create`, linking issue #646 and noting that it completes the work started in #657.

Report: the mechanism you chose for distinguishing server-backed from paged results, the test output including the fails-without-the-fix check, whether you extended the shared fixture, and the PR URL.

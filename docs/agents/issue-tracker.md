# Issue tracker: GitHub

Issues and PRDs for this repo live as GitHub issues on [`RonenMars/threadbase-mobile`](https://github.com/RonenMars/threadbase-mobile/issues).
Use the `gh` CLI for all operations — it infers the repo from `git remote -v` when run inside a clone.

## Format and labels are defined elsewhere — read that first

**Title format, label taxonomy, and the required issue sections are canonical in [`threadbase/docs/issue-tracker.md`](https://github.com/RonenMars/threadbase/blob/main/docs/issue-tracker.md).**
That file lives in the `threadbase` umbrella repo and governs *every* component repo.
Read it before filing, re-labelling, or re-prioritising.
Never copy those rules into this repo, invent a local variant, or add a label to only one side — see `CLAUDE.md` → "GitHub Issues — Format & Labels".

The shape it defines, in brief (the canonical doc is authoritative if this drifts):

```
Title:   P<N>: <what is wrong or what should exist>
Labels:  <exactly one priority P0–P3> + <exactly one type> + <zero or more areas>
```

The triage-state labels this repo's skills apply are **additive** to that taxonomy, not a replacement — see `triage-labels.md`.

## Commands

- **Create an issue**: `gh issue create --title "..." --body "..."`. Use a heredoc for multi-line bodies.
- **Read an issue**: `gh issue view <number> --comments`
- **List issues**: `gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'` with appropriate `--label` and `--state` filters.
- **Apply / remove labels**: `gh issue edit <number> --add-label "..."` / `--remove-label "..."`
- **Close**: `gh issue close <number> --comment "..."`

## Prose rules for anything written to GitHub

One sentence per line, no hard breaks inside a sentence, no AI attribution.
These apply to issue bodies exactly as they apply to commit messages and PR descriptions — see `CLAUDE.md`.

## Two prohibitions that override any skill instruction

- **Never comment on, reply to, react to, or review a GitHub issue or PR.** `gh issue comment`, `gh pr comment`, and every equivalent are forbidden by the user's global instructions, including when a skill's workflow calls for it. Report what you would have said in the session instead.
- **Re-prioritising means editing the title too.** The `P<N>:` prefix and the priority label are two representations of one fact; changing one without the other desyncs them.

## When a skill says "publish to the issue tracker"

Create a GitHub issue.

## When a skill says "fetch the relevant ticket"

Run `gh issue view <number> --comments`.

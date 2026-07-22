#!/usr/bin/env bash
# admin-merge-pr.sh — open a PR (if needed) and admin squash-merge it onto main.
#
# Shared by local land-version-bump.sh and .github/workflows/deploy.yml so both
# paths land version bumps the same way: gh pr create + gh pr merge --admin.
#
# Usage:
#   ./scripts/admin-merge-pr.sh <branch> <title> <body>
#
# Auth:
#   GH_TOKEN         — used for `gh pr create` (and merge if no merge token set)
#   GH_MERGE_TOKEN   — optional; if set, used for `gh pr merge` (CI: GH_PAT)
#   GH_PUSH_TOKEN    — alias for GH_MERGE_TOKEN (matches deploy.yml env name)
#
# Fails loudly if gh is missing or merge is refused.

set -euo pipefail

BRANCH="${1:-}"
TITLE="${2:-}"
BODY="${3:-}"

[[ -n "$BRANCH" && -n "$TITLE" ]] || {
  echo "Usage: $0 <branch> <title> <body>" >&2
  exit 2
}

if ! command -v gh >/dev/null 2>&1; then
  echo "ERROR: gh CLI required to land '$BRANCH' on main automatically" >&2
  exit 1
fi

MERGE_TOKEN="${GH_MERGE_TOKEN:-${GH_PUSH_TOKEN:-${GH_TOKEN:-}}}"

if [[ -n "${GH_MERGE_TOKEN:-}" ]]; then
  MERGE_TOKEN_SOURCE=GH_MERGE_TOKEN
elif [[ -n "${GH_PUSH_TOKEN:-}" ]]; then
  MERGE_TOKEN_SOURCE=GH_PUSH_TOKEN
elif [[ -n "${GH_TOKEN:-}" ]]; then
  MERGE_TOKEN_SOURCE=GH_TOKEN
else
  MERGE_TOKEN_SOURCE=none
fi

echo "::group::admin-merge-pr: create PR for '$BRANCH'"
echo "  title:        $TITLE"
echo "  create token: $( [[ -n "${GH_TOKEN:-}" ]] && echo set || echo EMPTY )"
echo "  merge token:  $( [[ -n "${MERGE_TOKEN:-}" ]] && echo set || echo EMPTY ) (source: $MERGE_TOKEN_SOURCE)"
gh pr create --base main --head "$BRANCH" --title "$TITLE" --body "${BODY:-}" \
  || echo "  PR already exists for $BRANCH"

# Author matters: a PR created with GITHUB_TOKEN is authored by
# github-actions[bot], which GitHub gates behind manual workflow approval.
# Logging it makes a token regression visible in the deploy log immediately.
PR_AUTHOR=$(gh pr view "$BRANCH" --json author --jq '.author.login' 2>/dev/null || echo 'unknown')
PR_URL=$(gh pr view "$BRANCH" --json url --jq '.url' 2>/dev/null || echo 'unknown')
echo "  PR:     $PR_URL"
echo "  author: $PR_AUTHOR"
if [[ "$PR_AUTHOR" == "github-actions[bot]" ]]; then
  echo "::warning::Bump PR authored by github-actions[bot] — its workflow run will sit awaiting manual approval. Expected a PAT-authored PR; check GH_TOKEN in deploy.yml."
fi
echo "::endgroup::"

# Surface the PR + author on the run summary page so a deploy can be checked
# without opening job logs. GITHUB_STEP_SUMMARY is unset outside Actions.
if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  {
    echo ""
    echo "| Bump PR | Author |"
    echo "|---------|--------|"
    echo "| $PR_URL | \`$PR_AUTHOR\` |"
    if [[ "$PR_AUTHOR" == "github-actions[bot]" ]]; then
      echo ""
      echo "> ⚠️ Authored by \`github-actions[bot]\` — its workflow run will await manual approval. Check \`GH_TOKEN\` in deploy.yml."
    fi
  } >> "$GITHUB_STEP_SUMMARY"
fi

# Admin squash-merge: owner/admin PAT bypasses required-check rulesets.
# Fail if merge is refused (empty/mis-scoped token, etc.).
echo "::group::admin-merge-pr: squash-merge '$BRANCH'"
if [[ -n "$MERGE_TOKEN" ]]; then
  GH_TOKEN="$MERGE_TOKEN" gh pr merge "$BRANCH" --squash --delete-branch --admin
else
  gh pr merge "$BRANCH" --squash --delete-branch --admin
fi
echo "::endgroup::"

echo "  ✓ merged '$BRANCH' into main (author: $PR_AUTHOR, $PR_URL)"

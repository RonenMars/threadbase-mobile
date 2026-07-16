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

gh pr create --base main --head "$BRANCH" --title "$TITLE" --body "${BODY:-}" \
  || echo "  PR already exists for $BRANCH"

# Admin squash-merge: owner/admin PAT bypasses required-check rulesets.
# Fail if merge is refused (empty/mis-scoped token, etc.).
if [[ -n "$MERGE_TOKEN" ]]; then
  GH_TOKEN="$MERGE_TOKEN" gh pr merge "$BRANCH" --squash --delete-branch --admin
else
  gh pr merge "$BRANCH" --squash --delete-branch --admin
fi

echo "  ✓ merged '$BRANCH' into main"

#!/usr/bin/env bash
# git-sync-check.sh — fail loud if local main is behind origin/main, on a
# different branch, or has uncommitted app.json changes.
#
# Multi-machine ship hazard: another machine pushed a build-number bump that
# you haven't pulled. Without this check, ship-ios.sh would happily auto-bump
# from a stale base, silently re-using a build number that's already taken
# (or worse, skipping numbers and confusing your TestFlight history).
#
# Usage:
#   ./scripts/git-sync-check.sh             # warn-only on branch mismatch, hard-fail on stale main
#   ./scripts/git-sync-check.sh --strict    # also hard-fail if not on main
#   ./scripts/git-sync-check.sh --no-fetch  # skip `git fetch` (for offline runs)

set -euo pipefail

STRICT=0
DO_FETCH=1
while [[ $# -gt 0 ]]; do
  case "$1" in
    --strict)   STRICT=1; shift ;;
    --no-fetch) DO_FETCH=0; shift ;;
    *) echo "Unknown arg: $1" >&2; exit 2 ;;
  esac
done

command -v git >/dev/null || { echo "git required" >&2; exit 1; }

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "  ⚠ Not inside a git repo — skipping git-sync check"
  exit 0
fi

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
echo "▸ Git sync check"
echo "  current branch:        $CURRENT_BRANCH"

# 1. Branch sanity
if [[ "$CURRENT_BRANCH" != "main" ]]; then
  if (( STRICT )); then
    echo "  ✗ Not on main (--strict)" >&2
    echo "    Run: git checkout main" >&2
    exit 1
  fi
  echo "  ⚠ Not on main — proceed only if you intend to ship from $CURRENT_BRANCH"
fi

# 2. Uncommitted app.json
if ! git diff --quiet -- app.json 2>/dev/null || ! git diff --cached --quiet -- app.json 2>/dev/null; then
  echo "  ✗ app.json has uncommitted changes" >&2
  echo "    Commit or stash before shipping — the pipeline must ship a tracked app.json." >&2
  exit 1
fi

# 3. Fetch + compare local main against origin/main
# Only relevant when shipping from main. On a feature branch the stale-main
# check is misleading — you're intentionally not on main.
if [[ "$CURRENT_BRANCH" != "main" ]]; then
  echo "  ✓ shipping from branch $CURRENT_BRANCH — skipping main sync check"
  exit 0
fi
if (( DO_FETCH )); then
  echo "  fetching origin..."
  if ! git fetch origin main --quiet 2>&1; then
    echo "  ⚠ git fetch failed — assuming offline; skipping remote comparison"
    exit 0
  fi
fi

if ! git rev-parse --verify origin/main >/dev/null 2>&1; then
  echo "  ⚠ origin/main not configured — skipping remote comparison"
  exit 0
fi

LOCAL_MAIN=$(git rev-parse main 2>/dev/null || echo "")
REMOTE_MAIN=$(git rev-parse origin/main 2>/dev/null || echo "")

if [[ -z "$LOCAL_MAIN" || -z "$REMOTE_MAIN" ]]; then
  echo "  ⚠ Could not resolve main / origin/main — skipping remote comparison"
  exit 0
fi

if [[ "$LOCAL_MAIN" == "$REMOTE_MAIN" ]]; then
  echo "  ✓ local main is up to date with origin/main"
  exit 0
fi

# Behind / ahead?
BEHIND=$(git rev-list --count "$LOCAL_MAIN..$REMOTE_MAIN" 2>/dev/null || echo "0")
AHEAD=$(git rev-list --count "$REMOTE_MAIN..$LOCAL_MAIN" 2>/dev/null || echo "0")

if (( BEHIND > 0 )); then
  echo "  ✗ local main is BEHIND origin/main by $BEHIND commit(s)" >&2
  echo "    Another machine likely pushed updates (possibly an app.json build bump)." >&2
  echo "    Run: git checkout main && git pull --ff-only" >&2
  echo "    Recent remote commits not yet local:" >&2
  git --no-pager log --oneline "$LOCAL_MAIN..$REMOTE_MAIN" 2>/dev/null | head -10 | sed 's/^/      /' >&2
  exit 1
fi

if (( AHEAD > 0 )); then
  echo "  ✓ local main is ahead of origin/main by $AHEAD commit(s) — fine to ship; remember to push after"
fi

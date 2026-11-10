#!/usr/bin/env bash
# Land one QA-approved PR: guard, rebase, test, push, wait, squash-merge, verify.
# Run from the PR's own worktree, with the PR branch checked out.
#
#   land-pr.sh <pr> --log <qa-log.md> [--min-checks N] [--test "<cmd>"] [--after <squash-sha>] [--yes]
#   land-pr.sh --preflight
#
# --log         the batch's engineering log. It must hold `qa_head: <batch> #<pr> <full-sha>` and
#               `qa_verdict: <batch> approved ...`. The QA'd head is the only head this script lands.
# --min-checks  checks that must be present before "0 pending" counts as done (default 1).
# --test        the PR's own tests, run after the rebase and before the push.
# --after       the previous PR's squash sha. If it is a feat/fix commit, wait for the
#               chore(release) commit that semantic-release puts on top of it (streamer).
# --yes         push and merge. Without it the script stops at READY after the local rebase and
#               tests, so the user can confirm the push.
# Env: LAND_REBASE_ARGS (e.g. --ignore-date), LAND_TIMEOUT seconds for CI (default 1800), LAND_POLL (20).
#
# Last line is always `RESULT=<WORD> ...`; the exit code matches the word:
#   0 MERGED | READY | PREFLIGHT_OK   2 USAGE   3 HELD (no verdict, head moved, not open, draft)
#   4 DIRTY (worktree unclean, rebase in progress, wrong branch)   5 CONFLICT   6 EMPTY (0 commits ahead)
#   7 TESTS   8 CHILDREN (open PRs based on this branch)   9 RED   10 STALE (behind)   11 TIMEOUT
#   12 NOT_MERGED   13 PREFLIGHT_FAILED
set -uo pipefail

GIT=${GIT:-git}
result() { echo "RESULT=$1 ${2:-}"; exit "$3"; }
say() { echo "[land-pr $(date +%H:%M:%S)] $*"; }

if [ "${1:-}" = "--preflight" ]; then
  bad=""
  gh auth status >/dev/null 2>&1 || bad="$bad gh-auth"
  ssh -o BatchMode=yes -o ConnectTimeout=10 -T git@github.com 2>&1 | grep -q 'successfully authenticated' || bad="$bad ssh"
  # A signed commit object that is never referenced: proves the signer answers without a prompt.
  $GIT -c commit.gpgsign=true commit-tree -S -m preflight "$($GIT rev-parse 'HEAD^{tree}')" </dev/null >/dev/null 2>&1 || bad="$bad signing"
  free_kb=$(df -Pk . | awk 'NR==2 {print $4}')
  [ "${free_kb:-0}" -gt 5242880 ] || bad="$bad disk<5GB"
  [ -z "$bad" ] && result PREFLIGHT_OK "" 0
  result PREFLIGHT_FAILED "$bad" 13
fi

pr=${1:-}; shift || true
case "$pr" in ''|*[!0-9]*) result USAGE "first argument must be a PR number" 2;; esac
log="" min=1 test_cmd="" after="" yes=0
while [ $# -gt 0 ]; do
  case "$1" in
    --log) log=$2; shift 2;;
    --min-checks) min=$2; shift 2;;
    --test) test_cmd=$2; shift 2;;
    --after) after=$2; shift 2;;
    --yes) yes=1; shift;;
    *) result USAGE "unknown argument $1" 2;;
  esac
done
[ -f "$log" ] || result USAGE "--log <file> is required and must exist" 2

# 1. The QA record decides what lands.
qa_line=$(grep -E "^qa_head: [^ ]+ #$pr [0-9a-f]{40}( |$)" "$log" | tail -1)
[ -n "$qa_line" ] || result HELD "no 'qa_head: <batch> #$pr <full-sha>' line in $log" 3
batch=$(echo "$qa_line" | awk '{print $2}')
qa_sha=$(echo "$qa_line" | awk '{print $4}')
grep -qE "^qa_verdict: $batch approved( |$)" "$log" || result HELD "no 'qa_verdict: $batch approved' line in $log" 3

read -r state draft head branch < <(gh pr view "$pr" --json state,isDraft,headRefOid,headRefName \
  -q '"\(.state) \(.isDraft) \(.headRefOid) \(.headRefName)"') || result HELD "gh pr view $pr failed" 3
[ "$state" = OPEN ] || result HELD "#$pr is $state" 3
[ "$draft" = false ] || result HELD "#$pr is a draft" 3

# 2. The worktree is this PR's, clean, idle, and at the QA'd head.
[ "$($GIT symbolic-ref --short -q HEAD)" = "$branch" ] || result DIRTY "checked-out branch is not $branch" 4
for d in rebase-merge rebase-apply MERGE_HEAD CHERRY_PICK_HEAD; do
  [ -e "$($GIT rev-parse --git-path "$d")" ] && result DIRTY "$d in progress" 4
done
[ -z "$($GIT status --porcelain --untracked-files=no)" ] || result DIRTY "uncommitted changes" 4
$GIT fetch origin --prune || result DIRTY "git fetch failed; refusing to rebase onto a stale main" 4
# After a READY or STALE run the heads are rebases of the QA'd head; what must match is the patch.
pid() { $GIT diff "$($GIT merge-base origin/main "$1")" "$1" | $GIT patch-id --stable | cut -d' ' -f1; }
qa_pid=$(pid "$qa_sha")
[ "$head" = "$qa_sha" ] || [ "$(pid "$head")" = "$qa_pid" ] || result HELD "#$pr head $head changed since QA ($qa_sha)" 3
[ "$($GIT rev-parse HEAD)" = "$head" ] || [ "$(pid HEAD)" = "$qa_pid" ] \
  || result DIRTY "local HEAD's changes differ from the QA'd head $qa_sha" 4

children=$(gh pr list --state open --base "$branch" --json number -q '[.[].number|tostring]|join(",")')
[ -z "$children" ] || result CHILDREN "retarget #$children to main before landing #$pr" 8

# 3. Semantic-release: rebasing before the release commit lands burns a second CI cycle.
if [ -n "$after" ] && $GIT log -1 --format=%s "$after" | grep -qE '^(feat|fix)(\(.+\))?!?:'; then
  say "waiting for chore(release) on top of $after"
  for _ in $(seq 1 18); do
    $GIT fetch -q origin || result DIRTY "git fetch failed while waiting for the release commit" 4
    $GIT log --format=%s "$after..origin/main" | grep -q '^chore(release)' && break
    sleep 10
  done
  $GIT log --format=%s "$after..origin/main" | grep -q '^chore(release)' || result TIMEOUT "no release commit after $after in 3 min" 11
fi

# 4. Rebase, then the guards a chained `rebase && push` skipped.
# shellcheck disable=SC2086
if ! $GIT rebase ${LAND_REBASE_ARGS:-} origin/main; then
  $GIT rebase --abort
  result CONFLICT "#$pr does not rebase cleanly onto origin/main; resolve by hand" 5
fi
ahead=$($GIT rev-list --count origin/main..HEAD)
[ "$ahead" -gt 0 ] || { $GIT reset -q --hard "$head"; result EMPTY "rebased branch has 0 commits ahead of main; pushing it would close #$pr" 6; }
tested=$($GIT rev-parse --git-path land-pr-tested)
if [ -n "$test_cmd" ] && [ "$(cat "$tested" 2>/dev/null)" != "$($GIT rev-parse HEAD)" ]; then
  say "tests: $test_cmd"
  bash -c "$test_cmd" || result TESTS "tests failed on the rebased branch; nothing pushed" 7
  $GIT rev-parse HEAD >"$tested"
fi
[ "$yes" = 1 ] || result READY "#$pr rebased to $($GIT rev-parse --short HEAD) ($ahead ahead), tests passed; re-run with --yes to push and merge" 0

# 5. Push with a lease pinned to the head just checked, and an explicit refspec.
if [ "$($GIT rev-parse HEAD)" != "$head" ]; then
  old=$head
  $GIT push --force-with-lease="refs/heads/$branch:$old" origin "HEAD:refs/heads/$branch" \
    || result NOT_MERGED "push refused; the remote branch moved" 12
  # A pre-push hook may rebase again, so read the head GitHub has, not ours.
  for _ in $(seq 1 12); do
    head=$(gh pr view "$pr" --json headRefOid -q .headRefOid)
    [ "$head" != "$old" ] && break
    sleep 5
  done
  [ "$head" != "$old" ] || result NOT_MERGED "GitHub still shows the old head after the push" 12
  say "pushed $head"
fi

# 6. Wait and merge in one loop, so green and current cannot go stale between two steps.
deadline=$(( $(date +%s) + ${LAND_TIMEOUT:-1800} ))
while :; do
  [ "$(date +%s)" -lt "$deadline" ] || result TIMEOUT "#$pr CI still pending" 11
  sleep "${LAND_POLL:-20}"
  # Unknown or missing buckets count as pending: a queued check has neither state nor conclusion.
  read -r total pending failed < <(gh pr checks "$pr" --json name,bucket -q \
    '"\(length) \([.[]|select(.bucket=="pending" or .bucket==null or .bucket=="")]|length) \([.[]|select(.bucket=="fail" or .bucket=="cancel")]|length)"' 2>/dev/null) \
    || continue
  [ "${failed:-0}" -eq 0 ] || result RED "#$pr has $failed failed or cancelled check(s)" 9
  [ "${pending:-1}" -eq 0 ] && [ "${total:-0}" -ge "$min" ] || { say "checks $total present, $pending pending"; continue; }
  ms=$(gh api "repos/{owner}/{repo}/pulls/$pr" --jq .mergeable_state)
  case "$ms" in
    behind) result STALE "#$pr fell behind main during CI; run again" 10;;
    dirty) result CONFLICT "#$pr conflicts with main" 5;;
    unknown|null|'') say "mergeable_state $ms, recomputing"; continue;;
  esac
  gh pr merge "$pr" --squash --match-head-commit "$head" || say "gh pr merge exited non-zero; reading the PR state"
  break
done

# 7. The PR state decides, not gh's exit code.
for _ in 1 2 3; do
  read -r merged sha < <(gh api "repos/{owner}/{repo}/pulls/$pr" --jq '"\(.merged) \(.merge_commit_sha)"')
  [ "$merged" = true ] && result MERGED "#$pr squash $sha" 0
  sleep 15
done
result NOT_MERGED "#$pr is still open after the merge call" 12

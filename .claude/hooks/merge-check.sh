#!/bin/bash
# Usage: merge-check.sh <base-ref> <head-sha> <pr>   (run inside the repo; guard-git.sh calls it before gh pr merge)
# A PR merges only with the owner's approval for this PR at this exact head commit (a new push needs a new approval).
# Without it the merge is blocked (exit 2), and the message lists the lines the PR changes or removes that another
# author touched in the last 7 days, so the owner sees them before approving. The owner approves with:
#   ! .claude/hooks/approve-merge.sh <pr>
here="$(cd "$(dirname "$0")" && pwd)"
. "$here/lib.sh"
base="$1"; head="$2"; pr="$3"

if grep -qE "^${pr} ${head}( |$)" "$(approvals_file)" 2>/dev/null; then exit 0; fi

lines=$("$here/others-lines.sh" "$base" "$head" 7 2>&1); status=$?
{
  echo "PR ${pr} needs the owner's approval to merge (CLAUDE.md, \"Merging and deploy\")."
  if [ "$status" -eq 1 ]; then
    echo "It changes or removes lines other people touched in the last 7 days:"
    printf '%s\n' "$lines" | head -40
    n=$(printf '%s\n' "$lines" | wc -l | tr -d ' ')
    [ "$n" -gt 40 ] && echo "… and $((n - 40)) more (.claude/hooks/others-lines.sh ${base} ${head} 7)"
  elif [ "$status" -eq 0 ]; then
    echo "It changes no lines other people touched in the last 7 days."
  else
    echo "Couldn't check whose lines it changes: ${lines}"
  fi
  echo "Show the owner this and wait. Only the owner approves: ! .claude/hooks/approve-merge.sh ${pr}"
} >&2
exit 2

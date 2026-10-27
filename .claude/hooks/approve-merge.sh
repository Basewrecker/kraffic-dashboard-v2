#!/bin/bash
# OWNER ONLY. Claude is blocked from running this (guard-git.sh); the owner runs it with `!` in the Claude prompt or
# in their own terminal, from any worktree of the repo.
#   approve-merge.sh <pr>       approve `gh pr merge <pr>` at the PR's current head commit, even though it changes
#                               lines another author touched in the last 7 days (a new push needs a new approval)
#   approve-merge.sh conflicts  you've seen the conflicting files of the merge in progress: let Claude resolve them and
#                               commit the merge (every worktree of this repo)
here="$(cd "$(dirname "$0")" && pwd)"
. "$here/lib.sh"
git rev-parse --git-dir >/dev/null 2>&1 || { echo "Run this inside the repo." >&2; exit 1; }

if [ "$1" = "conflicts" ]; then
  git worktree list --porcelain | sed -n 's/^worktree //p' | while read -r wt; do
    m="$(git -C "$wt" rev-parse --absolute-git-dir)/kraffic-merge-conflicts"
    [ -f "$m" ] || continue
    if ! sed -n 2p "$m" | grep -qx approved; then
      { sed -n 1p "$m"; echo approved; sed '1,2d' "$m"; } > "$m.tmp" && mv "$m.tmp" "$m"
    fi
    echo "Approved resolving the conflicts in $wt:"; sed '1,2d' "$m" | sed 's/^/  /'
  done
  exit 0
fi

pr="$1"
case "$pr" in ''|*[!0-9]*) echo "usage: approve-merge.sh <pr-number> | conflicts" >&2; exit 1 ;; esac
head=$(gh pr view "$pr" --json headRefOid -q .headRefOid) || exit 1
echo "$pr $head $(date +%s)" >> "$(approvals_file)"
echo "Approved merging PR $pr at ${head:0:8}."

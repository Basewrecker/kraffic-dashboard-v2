#!/bin/bash
# Shared helpers for the hooks in this folder. Sourced, not run.

# The repo a Bash command acts on: `git -C <dir>`, else a leading `cd <dir>`, else the session's cwd, else the project.
# $1 = the command, $2 = the hook input's cwd.
hook_repo_dir() {
  local cmd="$1" cwd="$2" dir
  dir=$(printf '%s' "$cmd" | sed -nE 's/.*git[[:space:]]+-C[[:space:]]+("([^"]+)"|([^[:space:]]+)).*/\2\3/p' | head -1)
  [ -z "$dir" ] && dir=$(printf '%s' "$cmd" | sed -nE 's/^[[:space:]]*cd[[:space:]]+("([^"]+)"|([^[:space:]&;]+)).*/\2\3/p' | head -1)
  dir="${dir:-${cwd:-${CLAUDE_PROJECT_DIR:-.}}}"
  printf '%s' "${dir/#\~/$HOME}"
}

# Owner approvals live in the repo's shared git dir, outside the tree, so every worktree of the repo sees them.
approvals_file() { printf '%s/kraffic-approved-merges' "$(git rev-parse --path-format=absolute --git-common-dir)"; }

# Marker for a merge that hit conflicts, in this worktree's own git dir. Line 1: the merge's key (merge_key); line 2
# "pending", or "approved" once the owner has looked; then the conflicting files.
conflict_marker() { printf '%s/kraffic-merge-conflicts' "$(git rev-parse --absolute-git-dir)"; }

# The merge in progress in this worktree, or nothing: a normal merge is its MERGE_HEAD; a squash merge
# (`git merge --squash`, which writes no MERGE_HEAD) is "squash:<newest squashed commit>" from SQUASH_MSG, which git
# keeps until the squash is committed.
merge_key() {
  local h sq
  if h=$(git rev-parse -q --verify MERGE_HEAD 2>/dev/null); then printf '%s' "$h"; return 0; fi
  sq=$(git rev-parse --path-format=absolute --git-path SQUASH_MSG 2>/dev/null)
  [ -n "$sq" ] && [ -f "$sq" ] || return 1
  h=$(sed -nE 's/^commit ([0-9a-f]{40}).*/\1/p' "$sq" | head -1)
  printf 'squash:%s' "${h:-$(git rev-parse -q --verify HEAD 2>/dev/null)}"
}

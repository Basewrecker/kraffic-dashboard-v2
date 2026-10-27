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

# Marker for a merge that hit conflicts, in this worktree's own git dir. Line 1: MERGE_HEAD; line 2 "pending", or
# "approved" once the owner has looked; then the conflicting files.
conflict_marker() { printf '%s/kraffic-merge-conflicts' "$(git rev-parse --absolute-git-dir)"; }

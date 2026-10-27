#!/bin/bash
# PostToolUse hook on Bash (.claude/settings.json): when a merge has stopped on conflicts, it records the files and
# tells Claude to STOP and show them to the owner. Until the owner runs `! .claude/hooks/approve-merge.sh conflicts`,
# guard-git.sh blocks committing that merge. Never resolve a conflict by keeping our version (CLAUDE.md).
here="$(cd "$(dirname "$0")" && pwd)"
. "$here/lib.sh"
input=$(cat)
cmd=$(printf '%s' "$input" | jq -r '.tool_input.command // empty' 2>/dev/null)
cwd=$(printf '%s' "$input" | jq -r '.cwd // empty' 2>/dev/null)
cd "$(hook_repo_dir "$cmd" "$cwd")" 2>/dev/null || exit 0
git rev-parse --git-dir >/dev/null 2>&1 || exit 0
merge_head=$(git rev-parse -q --verify MERGE_HEAD 2>/dev/null) || exit 0
files=$(git diff --name-only --diff-filter=U 2>/dev/null)
[ -z "$files" ] && exit 0

m=$(conflict_marker)
# already approved for this merge: the owner has seen the files, Claude may resolve them
if [ -f "$m" ] && [ "$(sed -n 1p "$m")" = "$merge_head" ] && sed -n 2p "$m" | grep -qx approved; then exit 0; fi
{ echo "$merge_head"; echo "pending"; printf '%s\n' "$files"; } > "$m"
{
  echo "STOP: the merge has conflicts in:"
  printf '%s\n' "$files" | sed 's/^/  /'
  echo "Show the owner these files (and both sides of each conflict) and wait. Don't resolve them, and never by keeping"
  echo "our version. Committing this merge is blocked until the owner runs: ! .claude/hooks/approve-merge.sh conflicts"
} >&2
exit 2

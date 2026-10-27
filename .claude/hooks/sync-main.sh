#!/bin/bash
# Usage: sync-main.sh [dir]   (session-start.sh at session start; prompt-sync.sh after 30 min idle)
# Fetches origin, fast-forwards local main to origin/main (never a merge commit, never over uncommitted changes), then
# says which branch this session is on and how far it is behind origin/main. On main, on a branch behind origin/main,
# or on a branch older than 24h / created before main last moved, it says so loudly (CLAUDE.md, "Before any work").
here="$(cd "$(dirname "$0")" && pwd)"
cd "${1:-${CLAUDE_PROJECT_DIR:-.}}" 2>/dev/null || exit 0
git rev-parse --git-dir >/dev/null 2>&1 || exit 0
date +%s > "$(git rev-parse --path-format=absolute --git-common-dir)/kraffic-last-prompt" 2>/dev/null

if ! git fetch origin --prune --quiet 2>/dev/null; then
  echo "WARNING: git fetch origin failed (offline?). The numbers below may be out of date."
fi

# fast-forward local main, wherever it is checked out
if git show-ref --verify -q refs/heads/main && git show-ref --verify -q refs/remotes/origin/main; then
  local_main=$(git rev-parse refs/heads/main); remote_main=$(git rev-parse refs/remotes/origin/main)
  if [ "$local_main" != "$remote_main" ]; then
    if git merge-base --is-ancestor refs/heads/main refs/remotes/origin/main; then
      main_wt=$(git worktree list --porcelain | awk '/^worktree /{p=substr($0,10)} $0=="branch refs/heads/main"{print p}')
      if [ -z "$main_wt" ]; then
        git update-ref refs/heads/main "$remote_main" "$local_main" && echo "main fast-forwarded to origin/main."
      elif [ -z "$(git -C "$main_wt" status --porcelain --untracked-files=no)" ]; then
        git -C "$main_wt" merge --ff-only --quiet refs/remotes/origin/main && echo "main fast-forwarded to origin/main."
      else
        echo "WARNING: main has uncommitted changes in ${main_wt}: not fast-forwarded."
      fi
    else
      echo "WARNING: local main has commits that aren't on origin/main: not fast-forwarded. Move them to a branch."
    fi
  fi
fi

branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
behind=$(git rev-list --count HEAD..origin/main 2>/dev/null || echo "?")
ahead=$(git rev-list --count origin/main..HEAD 2>/dev/null || echo "?")
dirty=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')

echo "Branch: ${branch} · ${behind} commit(s) behind origin/main · ${ahead} ahead · ${dirty} uncommitted file(s)"
if [ "$branch" = "main" ] || [ "$branch" = "HEAD" ]; then
  echo "!!! ON $(echo "$branch" | tr '[:lower:]' '[:upper:]'): do not work here. Start a NEW branch from origin/main: git worktree add -b <task> ~/Documents/kraffic-worktrees/<task> origin/main"
  exit 0
fi
if [ "$behind" != "?" ] && [ "$behind" -gt 0 ]; then
  echo "!!! STALE BRANCH: ${branch} is ${behind} commit(s) behind origin/main. For a new task start a NEW branch from origin/main; to finish this one: git fetch origin && git merge origin/main (no rebase, no force). On a conflict STOP and show the owner the files (commits, pushes and merges are blocked until then)."
fi
# created = the branch's first reflog entry; without one (a fetched branch), where it forked from main
created=$(git reflog show --format=%ct "refs/heads/${branch}" 2>/dev/null | tail -1)
[ -z "$created" ] && created=$(git log -1 --format=%ct "$(git merge-base HEAD origin/main 2>/dev/null)" 2>/dev/null)
main_time=$(git log -1 --format=%ct origin/main 2>/dev/null)
if [ -n "$created" ] && { [ $(( $(date +%s) - created )) -gt 86400 ] || { [ -n "$main_time" ] && [ "$main_time" -gt "$created" ]; }; }; then
  echo "!!! OLD BRANCH: ${branch} is older than 24h or main has moved since it was created. Before merging: merge origin/main in, re-check every file it touches against origin/main, and list for the owner the lines of other people's commits it would change or remove: ${here#"$PWD"/}/others-lines.sh origin/main HEAD 0"
fi
exit 0

#!/bin/bash
# PreToolUse hook (.claude/settings.json) on Bash, Write, Edit, MultiEdit and NotebookEdit. Exit 2 blocks the call and
# the message goes to Claude. It enforces these CLAUDE.md rules:
#  - only the owner approves: approve-merge.sh and its approval files can't be run or written by Claude
#  - no rebase, no force push, no reset --hard, no direct push to main, no conflict resolved by keeping "ours"
#  - no printing env files or the whole environment (secrets)
#  - no SSH, scp, sftp or rsync to a server (a port-forward tunnel, ssh -N -L, is allowed)
#  - git commit / git push / gh pr create / gh pr merge are blocked from a branch behind origin/main; push and
#    pr create with uncommitted changes; committing a merge with conflicts the owner hasn't seen (conflict-stop.sh)
#  - one open PR at a time: gh pr create only for develop → main while no other PR is open; no gh pr reopen
#  - every push builds first (npm run build into a temp folder); a failed build blocks the push
#  - no AI attribution in commit messages or PR text
#  - gh pr merge only for the develop → main PR, with the owner's approval at its current head commit (merge-check.sh)
# Every other call passes.
here="$(cd "$(dirname "$0")" && pwd)"
. "$here/lib.sh"
input=$(cat)
tool=$(printf '%s' "$input" | jq -r '.tool_name // empty' 2>/dev/null)
block() { echo "$1" >&2; exit 2; }
OWNER_ONLY="Only the owner approves merges and conflict resolutions: they run ! .claude/hooks/approve-merge.sh themselves."

if [ -n "$tool" ] && [ "$tool" != "Bash" ]; then
  path=$(printf '%s' "$input" | jq -r '.tool_input.file_path // .tool_input.notebook_path // empty' 2>/dev/null)
  case "$path" in *kraffic-approved-merges*|*kraffic-merge-conflicts*) block "$OWNER_ONLY" ;; esac
  exit 0
fi

cmd=$(printf '%s' "$input" | jq -r '.tool_input.command // empty' 2>/dev/null)
cwd=$(printf '%s' "$input" | jq -r '.cwd // empty' 2>/dev/null)
[ -z "$cmd" ] && exit 0
has() { printf '%s' "$cmd" | grep -Eq -- "$1"; }

START='(^|[;&|(]|&&)[[:space:]]*'
GIT="${START}git([[:space:]]+-C[[:space:]]+[^[:space:]]+)?([[:space:]]+-c[[:space:]]+[^[:space:]]+)*[[:space:]]+"
GH="${START}gh[[:space:]]+(-R[[:space:]]+[^[:space:]]+[[:space:]]+)?pr[[:space:]]+"
SEG='[^;&|]*'   # the rest of the same command

# --- owner-only approvals
has 'approve-merge|kraffic-approved-merges|kraffic-merge-conflicts' && block "$OWNER_ONLY"

# --- history rewriting and "keep ours"
if has "${GIT}rebase([[:space:]]|$)" || has "${GIT}pull${SEG}--rebase"; then
  block "No rebase (CLAUDE.md, stale-branch rule): git fetch origin && git merge origin/main."
fi
if has "${GIT}push${SEG}[[:space:]](--force|--force-with-lease|--force-if-includes|-[a-zA-Z]*f[a-zA-Z]*)([=[:space:]]|$)" \
  || has "${GIT}push${SEG}[[:space:]]\+[^[:space:]]"; then
  block "No force push (CLAUDE.md). Merge origin/main into the branch and push normally; roll back with git revert."
fi
has "${GIT}reset${SEG}--hard" && block "No git reset --hard (CLAUDE.md): roll back with git revert; to drop local edits, ask the owner."
if has "${GIT}(merge|pull)${SEG}(-X[[:space:]]*ours|--strategy-option[=[:space:]]*ours|-s[[:space:]]*ours|--strategy[=[:space:]]*ours)" \
  || has "${GIT}(checkout|restore)${SEG}--ours"; then
  block "Never resolve a conflict by keeping our version (CLAUDE.md). STOP and show the owner the conflicting files."
fi

# --- secrets: env files and the environment are never printed (names only: grep -oE '^[A-Z_]+=' <file>)
if has "${START}(cat|less|more|head|tail|bat|nl|strings|xxd|od)[[:space:]]" \
  && printf '%s' "$cmd" | grep -Eo '[^[:space:];&|]*\.env[^[:space:];&|]*' | grep -vqE '\.env\.example$'; then
  block "Never print secrets or env values (CLAUDE.md). List the names only: grep -oE '^[A-Z_]+=' <file>"
fi
has "${START}(printenv|env)[[:space:]]*($|[;&|])" && block "Never print the environment (CLAUDE.md): it holds secrets."

# --- the server changes only through git: no SSH sessions or file copies; a port-forward tunnel (ssh -N -L) is fine
if has "${START}(scp|sftp)[[:space:]]" || has "${START}rsync${SEG}[^[:space:]]+:"; then
  block "Never change files on the server (CLAUDE.md): every change goes through git and the deploy."
fi
if has "${START}ssh[[:space:]]" && ! { has "${START}ssh${SEG}[[:space:]]-[a-zA-Z]*N" && has "${START}ssh${SEG}[[:space:]]-[a-zA-Z]*L"; }; then
  block "No SSH to the server (CLAUDE.md). Only a port-forward tunnel for the read-only DB user: ssh -N -L <port>:localhost:5432 <host>"
fi

# --- which git/gh action is this
kind=""
has "${GIT}commit([[:space:]]|$)" && kind="commit"
has "${GIT}merge[[:space:]]+--continue" && kind="commit"
has "${GIT}push([[:space:]]|$)" && kind="push"
has "${GH}create([[:space:]]|$)" && kind="pr-create"
has "${GH}edit([[:space:]]|$)" && kind="pr-edit"
has "${GH}reopen([[:space:]]|$)" && kind="pr-reopen"
has "${GH}merge([[:space:]]|$)" && kind="pr-merge"
[ -z "$kind" ] && exit 0

# --- no AI attribution (commit message / PR text in the command, or a --body-file)
ATTR='co-authored-by:[^"]*(claude|anthropic|cursor|copilot|openai|chatgpt)|generated (with|by) \[?claude|🤖|noreply@anthropic'
attributed() { grep -Eiq -- "$ATTR"; }
printf '%s' "$cmd" | attributed && block "No AI attribution in commits, PR titles or PR descriptions (CLAUDE.md)."
body_file=$(printf '%s' "$cmd" | sed -nE 's/.*(--body-file|-F)[[:space:]]+("([^"]+)"|([^[:space:]]+)).*/\3\4/p' | head -1)
[ -n "$body_file" ] && [ -f "$body_file" ] && attributed < "$body_file" && block "No AI attribution in PR text (CLAUDE.md)."

ONE_PR="One open PR at a time (CLAUDE.md): only the Release PR, develop → main. Work lands on develop as commits; unfinished design work stays on its own branch with no PR."
# editing the Release PR's title or text is fine; reopening a closed PR would make a second open PR
[ "$kind" = "pr-edit" ] && exit 0
[ "$kind" = "pr-reopen" ] && block "$ONE_PR Closed PRs stay closed: an approved branch joins develop as one squashed commit."
repo=$(printf '%s' "$cmd" | sed -nE 's/.*[[:space:]](-R|--repo)[[:space:]]+([^[:space:]]+).*/\2/p' | head -1)

if [ "$kind" = "pr-merge" ]; then
  pr=$(printf '%s' "$cmd" | sed -nE 's/.*pr[[:space:]]+merge[[:space:]]+([0-9]+).*/\1/p' | head -1)
  cd "$(hook_repo_dir "$cmd" "$cwd")" 2>/dev/null || block "gh pr merge: run it from inside the repo, so the hook can check the PR."
  git rev-parse --git-dir >/dev/null 2>&1 || block "gh pr merge: run it from inside the repo, so the hook can check the PR."
  info=$(gh pr view ${pr:+"$pr"} ${repo:+-R "$repo"} --json number,headRefOid,baseRefName,headRefName 2>/dev/null \
    | jq -r '"\(.number) \(.baseRefName) \(.headRefOid) \(.headRefName)"' 2>/dev/null)
  [ -z "$info" ] && block "gh pr merge: couldn't read the PR from GitHub, so it can't be checked."
  set -- $info; pr="$1"; base="$2"; head="$3"; head_branch="$4"
  [ "$head_branch" = "develop" ] && [ "$base" = "main" ] || block "PR ${pr} is ${head_branch} → ${base}. $ONE_PR Only the Release PR is merged."
  [ -z "$repo" ] && repo=$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null)
  # how many commits of the base its branch doesn't have (GitHub's compare)
  behind=$(gh api "repos/${repo}/compare/${base}...${head}" -q .behind_by 2>/dev/null || echo 0)
  [ "${behind:-0}" -gt 0 ] && block "PR ${pr} is ${behind} commit(s) behind ${base}: merge origin/${base} into its branch (no rebase), re-run build + tests, wait for CI."
  git fetch -q origin "$base" "pull/${pr}/head" 2>/dev/null
  "$here/merge-check.sh" "origin/${base}" "$head" "$pr"
  exit $?
fi

cd "$(hook_repo_dir "$cmd" "$cwd")" 2>/dev/null || exit 0
git rev-parse --git-dir >/dev/null 2>&1 || exit 0
git fetch origin main --quiet 2>/dev/null
branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)

if [ "$kind" = "pr-create" ]; then
  head_b=$(printf '%s' "$cmd" | sed -nE 's/.*[[:space:]](--head|-H)[=[:space:]]+([^[:space:]]+).*/\2/p' | head -1)
  base_b=$(printf '%s' "$cmd" | sed -nE 's/.*[[:space:]](--base|-B)[=[:space:]]+([^[:space:]]+).*/\2/p' | head -1)
  head_b="${head_b:-$branch}"; base_b="${base_b:-main}"
  [ "$head_b" = "develop" ] && [ "$base_b" = "main" ] || block "No PR for ${head_b} → ${base_b}. $ONE_PR"
  open=$(gh pr list ${repo:+-R "$repo"} --state open --json number,headRefName,baseRefName 2>/dev/null)
  n=$(printf '%s' "$open" | jq 'length' 2>/dev/null)
  [ -z "$n" ] && block "gh pr create: couldn't list the open PRs on GitHub, so the one-PR rule can't be checked."
  [ "$n" -gt 0 ] && block "$ONE_PR Already open: $(printf '%s' "$open" | jq -r '[.[] | "#\(.number) \(.headRefName) → \(.baseRefName)"] | join(", ")')."
fi

# a merge in progress: the commit that finishes it brings origin/main in, so count against both parents
if merge_head=$(git rev-parse -q --verify MERGE_HEAD 2>/dev/null); then
  behind=$(git rev-list --count origin/main ^HEAD "^${merge_head}" 2>/dev/null || echo 0)
  m=$(conflict_marker)
  if [ -f "$m" ] && [ "$(sed -n 1p "$m")" = "$merge_head" ] && ! sed -n 2p "$m" | grep -qx approved; then
    block "This merge had conflicts the owner hasn't approved resolving: $(sed '1,2d' "$m" | tr '\n' ' ')— show them the files and wait for: ! .claude/hooks/approve-merge.sh conflicts"
  fi
else
  rm -f "$(conflict_marker)" 2>/dev/null
  behind=$(git rev-list --count HEAD..origin/main 2>/dev/null || echo 0)
fi
[ "$behind" -gt 0 ] && block "${branch} is ${behind} commit(s) behind origin/main: git fetch origin && git merge origin/main (no rebase), re-run build + tests. On a conflict STOP and show the owner the files."

if [ "$kind" = "push" ]; then
  # straight to main: every push to main deploys; main changes only through a merged PR
  if [ "$branch" = "main" ] && ! has "${GIT}push${SEG}[[:space:]][^-[:space:]][^[:space:]]*[[:space:]]+[^-[:space:]]"; then
    block "No pushing to main (CLAUDE.md): every push to main deploys. Push a branch and open a PR."
  fi
  if has "${GIT}push${SEG}[[:space:]](([^[:space:]]*:)?(refs/heads/)?main)([[:space:]]|$)"; then
    block "No pushing to main (CLAUDE.md): every push to main deploys. Push a branch and open a PR."
  fi
  # commits on the branch that main doesn't have yet
  git log --format='%B' origin/main..HEAD 2>/dev/null | attributed && block "A commit on ${branch} has AI attribution in its message (CLAUDE.md): reword it with a new commit, never by rewriting pushed history; ask the owner."
fi
if [ "$kind" != "commit" ] && [ -n "$(git status --porcelain 2>/dev/null)" ]; then
  block "${branch} has uncommitted changes: commit them on this task's branch, or move them to their own branch first."
fi
# this repo has no CI: every push builds first (into a temp folder, so dist/ is untouched)
if [ "$kind" = "push" ] && [ -f package.json ] && jq -e '.scripts.build' package.json >/dev/null 2>&1; then
  out_dir=$(mktemp -d)
  log=$(npm run -s build -- --outDir "$out_dir" --emptyOutDir 2>&1); s=$?
  rm -rf "$out_dir"
  [ "$s" -ne 0 ] && block "npm run build fails, so nothing is pushed (CLAUDE.md: build before every push). Last lines:
$(printf '%s\n' "$log" | tail -15)"
fi
exit 0

#!/bin/bash
# UserPromptSubmit hook (.claude/settings.json): when the last prompt was more than 30 minutes ago, fetch origin and
# fast-forward main again (sync-main.sh), so a long-idle session sees what landed on main meanwhile. Its output is
# added to the prompt's context. Otherwise it only records the time.
here="$(cd "$(dirname "$0")" && pwd)"
input=$(cat)
cwd=$(printf '%s' "$input" | jq -r '.cwd // empty' 2>/dev/null)
dir="${cwd:-${CLAUDE_PROJECT_DIR:-.}}"
cd "$dir" 2>/dev/null || exit 0
git rev-parse --git-dir >/dev/null 2>&1 || exit 0
stamp="$(git rev-parse --path-format=absolute --git-common-dir)/kraffic-last-prompt"
now=$(date +%s)
last=$(cat "$stamp" 2>/dev/null); case "$last" in ''|*[!0-9]*) last=0 ;; esac
idle="${KRAFFIC_IDLE_SECONDS:-1800}"
if [ $(( now - last )) -gt "$idle" ]; then
  echo "Idle for more than $(( idle / 60 )) minutes: fetched origin again."
  exec "$here/sync-main.sh" "$dir"
fi
echo "$now" > "$stamp"
exit 0

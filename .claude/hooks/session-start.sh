#!/bin/bash
# SessionStart hook (.claude/settings.json): fetch origin, fast-forward main, and say which branch this session is on
# and how far it is behind origin/main (sync-main.sh). prompt-sync.sh does the same after 30 minutes idle.
exec "$(cd "$(dirname "$0")" && pwd)/sync-main.sh" "${CLAUDE_PROJECT_DIR:-.}"

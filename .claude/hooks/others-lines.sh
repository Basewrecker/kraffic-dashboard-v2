#!/bin/bash
# Usage: others-lines.sh <base> <head> [days]
# Lists the lines of <base> that <head> would change or remove, and that were last touched by someone other than the
# authors of <head>'s own commits (base..head), within the last <days> days (default 7; 0 = any age).
# <head> must already contain <base> (merge origin/main in first), so the diff is exactly what merging would do.
# Exit 0: none. Exit 1: some (listed on stdout as file:line, author, date, commit, line). Exit 2: can't check.
# Run by hand for the stale-branch re-check (CLAUDE.md): .claude/hooks/others-lines.sh origin/main HEAD 0
base="$1"; head="$2"; days="${3:-7}"
if [ -z "$base" ] || [ -z "$head" ]; then echo "usage: others-lines.sh <base> <head> [days]" >&2; exit 2; fi
if ! git merge-base --is-ancestor "$base" "$head" 2>/dev/null; then
  echo "$head doesn't contain $base: merge $base into it first, then re-check." >&2
  exit 2
fi

ours=$(git log --format='%ae' "$base..$head" | sort -u)
cutoff=0
[ "$days" -gt 0 ] && cutoff=$(( $(date +%s) - days * 86400 ))

found=0
# each changed or removed run of base lines: file <tab> first line <tab> count (pure additions change no base line)
while IFS="$(printf '\t')" read -r file start count; do
  [ -z "$file" ] && continue
  out=$(git blame --line-porcelain -L "$start,+$count" "$base" -- "$file" 2>/dev/null | awk -v ours="$ours" -v cutoff="$cutoff" -v file="$file" '
    BEGIN { n = split(ours, o, "\n"); for (i = 1; i <= n; i++) mine[o[i]] = 1 }
    /^[0-9a-f]+ [0-9]+ [0-9]+/ && length($1) == 40 { sha = substr($1, 1, 8); line = $3; next }
    /^author / { author = substr($0, 8); next }
    /^author-mail / { mail = substr($0, 13); gsub(/[<>]/, "", mail); next }
    /^author-time / { t = $2; next }
    /^\t/ {
      if (!(mail in mine) && t >= cutoff) {
        cmd = "date -r " t " +%Y-%m-%d 2>/dev/null || date -d @" t " +%Y-%m-%d"
        cmd | getline day; close(cmd)
        printf "%s:%s  %s <%s>  %s  %s  | %s\n", file, line, author, mail, day, sha, substr($0, 2)
      }
    }')
  if [ -n "$out" ]; then found=1; printf '%s\n' "$out"; fi
done <<EOF
$(git diff -U0 --no-renames --no-color "$base" "$head" | awk '
  /^diff --git / { file = "" }
  /^--- / { file = ($0 == "--- /dev/null") ? "" : substr($0, 7) }
  /^@@ / {
    split($2, a, ","); start = substr(a[1], 2); count = (a[2] == "") ? 1 : a[2]
    if (file != "" && count > 0) printf "%s\t%s\t%s\n", file, start, count
  }')
EOF
exit "$found"

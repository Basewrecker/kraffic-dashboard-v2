# kraffic-dashboard-v2 (the design mock) — working rules

## Before any work

### ONE CHANGE AT A TIME
- Work on exactly one change per branch. Don't start the next change until the current one is finished: pushed, PR
  opened, CI green, and either merged or explicitly parked by the owner.
- Push early and often. Commit + push at every working step, so nothing exists only on this Mac.
- When a change is merged: delete its local branch and worktree, then `git fetch --prune` and
  `git switch main && git pull`.
- If the owner asks for something new while a change is in progress: finish and push the current one first (or push it
  as a draft PR named "PARKED: …"), then start the new one from fresh origin/main.
- End of every session: `git status` must be clean and there must be no unpushed commits on any branch. Report anything
  that isn't.
- Never keep work in /tmp or /private/tmp. Worktrees live in `~/Documents/kraffic-worktrees/<branch>` (a temp folder can
  be wiped: on 2026-10-27 one took an unpushed commit with it).
- Push every branch to GitHub at the end of each work session (a draft PR if it isn't ready), so nothing exists only
  on disk.

### Every task
- Every task starts with `git fetch origin` and a NEW branch from origin/main. Never reuse old branches or worktrees.
- Before merging: merge origin/main into the branch, run `npm run build`, and wait for CI to pass.
- This mock is the source of app.kraffic.ai's dashboard pages (harshranjandas/app_kraffic.ai copies `src/` into
  `components/mock`). A change here is copied there by hand: diff and merge, never overwrite an app file wholesale.
  The app's own logic (feature flags, data loading, permissions, scoring) lives in the app's adapter / wrappers, never
  in the copied files, so a mock copy can't wipe it. After any copy the app runs its full regression suite.
- Every bug fix ships with a test that fails without the fix (in the app repo: `docs/regressions.md`).
- Never delete or hide a card or feature to make a test pass. Ask the owner.
- After a merge, delete that task's worktree. No AI attribution in commits or PRs; rollbacks are `git revert` only.
- `node_modules/.vite/deps/*` is tracked by mistake: restore those files before committing (`git checkout -- node_modules`).

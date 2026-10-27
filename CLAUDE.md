# kraffic-dashboard-v2 (the design mock) — working rules

## Before any work
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

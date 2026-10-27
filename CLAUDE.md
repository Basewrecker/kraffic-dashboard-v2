# kraffic-dashboard-v2 (the design mock) — working rules

This repo, `Basewrecker/kraffic-dashboard-v2`, is the design mock and the source of truth for every dashboard page
of app.kraffic.ai (`harshranjandas/app_kraffic.ai`, which copies `src/` into `components/mock` and has its own
CLAUDE.md with the same rules). Vite + React + Tailwind v4. `[hook]` marks a rule a hook in `.claude/hooks/`
enforces; the list of what can't be enforced is at the end.

## 1. Before any work
- Start every task with `git fetch origin` and a NEW branch from origin/main. Never reuse old branches or worktrees.
  Work only in the main clone (`~/Documents/kraffic-dasboard-v2/kraffic-dashboard`) or a worktree at
  `~/Documents/kraffic-worktrees/<branch>`: `git worktree add -b <branch> ~/Documents/kraffic-worktrees/<branch>
  origin/main`. Never in /tmp.
- At session start, and again after 30 minutes idle, the hooks fetch origin, fast-forward local main and print the
  branch and how far it is behind origin/main `[hook]`.
- **One change at a time.** Finish → push → PR → checks green before starting the next change. Push at every
  working step; nothing finished stays unpushed for hours, and nothing is unpushed at session end (park unfinished
  work as a draft PR). After a merge, delete the branch and its worktree (`git worktree remove <dir>`).
- **Stale-branch rule.**
  - Before every commit, push and merge: `git fetch origin && git merge origin/main` into the branch. No rebase, no
    force push `[hook]`. Commit, push, PR create and PR merge are blocked from a branch behind origin/main `[hook]`.
  - A conflict means STOP: show the owner the conflicting files and both sides, and wait. Never resolve a conflict by
    keeping our (older) version `[hook]`: the merge can't be committed until the owner runs
    `! .claude/hooks/approve-merge.sh conflicts`.
  - A branch older than 24h, or one created before main last moved: before merging, re-check every file it touches
    against origin/main and list for the owner the lines of other people's commits it would change or remove:
    `.claude/hooks/others-lines.sh origin/main HEAD 0`. The hooks print this reminder `[hook]`.
  - Never overwrite a whole file with a copied version (old copy, another worktree, the app). Diff and merge by hand.

## 2. Design: this mock is the source of truth
- Every UI change is designed here first, with screenshots for the owner's review. Only after the owner approves is
  it ported to the app.
- **Port = copy this mock 1:1** into the app. The app may change only import paths, routing, the data source (through
  its adapter, returning this mock's data shape) and `"use client"`; both repos use Tailwind v4. The app PR proves it
  with a labeled `diff -r` against this repo.
- So a copy never wipes app logic: feature flags, permissions, data loading and scoring live in the app's adapter
  and wrappers, never in files here. Mock data stays in this repo's data files, in the shape the app's adapter returns.
- Production must look exactly like this mock, with no remnants of the old UI.
- **Locked design system.** Manrope; the existing type scale; graphite tokens only (no hex, no `gray-*`, no
  `bg-white`); light and dark; no uppercase labels; no coloured pills or links; no yellow; red only for drops and
  errors; brand colours only in the line chart, with the user's brand always ink; `tabular-nums` on numbers; never
  repeat the same number on a page; insights in plain English with a "Why?"; reuse existing components (drawers,
  segmented controls, chips, tabs) before inventing new ones.
- Every card handles full, small and empty brands, plus loading and error states. Screenshots at 1440 and 390 wide,
  light and dark.

## 3. Data and product rules
- The mock's data has the app's real shapes. Nothing hard-coded in components: no brands, counts, domains, or names
  built from domains. If the app's API can't supply something the design shows, report it to the owner; never fake
  it, and never change the design to hide it.
- Score = average of the shown engines. Mention = brand named in the answer text. Citation = the answer links to the
  brand's domain. Cited pages = distinct pages after URL normalisation (no www, fragment, trailing slash, `utm_*` or
  tracking params). One shared function computes all of these.
- A failed or incomplete scan is a gap ("—"), never 0.
- "Sync now" stays a real, paid, full scan.
- Marketplaces show when ecommerce is on: agency AND client flag for agency clients; direct clients use their own
  flag. Admin views use the selected brand's owner account, never the signed-in admin's.
- Client logos and client data on public pages stay behind flags until there's written permission.

## 4. Testing and regressions
- Every bug fix ships with a test that fails without the fix (`npm test` here; app bugs go in the app's
  `npm run test:ci`). The log is the app's `docs/regressions.md`. The hooks have their own tests
  (`bash .claude/hooks/test-hooks.sh`).
- Never delete, hide or weaken a feature or a test to make checks pass. Ask the owner.
- Merge only when `npm run build` and `npm test` pass, including failures caused by low disk space. This repo has no
  CI workflow, so run both yourself and say so in the PR.

## 5. Merging and deploy
- There is no GitHub Actions workflow here; `vercel.json` only rewrites every path to `index.html`. Nothing on this
  repo's side deploys automatically, and no GitHub deployments are recorded. Whether a Vercel project is linked to
  `main` hasn't been checked.
- Merge to main only with the owner's explicit approval in their latest message. `gh pr merge` is blocked until the
  owner runs `! .claude/hooks/approve-merge.sh <pr>` at the PR's current head (a new push needs a new approval). The
  block lists every line the PR changes that another author touched in the last 7 days `[hook]`.
- Never push to main directly `[hook]`. Never change files on a server; every change goes through git `[hook]`.

## 6. Database and server
- This repo has no database. In the app: never write to the live DB; schema changes are additive SQL proposals plus
  undo SQL that the owner runs; live data only through the read-only DB user; writes, scans and test invites only
  on the BBX/test brand (the app's CLAUDE.md has the details).

## 7. Security and git hygiene
- Never print secrets or env values; names only `[hook]`. No hard-coded fallback secrets.
- No AI attribution in commits, PR titles or PR descriptions `[hook]`.
- Rollback only with `git revert`. No `reset --hard` and no force push on shared branches `[hook]`.

## 8. Reporting
- Report in plain words: what changed, what's live, what's waiting on the owner, and anything unverified.

## What the hooks can't enforce
The design rules (section 2), the data and product rules (3), "one change at a time", reading the 24h re-check list,
screenshots, test quality, and running `npm run build` and `npm test` before a merge.
`.claude/hooks/approve-merge.sh` is run by the owner with `!`; Claude is blocked from running it or writing its files.

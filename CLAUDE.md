# kraffic-dashboard-v2 (the design mock) — working rules

This repo, `Basewrecker/kraffic-dashboard-v2`, is the design mock and the source of truth for every dashboard page
of app.kraffic.ai (`harshranjandas/app_kraffic.ai`, which copies `src/` into `components/mock` and has its own
CLAUDE.md). Vite + React + Tailwind v4. `[hook]` marks a rule a hook in `.claude/hooks/` enforces; the list of what
can't be enforced is at the end.

**Scope:** a session in this repo works in this repo only. Never edit, branch or open PRs in the app repo or any other
repo.

## 1. Branches: one `develop`, one Release PR
- **One mock copy:** `~/Documents/mock-v2` (main clone), with `develop` checked out in the long-lived worktree
  `~/Documents/kraffic-worktrees/develop`. Design branches get a worktree at `~/Documents/kraffic-worktrees/<name>`.
  Never in /tmp.
- **All work lands on `develop`.** One change = one commit, pushed immediately. No per-change PRs. Commits and pushes
  to `develop` are allowed `[hook]`; pushing to `main` is not `[hook]`.
- **Exactly one open PR at any time:** `develop` → `main`, titled "Release: <date>". `gh pr create` is blocked for
  anything else, and while any other PR is open; `gh pr reopen` is blocked `[hook]`. Editing the Release PR's text is
  fine. Merging it publishes the mock (Vercel), only with the owner's approval (section 5). After it merges, keep
  `develop` (merge origin/main into it, a fast-forward) and open the next Release PR.
- **Unfinished design work** stays on its own branch (`design/<name>`, from origin/develop), pushed, with no PR `[hook]`.
  It joins `develop` only once the owner has approved its screenshots, as ONE squashed commit:
  `git merge --squash origin/<branch>` on develop, then one commit naming the change. The branch is kept.
- **Before every push and every merge:** `git fetch origin`, and if main moved, `git merge origin/main` into the
  branch. No rebase, no force push `[hook]`. Commit, push, PR create and PR merge are blocked from a branch behind
  origin/main `[hook]`; push and PR create with uncommitted changes too `[hook]`.
- **Conflicts:** STOP, show the owner the conflicting files and both sides, and wait. Never resolve by keeping "ours"
  `[hook]`: the merge can't be committed until the owner runs `! .claude/hooks/approve-merge.sh conflicts`.
- **Before every push:** `npm run build` must pass (this repo has no CI). The hook builds into a temp folder before
  every push and blocks it on failure `[hook]`. Run `npm test` too.
- At session start, and again after 30 minutes idle, the hooks fetch origin, fast-forward local main and print the
  branch and how far it is behind origin/main `[hook]`.
- A design branch older than 24h, or made before main last moved: before it joins develop, re-check every file it
  touches against origin/main and list for the owner the lines of other people's commits it would change or remove:
  `.claude/hooks/others-lines.sh origin/main HEAD 0` (the hooks print the reminder) `[hook]`.
- Never overwrite a whole file with a copied version (old copy, another worktree, the app). Diff and merge by hand.
- Nothing unpushed at session end; `git status` clean.

## 2. Design: this mock is the source of truth
- **`DESIGN.md` is the design system** (tokens, type, colour rules, the Reports frame, the words and missing-data rules,
  the design guides' order of authority). Read it before any UI change; when code and DESIGN.md disagree, fix one in the same change.
- Every UI change is designed here first, with screenshots for the owner's review. Only after the owner approves is
  it ported to the app (by a session in the app repo, not from here).
- **Port = copy this mock 1:1** into the app. The app may change only import paths, routing, the data source (through
  its adapter, returning this mock's data shape) and `"use client"`; both repos use Tailwind v4.
- So a copy never wipes app logic: feature flags, permissions, data loading and scoring live in the app's adapter
  and wrappers, never in files here. Mock data stays in this repo's data files, in the shape the app's adapter returns.
- Production must look exactly like this mock, with no remnants of the old UI.
- **Locked design system.** Manrope; the existing type scale; graphite tokens only (no hex, no `gray-*`, no
  `bg-white`); light and dark; no uppercase labels; no coloured pills or links (two exceptions: the blue Reports send
  button, and the solid violet Beta tag, the `--beta` token, the only use of violet); no yellow; red only for drops
  and errors; brand colours only in the line chart, with the user's brand always ink; `tabular-nums` on numbers; never
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
- Every bug fix ships with a test that fails without the fix (`npm test`). The hooks have their own tests
  (`bash .claude/hooks/test-hooks.sh`).
- Never delete, hide or weaken a feature or a test to make checks pass. Ask the owner.
- `npm run build` and `npm test` pass before every push, including failures caused by low disk space. This repo has no
  CI: say in the Release PR that you ran both.

## 5. Merging and deploy
- Merging the Release PR (develop → main) publishes the mock on Vercel. Vercel builds from source (`dist/` isn't
  tracked; `.vercelignore` skips it); `vercel.json` only rewrites every path to `index.html`.
- Merge only with the owner's explicit approval in their latest message. `gh pr merge` works only for the
  develop → main PR, and only after the owner runs `! .claude/hooks/approve-merge.sh <pr>` at its current head (a new
  push needs a new approval). The block lists every line the PR changes that another author touched in the last 7
  days `[hook]`.
- Never push to main directly `[hook]`. Never change files on a server; every change goes through git `[hook]`.

## 6. Database and server
- This repo has no database and no server. The app's database rules live in the app's CLAUDE.md.

## 7. Security and git hygiene
- Never print secrets or env values; names only `[hook]`. No hard-coded fallback secrets.
- No AI attribution in commits, PR titles or PR descriptions `[hook]`.
- Rollback only with `git revert`. No `reset --hard` and no force push on shared branches `[hook]`.

## 8. Reporting
- Report in plain words: what changed, what's live, what's waiting on the owner, and anything unverified.

## What the hooks can't enforce
The design rules (section 2), the data and product rules (3), "one change = one commit", squashing an approved design
branch, the owner's screenshot approval, reading the 24h re-check list, test quality, `npm test` before a push, staying
out of other repos, and a PR made another way (`gh api`, the GitHub website).
`.claude/hooks/approve-merge.sh` is run by the owner with `!`; Claude is blocked from running it or writing its files.

# Handoff: Content workspace and related work (mock), 2026-11-04

State of the design mock (`Basewrecker/kraffic-dashboard-v2`) for whoever picks this up next. Port details live in
`docs/port-content.md`; this file is the summary.

## 1. On `develop` (pushed; `main` is still at 953cd18 "Release: 2026-10-27")
Newest first. Release PR #22 (develop → main) is open and carries all of these; merging it needs the owner.

| Hash | What |
|---|---|
| b27f059 | Hooks: squash-merge conflicts stop for the owner too (`merge_key` in lib.sh: MERGE_HEAD, or `squash:<commit>` from SQUASH_MSG); test-hooks.sh covers it (84 pass). |
| c731327 | No-result state on the Prompt mix table: the one "No {Engine} result in the latest scan" line + ⓘ, no brand tabs, no "won n new prompts" notice. Screenshots in `screenshots/no-result/`. |
| fa046eb | This handoff note. |
| 07c6b1f | A written draft survives a reload (saved brief keeps `written` + `sent`; list shows "Draft ready" and opens it). pdfjs-dist pinned to exactly 4.10.38. Port guide §9–10. |
| c5a40a4 | Your data joins v1: Target page → Your data → Draft → Copy & publish. Browser-only file reading, one `userFacts` payload. |
| 6a13be7 | Target page: format matrix left (8/12), Update column right (4/12); stacked below 1100px, matrix first. |
| 5d2e847 | No-result follow-ups: prompt tables' "No {Engine} result" line, Growth gap, Gemini's failed Sep 7 scan shows "—". |
| a4f95de | No-result state for engine scores (null, never 0): ring, text, change lines, history gap, menus. |
| 1b79186 | Sidebar nav density (232px, 30px rows, collapsible sections, soft Beta pill, brand card = domain / short name). |
| aa5622b | Opportunities → Content, squashed (list + workspace; v1 on the content-recommend response). |
| a5b2318 | Brand menu renders at the top level (portal) so the page doesn't cover it; browser test. |
| f63660f | CLAUDE.md colour rule matches DESIGN.md §3. |
| 1ccaae9 | App catch-up (the app's Oct 31 – Nov 3 design back in the mock). |

Tests: `npm test` = `node --test src/ tests/` (330 pass, 1 skipped on Node 18: a deflated-DOCX unit test the browser
test covers). Browser tests in `tests/` drive Chrome through playwright-core (`tests/chromePath.mjs`).

## 2. Branches not on develop
- `design/catchup-followups` (pushed, waiting for the owner): Sentiment dot-plot column lines between the four tone
  columns; "Suggested next" restyled in the mock's tokens. The owner said to leave it as it is for now.
- `design/content-opportunities`, `design/sidebar-density`: already squashed into develop (aa5622b, 1b79186); kept.

## 3. In progress / open decisions
- Nothing in progress in the mock.
- Open (owner): Release PR #22's description wasn't updated with the brand-menu note (a GitHub write was blocked; the
  owner said leave PR #22 as it is).
- Done 2026-11-04: the Prompt mix no-result line (c731327) and the squash-merge conflict gap in the hooks (b27f059).
  After a conflicted `git merge --squash`, the commit is now blocked until the owner runs
  `! .claude/hooks/approve-merge.sh conflicts`, same as a normal merge.
- Disk on the owner's Mac was nearly full earlier (builds and tests failed); ~8 GB free at last check.
- Older Content screenshots (291 files) are in `~/Documents/design-refs/content-history/`, not in the repo.

## 4. What the app session is porting
App session (`~/app_kraffic.ai`, latest name app-kraffic-ai-65). Already ported: aa5622b, 1b79186, a4f95de, 5d2e847.
Its order now: its own bug-fix round on `feat/content-page`, then 6a13be7 → c5a40a4 → 07c6b1f → c731327 (Prompt mix
no-result line; owner-approved 2026-11-04, sent), adding `userFacts` to
the content-recommend route (owner approved: optional field, no tools on the CLI for the draft call, nothing stored;
the no-tools switch is draft-only because runClaudeCli is shared with scans that need WebSearch). It will run
`npm audit` in the app and report pdfjs-dist findings to the owner. Mock-only parts it skips: sample data (e.g.
FAILED_SCANS), fixtures, `?co=` / `?noresult=` previews.

## 5. Rules agreed for Content
- v1 = what Harsh's `POST /api/missed-prompts/content-recommend` returns (exact shape mirrored in
  `src/data/contentRecommend.js`; every derivation in `src/pages/opportunities/draft/recommend.js`, R1–R28, tested).
  Everything else (Search Console, Publish & track, the live writing view, "Who you're up against" on the page) stays
  behind `?backend=full` and isn't ported.
- Steps: Target page → Your data → Draft → Copy & publish. Steps 2+ run in the centred focus panel (dialog, focus
  trapped, page behind inert, 880px / 1200px for Draft, min(content, viewport − 48px), centred by layout). The page
  never renders steps 3–5; it shows a payoff bar with live state and Resume.
- Writing state: honest. The app's two client messages (switch at 4.5s), a client-side timer, a skeleton of the
  headings the draft will have. No fake steps, counts or ticks.
- Draft: rendered from `contentMarkdown` by a text-only parser (`draft/markdown.js`): no raw HTML, links only for
  http/https with `rel="noopener noreferrer"`, Copy as HTML escaped from the tree. Hidden in the rendered draft: Page
  recommendation, Flags, Publishing notes, the review notice. Copy content / Copy as HTML = publishable sections only
  (no competitor-domain sources, flags, notes, page recommendation); Export .md = everything.
- Rail: flags as plain rows (label, note, "n pts", red dot on the top flag only), readiness ring "x/y" with the points
  and coverage only in the ⓘ; ticks are browser-only. Re-check score recomputes from the ticks (client-only, as the
  app). "What this draft adds" with a before/after strip; "Who you're up against" merged list + 1–10 rank strip.
- Engine icons: only the engines that apply, full colour, no ✓/✕ under them. `citedPages[].engines`: 'google' = rank
  only (no icon), 'aio' = Google AI Overview, 'ai' = resolved from the prompt's answers, else a neutral "AI".
- Light-mode contrast on the workspace only (dark unchanged): dividers #E3E3E3, rules #CFCFCF, card borders #DDDDDD,
  muted text #6B6B6B, hover tint #F0F0F0. One accent (`--co-a`, indigo) only for the checklist ring and worked-example
  chart (behind the flag).
- Names: competitor display names from competitor settings, never names built from a domain.

## 6. Rules agreed for Your data (v1)
- Three optional blocks (Upload documents · Add key facts · Answer what you can); Skip always available; "Sent with
  your draft, not stored" once under the step intro.
- Files read in the browser only, nothing uploaded or stored: TXT/CSV via File.text(), DOCX via a small built-in zip
  reader (DecompressionStream deflate-raw), PDF via pdfjs-dist **exactly 4.10.38**, dynamic-imported only when a PDF
  is added, client-side only, worker from our own build (never a CDN), `isEvalSupported: false`. PDF/DOCX/CSV/TXT, max
  10 MB each, 5 files. Rows: "Read · ~n words" or "Couldn't read this file".
- One `userFacts` payload `{ facts: [{label, value}], answers: [{flagId, answer}], documentsText }`, capped at 20,000
  characters: facts and answers never cut; document text cut at a word, the cut file named ("Too long, the first 20k
  characters will be used…"). Empty → no `userFacts` field. Taken when the writing starts and on each Regenerate.
- Questions = this prompt's response flags an answer can clear (locations, credentials, contact, fees, reviews,
  trademark), by score. Expert review and Draft gaps aren't asked.
- Kept per brand + prompt in localStorage `auden:content-data:v1:<domain>:<prompt>` (text + file metadata, never File
  objects); the app's sign-out (`clearBrowserData`) clears it.
- The saved draft brief `auden:content-brief:v1:<domain>:<prompt>` keeps ticks, copiedAt, savedAt, `written`, `sent`;
  a reload reopens on the Draft step with the saved draft.
- Uploaded text is untrusted (same as scraped pages) when it goes into the model prompt.
- Mock fixture: prompt 0 with `?co=data-sample`: the draft uses "our clinic at 14 King Street, Manchester" and the
  locations flag (Missing brand info) is cleared.

## 7. Things raised for Harsh / the app
- The draft lib's own review notice triggers the fees and reviews flags on every draft.
- The lib tells Claude to use the prompt itself as the first FAQ question, and the live run wrote "Confirm with your
  team: which…" in lowercase.
- The route returns the Target data and the draft in one response, so the Target step can't show before the draft is
  written (options: call it when the prompt opens, or split recommend → draft).
- Security: the Claude CLI ran with `--dangerously-skip-permissions` on scraped (and now user) text; no plan gate on a
  paid route. The app is adding a draft-only no-tools option.

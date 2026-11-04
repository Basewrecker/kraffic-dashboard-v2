# Port: Opportunities → Content (mock → app)

For the app session. Source: branch `design/content-opportunities` (see the commit hash in the release note). The mock
session never edits the app; this doc says what to copy, what to wire, and what to leave out.

**Port v1 only.** v1 is everything built on what Harsh's `POST /api/missed-prompts/content-recommend` returns today
(branch `fix/demo-qa-stability`, audited in the app's `docs/content-data-audit.md`). Everything else is behind
`?backend=full` in the mock and stays out of the app until its backend exists.

Not in this port: the sidebar density / 232px width / Beta pill restyle / brand-card text, and the brand-menu portal
fix. Those are separate (develop a5b2318 for the menu; the sidebar is on its own branch).

## 1. Routes and navigation
- `/opportunities/content`: the list. `/opportunities/content/<id>`: one prompt's workspace (`<id>` = the missed
  prompt's id; `rm-1` is the mock-only reverse-mortgage sample, don't port it as a route).
- Sidebar: a new group **Opportunities** with one item **Content** (`FilePenLine` icon, Beta tag), between Reports and
  Optimize. Mock: `src/components/dashboard/Sidebar.jsx` (`groups`), `src/App.jsx` (route).

## 2. Files to copy (paths in the mock)

### Pages (v1)
| File | What it is |
|---|---|
| `src/pages/opportunities/ContentRouter.jsx` | list vs workspace by path |
| `src/pages/opportunities/ContentList.jsx` | the list: KPI filter cards + the Overview's own `MissedPrompts` table with a Status column |
| `src/pages/opportunities/list/KpiCards.jsx` | the 4 filter cards (Missed · Drafts · Published & monitoring · Improved) |
| `src/pages/opportunities/list/StatusCell.jsx` | the one-line Status cell (Create content · Draft ready · Waiting to publish · Week n of 4 · No change yet · ▲ Improved) |
| `src/pages/opportunities/list/RowTip.jsx` | the 4-week tooltip on row hover |
| `src/pages/opportunities/list/model.js` (+ test) | list stages, filters, "Missed by", status text |
| `src/pages/opportunities/Workspace.jsx` | the workspace: header, payoff bar, steps, focus mode, draft session state |
| `src/pages/opportunities/workspace/PayoffBar.jsx` | the bar under the header (pills, reward headline, named engines, primary button) |
| `src/pages/opportunities/workspace/ActionDock.jsx` | the dark dock when the bar scrolls away |
| `src/pages/opportunities/workspace/TargetV1.jsx` | step 1 "Target page" (v1): rank ladder on top; below it the format matrix LEFT (8/12) and the Update column RIGHT (4/12: path, Open page, missing formats, "The draft adds", draft preview), divider between; below 1100px they stack, matrix first |
| `src/pages/opportunities/workspace/FocusPanel.jsx` | the centred dialog (Draft and Copy & publish happen inside it) |
| `src/pages/opportunities/workspace/PanelHeader.jsx` | the panel's sticky header |
| `src/pages/opportunities/workspace/CopyPublish.jsx` | step 3 "Copy & publish" (v1) |
| `src/pages/opportunities/workspace/flow.js` (+ test) | which steps exist (v1: 3; full: 5), focus-mode state |
| `src/pages/opportunities/workspace/ui.jsx` | small indicators: GreenTick, DashedRing, TickDraw, RingDraw, Collapse, Pills |
| `src/pages/opportunities/DraftStep.jsx` | step 2 "Draft": writing state → draft view, footer (Copy content, More ▾, Regenerate) |
| `src/pages/opportunities/draft/Writing.jsx` | the honest writing state (skeleton of the real headings, the app's two messages, a timer) |
| `src/pages/opportunities/draft/DraftView.jsx` | the rendered draft + the rail |
| `src/pages/opportunities/draft/markdown.js` (+ test) | the safe Markdown parser / serializers |
| `src/pages/opportunities/draft/recommend.js` (+ test) | **every derivation** from the response (rules R1–R28) |
| `src/pages/opportunities/draft/clipboard.js` | clipboard writes (text/plain, text/html) |
| `src/pages/opportunities/parts.jsx` | shared bits: goTo + view-transition name, Ring, WeekSegments, EngineMark, midTruncate, pathOf, uniqueDomains |

### Shared components changed (copy the change, not the whole file, if the app's copy differs)
| File | Change |
|---|---|
| `src/components/dashboard/MissedPrompts.jsx` | optional props: `statusColumn`, `onOpen`, `bulkExtra`, `rowFilter`, `onRowHover`, `promptStyle`, `bulkOnly` (the Overview passes none) |
| `src/components/dashboard/PromptTable.jsx` | `count={null}` hides the badge; `headerText`; `onRowHover`; `data-row-key` on rows; `bulkAt="bottom"` (bulk bar slides up from the table's bottom); the new Checkbox |
| `src/components/ui/Checkbox.jsx` (new) | animated table checkbox (fill scale, tick draws; indeterminate dash) |
| `src/components/ui/motion.jsx` (new) | `Seg` (sliding-pill toggle), `useCountUp`, `CrossFade`, `useWidth`, cut unchanged out of SentimentPage (Sentiment imports them now) |
| `src/utils/mixBars.js` (new, + test) | Sentiment's Mix column drawing, shared (Sentiment uses it too) |
| `src/utils/spring.js` (new, + test) | damped spring → CSS `linear()` easing for WAAPI |
| `src/components/ui/Modal.jsx`, `src/hooks/useOverlay.js` | the focus trap shared as `useDialogFocus` (Modal and the focus panel) |
| `src/components/audit/ActionMenu.jsx` | `side="top"` option (the Draft footer's More ▾ opens upward) |
| `src/components/dashboard/KpiCard.jsx` | optional `linkIcon`, `selected` (unused by v1 now; harmless) |
| `src/pages/insights/SentimentPage.jsx` | imports only (motion.jsx, mixBars.js); renders exactly as before |
| `src/utils/brand.js`, `src/store/workspace.js` | `productNameOf` / `productName()` (white-label product name, never a hard-coded "Kraffic"); `domainForName` |
| `src/index.css` | the `.co-ws` blocks (light-only contrast values, workspace motion, focus veil + panel shadow, rail scrollbar, skeleton shimmer) and the global line tokens (`--color-line` #DEDCDA / #2A2A2A, `--color-line-strong` #CFCCC9 / #3D3D3D) |
| `DESIGN.md` | the Content workspace notes and exceptions (§3), the line tokens (§1) |

### Mock data (don't copy into the app's components; the app's adapter returns the same shapes)
- `src/data/contentRecommend.js` (+ test): sample `content-recommend` responses, one per missed prompt, in the route's
  exact shape. `src/data/contentRecommendRm.js`: the live reverse-mortgage response, renamed (fixture). In the app,
  these come from the route.
- `src/data/contentOpportunities.js`, `src/data/contentOpportunities-proposed.js`: list states and the behind-flag
  data (see §5).
- `src/data/answers.js`: mock-only fix so a missed prompt's answers list the row's competitors first (the header's
  "Named instead" agrees with the table). The app reads real answers; nothing to port.
- `src/data/mock.js`: the made-up publishers are real sites now (healthline, byrdie, allure, verywellhealth…) and two
  made-up brands became La Roche-Posay / Drunk Elephant, so every logo is a real favicon. Mock data only.

## 3. v1 elements and the response field each one reads
Response (`content-recommend`, 200): `ok, analyzedAt, brandDomain, brandName, prompt, coverage, ourFormats,
formats[], recommendations[], angles[], citedPages[], pageRecommendation, contentMarkdown, contentSource,
contentComplete, contentIssues[], expertReview, brandFactsAvailable, flags[], reviewScore`.
Request: `{ prompt, brandDomain, brandName, competitors, sources, targetUserId }`.

### Target page (step 1)
| Element | Field(s) | Rule |
|---|---|---|
| "Update" / "Create", the path, Open page ↗ | `pageRecommendation.action`, `.url` / `.suggestedPath`, `.reason` | R16 |
| "Missing n formats the winners use" | `recommendations[].status` (missing / partial) | R19 |
| "The draft adds" rows (name, n of 5 winners, score) | `recommendations[]` ∩ the draft plan | R21 |
| Google page-1 rank ladder (#1–#10, AI-only group, your page ringed or "Not on page 1") | `citedPages[].rank`, `.aiCited`, `.isOurs`, `.host`, `.title`, `.formats` | R18 |
| Engine icons on the ladder and "Cited by" | `citedPages[].engines` | R20 |
| Format matrix rows (5 winning pages) | `pageRecommendation.evidence[]` (matched to `citedPages` by URL for engines) | R19 |
| Matrix columns ("n of 5"), column score on hover | `formats[]` labels, `recommendations[].score` | R19 |
| "Your page" row | the recommended page in `citedPages` (`isOurs`), else `ourFormats`; for `create`, none | R19 |
| "After this draft" row (40% ticks for what the draft adds) | `ourFormats` + draft plan | R25, R28 |
| Draft preview (H1, direct answer, section chips, "n flags to check", Open draft →) | `contentMarkdown`, `flags[]` + browser ticks | R27, R8 |

### Draft (step 2)
| Element | Field(s) | Rule |
|---|---|---|
| Writing state: "Adding FAQ, How-to guide…", the skeleton headings, "Written to beat" | `recommendations[]` (draft plan); request `competitors` | R21, R12 |
| Writing status line | none (the app's two client messages, switching at 4.5s, plus a client-side timer) | — |
| Draft body (H1 28/600, sections, lists, comparison grid, FAQ all open) | `contentMarkdown` | R1, R4 |
| Hidden from the rendered draft: Page recommendation, Flags, Publishing notes, the "Draft for client review" notice | `contentMarkdown` | R2 |
| "Template draft: AI writing was unavailable" | `contentSource === 'template'` | R15 |
| Issues line under the H1 (only issues that aren't already flags) | `contentComplete`, `contentIssues[]` vs `flags[].text` | R15 |
| "Needs expert review" (muted text + red dot by the H1) | `expertReview` | R15 |
| "Add your brand facts in Brand Setup…" + link | `brandFactsAvailable === false` | R15 |
| "Confirm with your team" (dotted amber underline + hover note) | `contentMarkdown` text | R5 |
| Competitor names in the text (red underline + hover note) | `contentMarkdown` text + request `competitors` (names from competitor settings) | R6 |
| Sources rows (label · domain · note; competitor rows tagged "left out of Copy") | `## Sources` in `contentMarkdown` | R7 |
| Sticky section outline | parsed sections | R23 |
| Rail: Before you publish (checklist: label, note, "n pts", red dot on the top flag) | `flags[].label`, `.text`, `.score` | R8 |
| Rail: readiness ring "0/4" (weighted), points + coverage only in the ⓘ | `reviewScore` (done / total), `coverage` | R9 |
| Rail: "Show in draft" on Draft gap flags | `flags[].text` (the host it names) | R24 |
| Rail: What this draft adds (+ rows, logos, "n pts") and the before/after strip | `recommendations[]`, `formats[].usages[]`, `ourFormats` | R10, R25 |
| Rail: Who you're up against (logo, name, #rank, engines; 5 then +n) and its 1–10 rank strip | request `competitors` + `citedPages[]` (not `isOurs`), merged by host | R22, R26, R20 |
| Footer: Copy content, More ▾ (Copy as HTML, Export .md), "Saved in this browser · <time>", Regenerate | `contentMarkdown`; saved time from localStorage | R3, R17 |
| Re-check score (in the readiness section) | browser only: recomputes `reviewScore` from the ticks, as the app's `recheckScore` does | R9 |

### Copy & publish (step 3)
What each action carries (R3), the unticked flags, Back to the draft. The ticks are browser-only (`fixedFlagIds` in
localStorage, key `auden:content-brief:v1:<domain>:<prompt>`), as the app does today.

### Payoff bar
Reward headline and sub-line per step (Target: "Update this page to get named on n more engines"; Draft: "Resolve n
flags, then copy it to your site" / "0 of 2 flags checked · saved in this browser"); named engines in colour + "Named
on n of 4" (the row's named engines = the 4 engines minus the row's missed `platforms`).

## 4. Derivations (`src/pages/opportunities/draft/recommend.js`, all tested in `recommend.test.js`)
One module, each rule commented in the code:
- **Section parsing (R1, R23, R27):** `contentMarkdown` is one string; sections are its `##` headings, the H1 is the
  prompt. Short names for the outline (Direct answer · Key points · Steps · Compare · Explanation · FAQ · Sources).
- **What's publishable (R2, R3):** Copy content / Copy as HTML = only the publishable sections: no Page
  recommendation, Flags, Publishing notes, notice, competitor-domain Sources rows, or the "recommended new page" bullet.
  Copy content keeps the comparison's original text. Export .md = the raw `contentMarkdown` (everything).
- **Comparison (R4):** `**Option**` + `- Label: value` bullets → one group; same labels across options → a grid
  (labels as rows, options as columns), else short side-by-side lists.
- **"Confirm with your team" (R5):** matched by the phrase in a line; the phrase itself is marked.
- **Competitor names (R6):** matched against the request's competitors by display name (from competitor settings,
  never built from the domain) and host.
- **Sources (R7):** each bullet "Label: https://url (note)" → label · domain · note.
- **Flags and readiness (R8, R9):** sorted by score; done = sum of ticked scores, total = sum of scores (the app's
  `applyRecommendations`).
- **Formats (R10, R19, R21, R25, R28):** format gaps from `recommendations[]` with usages from `formats[]`; the matrix;
  the draft plan (FAQ always + up to 2 missing/partial formats, as the route drafts); before/after = `ourFormats` ∪
  plan.
- **Engines (R20):** `'google'` = organic rank only (no icon); `'aio'` = Google AI Overview; `'ai'` = resolved from the
  prompt's answers (which engines cite that host), else one neutral "AI" icon, "engine not specified".
- **Up against (R22, R26):** request competitors + non-own `citedPages`, merged by host, rank ascending, AI-only after.

## 5. Behind `?backend=full` (do NOT port now)
Search Console step and the Search Console target page (`ConnectStep.jsx`, `TargetStep.jsx`, `SearchConsolePanel.jsx`),
Your data (`DataStep.jsx`), Publish & track (`PublishStep.jsx`, `publish/*`), the live 5-step writing view
(`draft/Generating.jsx`), "Who you're up against" on the page (`UpAgainst.jsx`), and their data in
`contentOpportunities-proposed.js`. None of these exist in the backend (audit §5–8). The list's states (Draft ready /
Waiting / Monitoring / Improved) are proposed data too: in the app, v1 can show only "Create content" and "Draft ready"
(a brief saved in localStorage).

## 6. Safe Markdown rendering (`src/pages/opportunities/draft/markdown.js`)
The draft is model output that includes text scraped from third-party pages, so:
- The parser builds a **text-only tree**, rendered as React text nodes (never `dangerouslySetInnerHTML`). Raw HTML in
  the Markdown (`<script>`, `<img onerror>`, `<a href="javascript:…">`) shows as literal text.
- **Links only for http/https.** `safeHref(url)` trims, parses with `new URL`, and returns the URL only for `http:` /
  `https:`; anything else (`javascript:`, `JAVASCRIPT:`, `" javascript:"`, `data:`, `vbscript:`, `mailto:`, relative)
  renders as plain text. Links open in a new tab with `rel="noopener noreferrer"`.
- **Copy as HTML** (`toHtml`) is built from the same tree with `escapeHtml` on every text node and attribute; never from
  the raw string. **Copy content** (`toMarkdown`) re-serializes the tree and escapes `<` and `>`.
- Tests:
  - `draft/markdown.test.js`: "safeHref: only http(s), after trimming; everything else is not a link"; "hostile Markdown: no script/img/on* in the HTML, non-http(s) links are text, https links keep their rel"; "parseMarkdown: the draft lib's structure".
  - `draft/recommend.test.js`: "R3 on the hostile sample: Copy as HTML / Copy content carry no script, img, on* or javascript:"; "R1–R3: hidden sections and the notice stay out of the rendered draft and Copy; Export keeps everything".
  - `draft/model.test.js` (behind-flag draft): "toHtml (security): hostile strings in every field, example.series included, never become HTML or script links".
  - Mock preview: `?co=hostile` serves a hostile draft (no dialog fires; no script/img/on*/javascript: in the DOM).

## 7. Things to raise with Harsh (found while matching the live output)
- The draft lib's own "Draft for client review — verify fees…" notice matches the fees and reviews flag rules, so every
  draft gets those two flags.
- The lib's prompt tells Claude to use the missed prompt itself as the first FAQ question, and the live run wrote
  "Confirm with your team: which…" in lowercase. Both will keep appearing unless the prompt changes.
- The route returns the Target data and the draft in ONE response, so in the real app the Target step and the writing
  state's "Adding …" line can't show before the draft is done. Options: run the route when the prompt opens (Target
  loads, then the finished draft), or split it into recommend → draft.
- Security (audit): the Claude CLI runs on the server with `--dangerously-skip-permissions` on scraped text; no plan
  gate on a paid route.

## 8. Screenshots to compare against (`screenshots/content-opportunities/`)
| Area | Files |
|---|---|
| List | `r5-0*-1440-{light,dark}.png` (cards, table, row hover), `r9-01-cards-{1440,1280}-*` (final filter cards) |
| Target page (step 1) | `v1-target-polish-{1440,1280}-{light,dark}.png`, `v1-target-polish-hover-{row,col}-1440-light.png`, `v1-target-contrast-1440-{light,dark}.png`, `v1-target-r3-1440-{light,dark}-{nodraft,draft}.png` (latest left column), clip `v1-target-clip-{light,dark}.webm` |
| Writing state | `v1-writing2-1440-{light,dark}.png`, `v1-writing2-arrive-1440-light.png` |
| Draft (step 2) | `v1-draft-r3-1440-{light,dark}-{top,faq-sources,rail}.png` (latest draft), `v1-draft-r4-rail-1440-{light,dark}-{1,2}.png` (latest rail), `v1-draft-r4-rank-hover-1440-light.png`, `v1-draft-r2-show-1440-light.png` (Show in draft) |
| Template fallback | `v1-template-1440-{light,dark}.png` |
| Copy & publish (step 3) | `v1-copy-1440-{light,dark}.png` |
| Reverse-mortgage sample (live content) | `v1-rm-1440-{light,dark}-*.png` |
| Hostile sample | `v1-hostile-1440-light.png` |
| Focus panel centring | `focus-centred-{1440,1920}-light.png` |

Only these final shots are committed; the earlier rounds' screenshots weren't kept in the repo.

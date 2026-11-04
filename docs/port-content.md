# Port: Opportunities → Content (mock → app)

For the app session. Source: branch `design/content-opportunities` (see the commit hash in the release note). The mock
session never edits the app; this doc says what to copy, what to wire, and what to leave out.

**Port v1 only.** v1 is everything built on what Harsh's `POST /api/missed-prompts/content-recommend` returns today
(branch `fix/demo-qa-stability`, audited in the app's `docs/content-data-audit.md`), plus **Your data** (step 2,
§3a): read in the browser and sent with the draft request as a new optional `userFacts` field, which **needs a backend
change by Harsh** before it does anything in the app. Everything else is behind `?backend=full` in the mock and stays
out of the app until its backend exists.

v1 steps: **Target page → Your data → Draft → Copy & publish** (4 pills; `workspace/flow.js` `stepsFor(false)`).

Not in this port: the sidebar density / 232px width / Beta pill restyle / brand-card text, and the brand-menu portal
fix. Those are separate (develop a5b2318 for the menu; the sidebar is on its own branch).

## 0. Port log (mock develop → app, oldest first)
After each commit on develop that changes the design, the mock session adds a line here and messages the app session
with the hash and a one-line summary. Port in this order. "Waiting" = the owner hasn't approved the screenshots yet:
don't port it until the line says approved.

| Hash | What to port | Status |
|---|---|---|
| aa5622b | Opportunities → Content (list + workspace, v1) | Approved · ported |
| 1b79186 | Sidebar nav density | Approved · ported |
| a4f95de | No-result state for engine scores | Approved · ported |
| 5d2e847 | No-result follow-ups (prompt tables, Growth gap, failed scan "—") | Approved · ported |
| 6a13be7 | Target page: format matrix left (8/12), Update column right (4/12) | Approved · in progress (app feat/content-page) |
| c5a40a4 | Your data in v1 (§3a, §5a, §10) | Approved · queued |
| 07c6b1f | A written draft reopens after a reload; list shows "Draft ready" (§9) | Owner-requested fix · queued |
| c731327 | Prompt mix table: the no-result line + ⓘ, no brand tabs, no "won n new prompts" notice | Approved · ported (app develop 0a5c8f2) |
| 396d783 | Google split into two engines, Google AI Overview (`aio` / prompt data `google`) and Google AI Mode (`aimode`), everywhere engines appear (Overview, Prompt Hub, drawers, Tracking/Sync, Sentiment, Insights, Reports, Content); new icons (G + square ≡ badge / round ✦ badge); see §11 | Approved · port it, minus its Sentiment parts (see 2355b11) |
| 27a649c | Sentiment: the dot plot becomes a 2×2 tone grid (Neutral · Positive / Negative · Mixed), "+n more" past two rows, engine badges when split; `SentimentPage.jsx` Spectrum + `utils/spectrum.js` quadrantPack | Approved with fixes · port with 2355b11 |
| 2355b11 | Sentiment keeps one Google engine (the split comes off Sentiment); tone grid: no fill on Positive; 1280 fixes: Visibility history chips (third 'xs' step), Content list KPI label (arrow overlays, icon tile hides in a narrow card) | Owner fixes · port it |
| c9d33cc | Your data: no draft yet → the five first-visit questions (credentials, locations, fees, reviews, contact, by flag score); a draft's flags replace them; first-visit subline (`userFacts.js` FIRST_VISIT, `questionsFor(…, { drafted })`, `DataStep` `drafted`) | Owner rule (relayed by the app) · mirrors the app |
| 46ce1f0 | Your data privacy note: "Your files aren’t stored. The draft you save, including any facts it uses, is kept for your team." (`DataStep.jsx`) | Owner wording (relayed by the app) |
| f63c186 | Search Console: "Search Console for this prompt" on the v1 Target page (best query → publish on → Update this page, other top queries, Your pages, 4 states) and the Content list's Best page column (§12) | Approved with fixes · port with the fixes commit |
| 896422f | Search Console owner fixes: `site` tag (half score, never Best), Google page 1 ladder with no gaps (sample citedPages lists every page-1 result), Your pages without "Not cited" | Owner fixes · port with the Search Console commit |
| 5a4e1b0 | AI Mode split marker (`?aimode=new`: "Scoring updated <day>" on the score card + Visibility history, AI Overview / All engines only) and accounts without AI Mode (`?aimode=off`: hidden) | Owner rules (mirrors the app) |
| 655650b | Visibility history insight: no rise / fall across a scoring marker between the last two points (the AI Mode split included; `VisibilityHistory.jsx` insight `crossed`) | Matches the app |
| d98233f | Visibility history markers: "Scoring updated" / "Setup changed" labels stack by their real spans (18px apart), never overlap; `ScoringMarker` `avoidLabel`; getHistory `setup` (`?setup=1` preview) | Owner fix |
| 208bd43 | Overview: "Cited pages by folder" replaces Top cited pages (donut + legend, hover, History since / one-sync states) and its drawer (FolderDrawer: engine chips, Citations · Cited pages · Folders, 5 folder lines, pages grouped by folder, weekly list, Export CSV); `utils/citedFolders.js` grouping; `utils/brand.js` displayName for competitor names in the Mentions and citations drawer. Needs per-citation URL rows (prompt × engine × raw URL) from the app | Approved · ported by the app |
| 8d2d9d2 | Cited pages by folder: the donut centre shows only the % (no name, count or mini trend, at rest or on hover); `CitedFolders.jsx` | Owner fix · port with 208bd43 |
| 9416ecd | Sentiment grid: dots scattered organically per quadrant (`utils/spectrum.js` quadrantScatter, seeded by page URL; 10px apart, 24px clear of edges / cross / labels; drift-in entrance); grid min 248px | Approved · port it (with the scatter tweak) |
| 424d55b | Content: Search Console access (Connect step before the ladder, connecting spinner, "Connected · <domain> · Change" chip, skipped row, list banner), ONE target page everywhere (Workspace `page`: pick ?? Publish on ?? the route's page → Update column, payoff bar, Copy & publish, targetUrl), best query follows the prompt's intent (replaced by the owner's rule: see the next commit) | Approved · being ported |
| e1090a8 | Search Console intent: the owner's rule (intent words vs topic words, synonyms, intentMatch sort, no Best without an intent match; mirrors the app's 4385c8e); topic-only create wording; Update column reason only for the route's own page | Approved · being ported |
| d8d6a96 | Search Console: the owner's refined Best rule (≥ half the intent words, min 1; rank by intent words then impressions; OPPOSITES disqualify), publish-on semantics (strong eligible only; lowVolume update; else create), shared case `src/data/gscMatchCases.js`, preview `?co=gsc-lowvolume` | Owner rule · in step with the app |
| de2f86d | Sentiment scatter tweak: 24px clear of the cross's two lines and the edges (dot edge + badge, from a line's far side; badge inside the dot's corner; `EDGE = 25`) | Owner tweak · port with 9416ecd |

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
| `src/pages/opportunities/workspace/DataStep.jsx` | step 2 "Your data" (v1 with `v1` prop): Upload documents · Add key facts · Answer what you can; real in-browser reading, the 20k-cap line |
| `src/pages/opportunities/data/extract.js` (+ test) | reads PDF / DOCX / CSV / TXT in the browser; the limits; "~1,200 words" |
| `src/pages/opportunities/data/userFacts.js` (+ test) | the ONE `userFacts` payload + the 20k cap, the questions from the flags, the localStorage shape |
| `src/pages/opportunities/workspace/FocusPanel.jsx` | the centred dialog (Your data, Draft and Copy & publish happen inside it) |
| `src/pages/opportunities/workspace/PanelHeader.jsx` | the panel's sticky header |
| `src/pages/opportunities/workspace/CopyPublish.jsx` | step 3 "Copy & publish" (v1) |
| `src/pages/opportunities/workspace/flow.js` (+ test) | which steps exist (v1: 4; full: 5), focus-mode state, `backLabel` ("Back to step n" counted among the visible steps) |
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
Request: `{ prompt, brandDomain, brandName, competitors, sources, targetUserId }`, plus the PROPOSED optional
`userFacts` (§3a), sent only when Your data has something in it (`requestFor(row, userFacts)` in the mock).

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

### 3a. Your data (step 2, v1; optional, Skip always there)
Opens in the focus panel (880px) from the Target bar's **Add your data** (or **Skip to draft**). The round-4 design:
three numbered blocks, all optional. Under the intro, once for the step (not under each block, where it would repeat
three times): **"Your files aren’t stored. The draft you save, including any facts it uses, is kept for your team."**.
- **① Upload documents.** PDF, DOCX, CSV, TXT; up to 10 MB each, 5 files (checked by extension AND MIME type; an
  unknown or `octet-stream` MIME is accepted on the extension). Read **in the browser**: nothing is uploaded or stored
  on a server. Each row: icon · name · size · `Read · ~1,200 words` (exact under 100, then to the nearest 10 / 100 /
  1,000), or `Couldn't read this file` in red (reason on hover: no text found, e.g. a scanned PDF; password-protected;
  damaged). A file that can't be added says why in red until removed: `Not a PDF, DOCX, CSV or TXT`, `Over 10 MB`,
  `Only 5 files at a time`. "Paste text" stays (it goes in as a document called "Pasted text"). No "Suggested from your
  files" in v1 (nothing finds facts in the text; the draft reads it).
- **② Add key facts.** Label · value rows the user types (label ≤ 80, value ≤ 400 characters). In v1 the value takes the
  source column (every fact is the user's).
- **③ Answer what you can.** One question per flag in THIS prompt's response that an answer can clear, by score (as in
  the rail). Each answer is sent with the flag's id, so it lines up with the Draft's flags. Mapping (rule id → question):
  `locations` (Missing brand info, 6) → "Clinic or office locations" · `credentials` (Missing brand info, 8) →
  "Registration or named experts" · `contact` (Missing brand info, 4) → "Public phone or contact page" · `fees` (Needs
  verification, 5) → "How you quote prices" · `reviews` (Needs verification, 5) → "Approved stats or reviews" ·
  `trademark` (Needs verification, 3) → "Trademark wording". Not asked: Expert review (a qualified reviewer must read
  the draft) and Draft gaps (fixed by rewriting). `userFacts.js` `QUESTION_FOR` / `questionsFor`.

**Extraction (`data/extract.js`), per type:**
- TXT, CSV: `File.text()`, tidied (BOM, CRLF, blank-line runs).
- DOCX: no dependency. A minimal zip central-directory reader finds `word/document.xml`, the browser's
  `DecompressionStream('deflate-raw')` inflates it (stored entries too), and the text is the `<w:t>` runs, a line per
  `<w:p>` (`<w:tab/>` → tab, `<w:br/>` → line break), XML entities decoded. Encrypted / zip64 / other compression →
  can't read.
- PDF: **new dependency `pdfjs-dist` (^4.10.38)**, the app needs it too. Loaded only when a PDF is read (dynamic
  `import('pdfjs-dist')`; the worker from `pdfjs-dist/build/pdf.worker.min.mjs?url`, Vite syntax: in Next.js set
  `GlobalWorkerOptions.workerSrc` to the worker file you serve, e.g. copied to `/public`). 4.x, not 5/6: 4.10 supports
  Node 20 (the app's `engines`) and Next 14; 5.x+ want Node ≥ 22. Mock build: `pdf-*.js` 365 kB (107 kB gzip) as its
  own chunk (not in the main bundle), worker 1.4 MB. `isEvalSupported: false`. Text from `getTextContent()` per page.

**The ONE payload (`data/userFacts.js` `buildUserFacts`):**
```
userFacts: { facts: [{ label, value }], answers: [{ flagId, answer }], documentsText }
```
- Order: facts, then answers, then the documents in upload order (pasted text last), each as `## <file name>\n<text>`,
  a blank line between.
- **Cap: 20,000 characters** over fact labels + values, answers and `documentsText` (headings included; keys not
  counted). Facts and answers are never cut. Over the cap, `documentsText` is cut inside the document where the budget
  runs out (at the last space), later documents are left out. The UI then shows, under the files: **"Too long, the first
  20k characters will be used."** + "`<file>` is cut after ~n of m words." + "`<file>` isn't used." (`OverCap`).
- Empty (nothing filled; reading / failed / rejected files carry nothing) → the request has no `userFacts` field.
- Taken when the writing starts and on each Regenerate. Changing Your data after a draft exists turns its button into
  **Rewrite the draft** (a Regenerate with the new payload); a file still being read holds the button ("Still reading
  your files…").

**Backend change needed (Harsh):** `content-recommend` takes no user input today (audit §6). It needs a new optional
`userFacts` request field (shape above, validated: arrays, strings, the 20k cap enforced server-side too) passed into
the draft prompt, and used by `buildReviewFlags`: a rule isn't raised when the user answered it (`answers[].flagId`) or
gave a fact labelled for it (the mock's rule: `contentRecommend.js` `resolvedBy`). Until then the app should not send it
(or the route ignores it) and the step is UI only.
**Security:** the document text is user-supplied and goes into the model prompt: treat it as untrusted text, exactly
like the scraped pages (delimit it, tell the model it's data not instructions, never let it change the output format or
tools; the CLI's `--dangerously-skip-permissions` makes this matter more). The draft output stays rendered by the safe
Markdown parser (§6).

**Persistence:** per brand + prompt in localStorage, key `auden:content-data:v1:<domain>:<prompt>` (next to the
draft's `auden:content-brief:v1:…`): `{ facts, answers, pasted, documents: [{ name, kind, bytes, words, text }] }`. The
extracted text, never the File objects; each document's text capped at 20,001 characters (nothing past 20k is ever
sent; the +1 keeps "it was cut" true). Failed and rejected rows aren't kept. Empty → the key is removed.
**Sign-out:** the mock has no sign-out control. The app's sign-out already clears it: `lib/clear-browser-data.js`
(`clearBrowserData`, app commit d94f7e9, on origin/main) removes every localStorage key except the theme, so both
`auden:content-data:*` and the draft's `auden:content-brief:*` go. Nothing to add.

**Mock fixture:** prompt 0, "best azelaic acid cream for rosacea" (`contentRecommend.js` variant `clinic`: the brand
has a clinic but no address on its site). Without userFacts its draft asks "Confirm with your team: Which clinic
location offers in-person skin checks." and carries the **locations** flag (Missing brand info, 6). With a location in
userFacts (the `locations` answer, or a fact labelled location / address / office / clinic) the Direct answer ends
"…book a skin check at our clinic at 14 King Street, Manchester." and Key points say "See us in person: our clinic at
…"; the locations flag is gone (3 flags → 2). Preview: `/opportunities/content/0?co=data-sample` preloads the
fixture's Your data (2 facts, the locations answer, one read TXT); Write the draft shows the effect.

| Element | Field(s) | Rule |
|---|---|---|
| Questions | `flags[].id` of the response WITHOUT userFacts (they stay put once answered) | `questionsFor` |
| Bar headline "Add your data so the draft can beat <host>" | `pageRecommendation.evidence[]`, best rank | — |
| Bar sub-line "2 files · 1 fact · 1 of 3 answered" | browser only | `userDataSummary` |

### Draft (step 3)
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

### Copy & publish (step 4)
What each action carries (R3), the unticked flags, Back to the draft. The ticks are browser-only (`fixedFlagIds` in
localStorage, key `auden:content-brief:v1:<domain>:<prompt>`), as the app does today.

### Payoff bar
Reward headline and sub-line per step (Target: "Update this page to get named on n more engines", button **Add your
data**, link **Skip to draft**; Your data: "Add your data so the draft can beat <host>" / "2 files · 1 fact · 1 of 3
answered" or "Optional · nothing added yet", button **Write the draft** (**Continue** once a draft exists, **Rewrite the
draft** when the data changed since), link **Skip**; on the page while the panel is closed: "Adding your data" +
Resume; Draft: "Resolve n
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
- **Google's two engines (PROPOSED backend value):** Google is split into Google AI Overview and Google AI Mode. In
  `citedPages[].engines` the mock adds a new tag **`'aimode'`** = Google AI Mode cites the page (its own icon, after
  AI Overview). Harsh's route doesn't return it today; until it does, nothing shows AI Mode on the Target ladder and
  "Cited by" (no change for the app). Prompt rows (`row.platforms`) use `'google'` = AI Overview and `'aimode'` = AI
  Mode. Labels: "Google AI Overview" / "Google AI Mode" in tooltips, "AI Overview" / "AI Mode" in sentences and chips
  (`ENGINE_SHORT` in data/contentOpportunities.js); a bare "Google" only means the organic rank ("#3 on Google").
  An engine with no result in the latest scan (the Overview's no-result state, `hasResult`) counts as neither missed
  nor named: the header reads "Missed on n of 4" with that engine's ⓘ ("No result from Google AI Mode in the latest
  scan"), and the payoff bar's "Named on n of 4" leaves it out (Workspace.jsx `answeredEngines`).
- **Up against (R22, R26):** request competitors + non-own `citedPages`, merged by host, rank ascending, AI-only after.

## 5. Behind `?backend=full` (do NOT port now)
Search Console step and the Search Console target page (`ConnectStep.jsx`, `TargetStep.jsx`, `SearchConsolePanel.jsx`),
Publish & track (`PublishStep.jsx`, `publish/*`), the live 5-step writing view
(`draft/Generating.jsx`), "Who you're up against" on the page (`UpAgainst.jsx`), and their data in
`contentOpportunities-proposed.js`. Behind the flag, Your data keeps the proposal's simulated reading and "Suggested
from your files" (server-side fact finding, `factsFound`); v1's in-browser reading is §3a. None of these exist in the backend (audit §5–8). The list's states (Draft ready /
Waiting / Monitoring / Improved) are proposed data too: in the app, v1 can show only "Create content" and "Draft ready"
(a brief saved in localStorage).

## 5a. Your data tests
- `data/extract.test.js`: limits (type by extension AND MIME, 10 MB, 5 files); word count and "~1,200 words"; TXT / CSV;
  empty file; DOCX (`<w:t>` runs, paragraphs, tabs, breaks, entities; a stored zip; a deflated one when Node has
  `deflate-raw`, else the browser test covers it); the zip reader's failures.
- `data/userFacts.test.js`: empty → empty payload and no `userFacts` in the request; the shape; the 20k cap (the cut
  file, kept / total words, later files left out, facts and answers never cut, exactly-at-cap, facts alone over); the
  questions from the flags; the localStorage shape and key; the summary line; the fixture (prompt 0's draft names the
  location, the locations flag goes; a fact alone or an answer alone does it; empty userFacts = today's response);
  answers clear flags on every prompt, Expert review never.
- `workspace/flow.test.js`: v1's 4 steps, `nextVisible`, `stepPos`, Your data in focus; full keeps 5;
  "Back to step n" counts the visible steps.
- `tests/your-data.browser.test.mjs` (real Chromium): makes a TXT, a deflated DOCX, a text PDF (pdf.js), a PDF with no
  text and a PNG (`tests/makeFiles.mjs`), uploads them with `setInputFiles`, checks every row ("Read · ~1,200 words",
  "~310", "~11", "Couldn't read this file", "Not a PDF, DOCX, CSV or TXT"), types a fact, adds a 6,000-word TXT and sees
  "Too long, the first 20k characters will be used. handbook.txt is cut after…", checks the localStorage entry (text and
  metadata, no files) and that it survives a reload; then `?co=data-sample` → Write the draft → the draft names the
  clinic location and "Confirm office locations" is gone. A second test: `?backend=full` still has 5 steps and the
  proposal's Your data.

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
- Your data (§3a): a new optional `userFacts` request field into the draft prompt, answered flags not raised; the
  document text is untrusted user input in the model prompt.
- Security (audit): the Claude CLI runs on the server with `--dangerously-skip-permissions` on scraped text; no plan
  gate on a paid route.

## 8. Screenshots to compare against (`screenshots/content-opportunities/`)
| Area | Files |
|---|---|
| List | `r5-0*-1440-{light,dark}.png` (cards, table, row hover), `r9-01-cards-{1440,1280}-*` (final filter cards) |
| Target page (step 1) | `v1-target-polish-{1440,1280}-{light,dark}.png`, `v1-target-polish-hover-{row,col}-1440-light.png`, `v1-target-contrast-1440-{light,dark}.png`, `v1-target-r3-1440-{light,dark}-{nodraft,draft}.png` (latest left column), clip `v1-target-clip-{light,dark}.webm` |
| Writing state | `v1-writing2-1440-{light,dark}.png`, `v1-writing2-arrive-1440-light.png` |
| Your data (step 2) | `v1-data-empty-1440-{light,dark}.png`, `v1-data-files-1440-{light,dark}.png` (4 files read in the browser, one "Couldn't read this file", a fact, an answer), `v1-data-over-1440-{light,dark}.png` (the 20k message naming the cut file), `v1-data-sample-1440-{light,dark}.png` (`?co=data-sample`) |
| Draft using userFacts | `v1-data-draft-1440-{light,dark}.png` (prompt 0: "…book a skin check at our clinic at 14 King Street, Manchester", 2 flags, the locations flag gone) |
| Draft (step 3) | `v1-draft-r3-1440-{light,dark}-{top,faq-sources,rail}.png` (latest draft), `v1-draft-r4-rail-1440-{light,dark}-{1,2}.png` (latest rail), `v1-draft-r4-rank-hover-1440-light.png`, `v1-draft-r2-show-1440-light.png` (Show in draft) |
| Template fallback | `v1-template-1440-{light,dark}.png` |
| Copy & publish (step 4) | `v1-copy-1440-{light,dark}.png` |
| Reverse-mortgage sample (live content) | `v1-rm-1440-{light,dark}-*.png` |
| Hostile sample | `v1-hostile-1440-light.png` |
| Focus panel centring | `focus-centred-{1440,1920}-light.png` |

Only these final shots are committed; the earlier rounds' screenshots weren't kept in the repo.

## 9. Saved draft after a reload (fix, 2026-11-04)
The brief saved in this browser (`auden:content-brief:v1:<domain>:<prompt>`) now also keeps `written: true` once a
draft exists and `sent` (the userFacts it was written with). Reopening the prompt after a reload opens on the Draft
step with that draft (no writing state); the list shows such a prompt as "Draft ready" and opening it lands on the
draft (the app's "Draft ready can't be opened" bug). In the app, keep the route's response in the saved brief (as the
app's brief already does) rather than re-requesting it. Test: `tests/saved-draft.browser.test.mjs` (fails without the
fix: after the reload the draft isn't there).

## 10. pdfjs-dist (owner-approved conditions)
Pinned to the exact version `4.10.38` (no caret). Loaded only when a PDF is added (dynamic `import('pdfjs-dist')`),
client-side only, never on the server. Its worker is a file from our own build (Vite `?url`; in Next, copy
`pdfjs-dist/build/pdf.worker.min.mjs` into the build / `public` and point `GlobalWorkerOptions.workerSrc` at it), never
a CDN. Documents open with `isEvalSupported: false`. `npm audit` (mock, 2026-11-04): nothing for pdfjs-dist; 4.10.38 is
past the fix for CVE-2024-4367 (fixed in 4.2.67).

## 11. Google split: AI Overview + AI Mode (2026-11-04)
Five engines: Google AI Overview, Google AI Mode, Gemini, ChatGPT, Claude (Grok stays as it was).
- **Ids:** dashboard `aio` (unchanged) and new `aimode`; prompt data `google` (unchanged, = AI Overview) and new `aimode`
  (`brandViews.js` PLATFORM_ID / ENGINE_ORDER, `mock.js` PID_ORDER). Display order: AI Overview, AI Mode, Gemini,
  ChatGPT, Claude, Grok. The app's data needs an `aimode` engine wherever it returns per-engine rows (the backend
  question for Harsh: does the scan store AI Mode as its own engine today? It used to be a +1 call on the Google scan).
- **Names:** full "Google AI Overview" / "Google AI Mode" in menus and drawer titles (`engineFullName`); short
  "AI Overview" / "AI Mode" in tabs, chips and sentences. A bare "Google" only means the organic Google rank.
- **Icons:** `icons.jsx` `GoogleEngineIcon` (via `PlatformIcon id="aio" | "aimode"`): the Google G with an ink badge
  bottom-right: AI Overview = rounded square with two lines, AI Mode = circle with a sparkle; readable at 14–16px.
- **No data:** the existing no-result state (`?noresult=aimode` previews it); Reports keep their "didn't run" row.
- **Content:** proposed backend value `citedPages[].engines` `'aimode'` (§3 / recommend.js R20).
- **Sync:** AI Mode is its own engine (1 call per prompt); sync-mode descriptions name both Google engines (wording
  changed from the app's).

## 12. Search Console match (v1, 2026-11-04)
The app's `GET …/gsc-match` (lib/gsc-match.js `analyzePrompt` + the route's states) and `bestPageFor`, mirrored in
`src/data/gscMatch.js` (sample data only: the skincare list is derived from the mock's own sample queries; rm-1 uses
the app's invented-lender sample renamed to the made-up harborlinehome.com; never client Search Console data). Units
as the app's: match / adjusted / score 0–100 integers, share 0–1, position a float, intent 'account' | 'local' | null
(×0.5), best = highest adjusted × log10(impr + 1) with ≥ 10 impressions, create when the best adjusted < 30.

**Target page** (`workspace/SearchMatch.jsx`, rendered by `TargetV1` between the ladder and the matrix / Update grid;
same header style; meta "Last 8 weeks · {range.startDate} – {range.endDate}" + ⓘ `lagNote` + "Totals run slightly
low: Google hides rare queries."):
| Element | Reads |
|---|---|
| Best query (or "Closest query" when creating) · "60% match · 1,220 impressions · position 19.5" | `bestQuery.query / adjusted / impressions / position` |
| Publish on · path · "Gets 80% of that query’s impressions · 3 of the top queries land here" | `publishOn.path`, `publishOn.share`, count of `queries[].topPage.path === publishOn.path` (shown when ≥ 2; `reason: 'several-queries'`) |
| "Few searches so far…" | `publishOn.lowVolume` |
| Create a new page · suggested path · "No query matches this prompt well enough yet (best 22%)" | `publishOn.action === 'create'`, `suggestedPath`, `bestQuery.adjusted` (no bestQuery → "None of your pages gets impressions…") |
| Update this page / Create this page → "Using this page" | sets the workspace's `scPick` (below) |
| Other top queries: query (account / local: muted + tag, ⓘ "Scored at half…"), Match, Impr., Clicks, Pos., Page | `queries[]` without `best`, first 4: `adjusted`, `match`, `intent`, `impressions`, `clicks`, `position`, `topPage.path` |
| Your pages: path · "Best match" (only the publishOn page) · Match {score}% + ⓘ its matching queries · engines that cite it (else the "AI" mark when `cited`; nothing when not cited, owner 2026-11-04) · impressions bar + number | `pages[]` (by score, first 5): `path`, `score`, `cited`, `impressions`; engines from content-recommend `citedPages` with that path |

**States** (`?co=` previews): `gsc-new` → "Connect Search Console to rank your pages by real search traffic." + Connect
(`{ connected: false }`); `gsc-reconnect` → "Search Console needs reconnecting…" + Reconnect (`reason: 'reconnect'`);
`gsc-nodomain` → "Search Console has no property for {domain}…" (`reason: 'no-domain'`); `gsc-nodata` → "Connected. No
search data for this prompt’s queries yet." + the suggested new page (connected, `queries: []`). The ladder and the
matrix render in every state. In the mock, Connect / Reconnect flips to connected after 900ms.

**ONE target page (owner, 2026-11-04; the earlier `scPick`-only override is replaced):** Workspace derives `page` once:
the user's pick (`scPick`: a Your pages row, or Create this page in the no-data state) ?? Search Console's Publish on
(connected, with data: `publishOn` update path / create suggestedPath) ?? content-recommend's `pageRecommendation`
(not connected, skipped, no data). `page.source` = 'pick' | 'sc' | 'route'. That one value is the Update column (with
"From Search Console", or "Your pick · Use the suggested page" back to Search Console's), the payoff bar line, the
matrix's "Your page", Copy & publish's "Paste it into…" (`CopyPublish` now takes `page`; it used to re-derive the
route's page, which was the bug) and the draft request's `targetUrl` + `targetAction` (sent whenever the page isn't the
route's own; content-recommend takes them since the app's 22b3a36). In the chain, Publish on reads "Using this page"
while it's the target; after a Your pages pick its button says "Update this page" and takes it back. Your pages is one
radio group (`role="radio"`, the selected row tinted with an ink ring); picking Search Console's own page = no pick.

**Ask for access (owner, 2026-11-04):** the brand's connection is shared by the list and every prompt
(`gscMatch.js` `brandScState` / `setBrandScState`: 'connected' | 'new' never asked | 'skipped' | the route states;
in memory per brand for the visit in the mock, so the `?co=` previews always open in their state; the app keeps the
real connection server-side). Never connected (`?co=gsc-new`): the Target page opens with the Connect step FIRST, above
the Google page-1 ladder (`SearchMatch.jsx` `ConnectSearchConsole`): the plain Google G, "Connect Google Search
Console", "Read-only. We use it to find which of your pages already gets search traffic for this prompt, so the content
goes on the right page.", a primary "Connect Search Console" (a spinner + "Connecting…" during the OAuth round trip;
900ms in the mock) and the text link "Skip, we’ll suggest a page". Success: the step goes and the Search Console section
animates in (`card-in`, 360ms; none under reduced motion). Skipped: the route's page stands and a slim row "Connect
Search Console for a better match · Connect" sits where the step was (`SkippedRow`). Connected: a chip by the section
title "✓ Connected · <brand domain> · Change"; Change reopens the connect step (where the app would offer another
Search Console property). Reconnect / no-domain / no-data keep their rows inside the section. Content list: when not
connected (never asked or skipped), a one-line banner over the KPI cards "Connect Search Console to find the best page
for every prompt · Connect" (Connect → the same round trip; the Best page column fills in).

**Intent (the owner's rule, 2026-11-04; the app's matcher feat/content-page 4385c8e):** a query can be the Best query
only if it matches the prompt's core intent term(s), the words that make the question specific ("breakouts" in "can
pigmentation serum cause breakouts"), not just the topic words. Topic words = the prompt's key terms present in ≥ 50% of
its matching queries (`TOPIC_SHARE`); intent words = its other key terms, without local / account marker words (those
keep their half-score tag). Synonyms: breakout(s) = acne = purging = pimples; cost = fees = price; grow = growth =
increase (`canon`). Each query has `intentMatch` (true when the prompt has no intent words); the list sorts intent
matches first, then by rank (adjusted × log10(impr + 1)); topic-only queries keep their score (no penalty). Best: an
intent match with ≥ 10 impressions, not a site query; none → no Best (never a topic-only one), so publish on falls back
to create. analyzePrompt returns `intentTerms`. Sample: rm-1's Best is "reverse mortgage line of credit growth rate";
"can pigmentation serum cause breakouts" → "does pigmentation serum cause acne".

**Refinement (owner, 2026-11-04):** a query is eligible as Best only if it contains at least half of the prompt's
intent words (minimum 1: `intentNeed`), and no word opposite to one in the prompt (`OPPOSITES`: dry/oily,
cheap/expensive/luxury, men/women, beginner/advanced, small/large; a query that also has the prompt's word isn't
disqualified; as the app, any other word of the group disqualifies, even next to the prompt's word; word forms are
stemmed: man/mens → men, woman/womens → women, cheapest → cheap, smaller → small, larger → large). Eligible queries (`intentMatch`) rank by how many intent words they contain (`intentCount`), then by
impressions; the Best is the first with ≥ 10 impressions that isn't a site query. Shared case for both matchers:
`src/data/gscMatchCases.js` (`GSC_SHARED_CASES`: the app's fixture rows; "best face mist for dry skin" must pick "face mist for dry skin" and
publish on /dry, never "face mist for oily skin"); the app's test should import it from its copy of the mock and run its own lib/gsc-match.js
against it.

**Publish on (as the app's lib/gsc-match.js):** only strong eligible queries count (adjusted ≥ 30, a top page,
intentMatch, not a site query). The Best if it's one; else, when every strong eligible query is under 10 impressions,
the first of them with `lowVolume: true` (the low-volume note); none → create (the topic-only chain). Previews:
`?co=gsc-lowvolume` (low volume) and prompt 0 (create, topic-only).

**List order (owner, 2026-11-04; as the app):** queries with 10+ impressions first, the under-10 ones (`lowVolume:
true` on each query row) below them, muted with a small neutral "low volume" tag (the same Tag as account / local /
site); within each group eligible queries first (by intent words, then impressions), the rest by rank; the Best query
always moves to the first row. Shared case 2 in `gscMatchCases.js` checks it (`firstRow`, `lowVolume`).

**Content list "Best page"** (`ContentList.jsx` column via `MissedPrompts` `extraColumns`, 248px): the path
(middle-truncated) + match %, or "New page" (muted) when `action === 'create'`; hover / focus: the full URL and
"Best query “…” · 72% match". Not connected → "—" and the header ⓘ "Connect Search Console in a prompt’s Target page…".
To keep the prompt readable at 1280 the Content list drops "Missed by" (`omit={['missedBy']}`); the Overview keeps it.
Tests: `src/data/gscMatch.test.js`, `tests/search-match.browser.test.mjs`.

**Owner fixes (2026-11-04):** (1) a query naming a site or brand (reddit, quora, youtube, amazon, walmart, the brand's
competitors by name or domain) is tagged `site`: muted with a neutral "site" tag, scored at half like account / local,
never the Best query, so it never decides where to publish (the app's matcher d7a0789 does the same). (2) The Google
page 1 ladder has no gaps: every rank 1–10 shows that result's favicon, non-competitor sites too (content-recommend's
`citedPages` already lists every page-1 result; empty slots only when Google returned fewer). (3) Your pages: no "Not
cited"; engine icons only when cited.

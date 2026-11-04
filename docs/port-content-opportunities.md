> **Superseded by [`docs/port-content.md`](port-content.md)**, the full port guide (v1 scope, files, field mapping,
> derivations, safe rendering, screenshots). Kept for the history of what was designed and removed.

# Port note: Opportunities → Content (design/content-opportunities)

For the app session that ports this page. The mock session doesn't edit the app repo.

## Sidebar (owner, 2026-11-04)
- Group order: Insights → Reports → **Opportunities** → Optimize → Settings (`src/components/dashboard/Sidebar.jsx`
  `groups`; MobileNav reads the same list).
- Opportunities has one item, **Content** (`/opportunities/content`, icon `FilePenLine`) with the violet Beta tag
  (`beta: true`), like Sentiment and New report.
- The app's own sidebar config must get the same order and item, or the next copy won't match.

## Data
The page runs on sample data. What exists in the app today is in `src/data/contentOpportunities.js` (real field
names); everything the app can't supply yet is in `src/data/contentOpportunities-proposed.js` (drafts, target-page
candidates, flags, formats, publish check, 4-week tracking). See the app's `docs/content-opportunities-data.md`.

## Removed, do not port (owner, 2026-11-04)
Sections designed for the workspace (`/opportunities/content/<id>`) and then removed by the owner. They are
deleted from the mock (components and their sample data) and must not be added to the app:
- **The hero band**: the "Named on n of 4" score column, the "Who AI names for this prompt" Rank / Trend chart and the
  answer quote beside it. The header row ("Missed on n of 4" + "Named instead") is the page's summary instead.
- **"Top queries"** under the Search Console column (queries matched to tracked prompts, with their engines).
The step deck now sits directly under the header (24px), and the Search Console column ends after Clicks / CTR / Avg
position. The answer data fix for missed prompts (`src/data/answers.js`: a missed prompt's answers list the row's
brands first) stays: the header's "Named instead" and the Answer drawer rely on it.
- **The step deck** (a pile / current card / peeking cards stepper with flips, arcs and a fan) and the line timeline
  before it. Replaced by the payoff bar (`workspace/PayoffBar.jsx`: step pills, the reward headline built from the
  data, the one primary action) and the sticky action dock (`workspace/ActionDock.jsx`). The steps keep no Continue
  of their own.
- **The payoff bar's stat columns** (Named now, To beat, This page, Answered, Flags, Checked) and their full / short
  forms: one engines block replaces them (round 11). "To beat" lives in the headline.
- **Steps 3–5 on the page** and the page's "resume row": steps 3–5 render only in the focus panel; the page keeps
  step 2's layout and its bar shows the live state with Resume (round 13).
- **The in-panel action dock and the panel's context row + second payoff bar**: the panel has one sticky header
  (`workspace/PanelHeader.jsx`) with the button, so no dock inside it (round 12).

## Draft step v1 on content-recommend (owner, 2026-11-04)
The workspace now renders Harsh's `POST /api/missed-prompts/content-recommend` response (shape mirrored exactly in
`src/data/contentRecommend.js`; one sample per missed prompt, plus the live reverse-mortgage run at
`/opportunities/content/rm-1`). Every derivation is one commented rule in `src/pages/opportunities/draft/recommend.js`
(R1–R17). Behind `?backend=full` (default off) until their backend exists: Search Console (step 1 and the Search
Console target page), Your data, Publish & track, and the live 5-step writing view.
- Rendering: `draft/markdown.js` parses contentMarkdown into a text-only tree; never `dangerouslySetInnerHTML`; links
  http/https only (`safeHref`), `target="_blank" rel="noopener noreferrer"`. Copy as HTML is built from the tree,
  escaped. Raw HTML in the Markdown shows as literal text.
- Copy content / Copy as HTML: the publishable sections only (no Page recommendation, Flags, Publishing notes, the
  review notice, competitor-domain sources or the "recommended new page" bullet). Export .md: the raw Markdown.
- Ticks, the readiness score (score-weighted, as `applyRecommendations`), "Re-check score" and the saved time are in
  the browser only (localStorage `auden:content-brief:v1:<domain>:<prompt>`), as in the app.

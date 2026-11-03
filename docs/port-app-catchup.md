# App catch-up (design/app-catchup): the app's Oct 31 – Nov 3 design, brought back into the mock

Requested by the app session (app.kraffic.ai) on 2026-11-03, from its `docs/port-to-mock-next-round.md`. The owner chose
a full catch-up: the mock was missing more than the Nov 2–3 round (the app's whole Sentiment redesign from Oct 31 – Nov
1, and later Visibility history and Prompt Hub work), so each page was brought up to the app's `develop` design, merged
by hand, keeping the mock's newer work (Reports v5).

**Status:** on branch `design/app-catchup`, not yet in `develop`. It joins `develop` as one squashed commit after the
owner approves the screenshots in `screenshots/app-catchup/` (1440 and 390, light and dark).

## What's in it
- DESIGN.md: the brand palette by rank (Share of voice + Visibility history), the Share of voice medals and Top share
  gold, muted amber `--caution` only for the softer verdict dots. Tokens `--caution`, `--sent-mixed`; the Sentiment page
  styles (`.k-sent`, its keyframes).
- Sentiment: the app's page to date (helpers in `src/utils/sentimentSections.js`, mock data in the app adapter's shape
  in `src/data/sentiment.js`). The 2×2 quadrant and the two-axis scatter (reverted in the app) are not included.
- Overview: history ranges and "Since …", Share of voice (palette, medals, #1 row, Top share, Other brands, no brand
  menu), full-bleed logo tiles, Brand Setup names first, short-screen KPI cards and plot, the header subtitle in an ⓘ.
  Previews: `?competitors=many`, `?history=short`.
- Setup and Prompt Hub: the Import prompts window and `public/prompts-sample.csv`, competitor Edit / remove, prompt Edit
  / remove / select / Remove selected, the scan-history confirm and the "Editing starts a new history" warning.
  Preview: `?save=fail` (Retry state).
- Reports: Slower week / Slower month / Room to grow through `src/data/verdicts.js`, "the gap is holding steady", the
  New report's 4 suggestions with placeholder rows (`?cards=suggestions:loading`).

## For the next mock → app copy: keep these app-side
These stay in the app's adapters / wrappers, not in the mock, so a 1:1 copy must not drop them:
- the account prompt limit ("This account can track up to N prompts") in PromptsStep and PromptsPage;
- Prompt Hub's Sync button and live sync status, its tablet ⋯ menu, ResearchModal pagination;
- PageHeader's red line for engines that failed in the last sync;
- Sentiment's data loading and paid re-run (`loadSentiment`, `reanalyze`), `useProductName`;
- the report-agent chat answers (QueryAnswer, askDatabase, related questions).

## Differences from the app, on purpose
- New report placeholders use the mock's shimmer, not `animate-pulse` (DESIGN.md §4 forbids pulse).
- Prompt Hub's inline edit refuses duplicate text ("Already added"); the app's Prompt Hub doesn't yet.
- "Suggested next" (app 2983a39): the idea is in (full-width option rows under every report, v4 included) but
  restyled in the mock's tokens (sentence-case label, hairline rows on the card surface, an arrow that darkens on
  hover; no white fill, shadow, uppercase label or numbered circle). Copy the mock's FollowUps over the app's; the app
  keeps its own question source (relatedQuestionsFor).

## Follow-ups
- Resolved: the dot plot's column lines now sit between the four tone columns (1/4, 3/4; the dashed even line is the
  middle one, `columnDividers` in spectrum.js), and CLAUDE.md §2 matches DESIGN.md §3 (owner, 2026-11-03).

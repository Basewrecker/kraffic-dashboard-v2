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
- Not ported, waiting on the owner: the "Suggested next" restyle (app 2983a39), which breaks the locked design system
  (white fill, shadow, uppercase label, numbered black circle).

## Open questions for the owner
- Sentiment dot plot: the dashed column dividers sit at 1/3 and 2/3 while there are now four columns (copied 1:1 from
  the app).
- CLAUDE.md §2 still says "no yellow" and "the user's brand is always ink"; DESIGN.md now carries the approved
  exceptions. CLAUDE.md was left unchanged pending the owner.

# Proposals for Harsh: fields Reports v4 needs from the API

Reports are written from `accountFacts` (`lib/report-facts.ts`, "RF" below) through `components/mock/data/live-report.js`.
The v4 mock (branch `design/reports-v4`) renders every report twice: **live only** (today's `accountFacts`, with honest
substitutes where a field is missing) and **proposed fields** (`?fields=proposed`, the fields below, read from the
mock's sample datasets; nothing invented). The screenshots put the two side by side, so each field's value is visible.

"MA" = `lib/mock-adapter.ts`. RF imports only `account, currentBrand, kpis, competitors, platforms, syncHistory,
missedPrompts, citedPages` (RF:5); it doesn't import `visiblePrompts`, `trackedPrompts`, `competitorPrompts`,
`appearances`, `citationStats`, `getBrandView` or `getAnswer`, which is where most of the data below already lives.

## (a) ALREADY IN THE API, dropped by report-facts

| # | Field (proposed shape) | Where it exists | Where it's dropped | Unlocks |
|---|---|---|---|---|
| 1 | `missedRows[].engines`: the engines that named each competitor | `missedPrompts[].platforms` (MA:2849, from `answeredPids`, MA:1078) and `missedPrompts[].brandsMentioned[{domain, platforms}]` (MA:2855) | RF:94 keeps only `prompt` and `competitors` (bare domains) | The engine column in every list (AIO / GPT); the prompt drawer opening on the right engine |
| 2 | `visibleRows[]`: every prompt we're named on, with its text and the competitors named with us | `trackedPrompts` `{prompt, status, platforms, answered}` (MA:2878-2882), `visiblePrompts` (MA:2828), `getBrandView(OWN).rivalPrompts` `{prompt, winners[], focalVisible}` (MA:1046-1048), or `appearances[p][domain]` (MA:2685-2708) | RF uses only the counts `kpis.visible` / `missed` (RF:79-80) | Prompt strip hover for every bar (today only missed prompts have text); "you win" vs "both named" in Competitor gap |
| 3 | `headToHead[]`: per competitor, prompts where both are named (`youWin` = us named and they're not) | `getBrandView(rival).youLead` (MA:1053); `appearances[p][OWN].visible` vs `appearances[p][rival].visible`; `competitorPrompts[]` (MA:2898-2931, top rival only) | RF `competitors` keeps only `share` (RF:88-93) | Competitor gap: honest "you win" (live shows "you're named", which counts prompts where both are named) |
| 4 | `competitors[].points[{iso, share}]`: share per sync | `scans[].scores[engine][brandKey]` (MA:2458-2463) from `domain_score_history.competitor_scores`; exported via `getHistory()` (MA:735-742); `getBrandView(rival).syncHistory[].visibility` (MA:877-944) | RF keeps the latest `share` only (RF:92); `pointsOf` (RF:51) reads our `syncHistory` only | CEO: the "Weekly share change" chart (you vs rivals) and the share-of-voice change in the stat line; live shows share by brand, latest scan |
| 5 | `points[].share`: our share of voice per sync | the same history as 4 (our key) | RF `points` carry `score` and `visible` only | CEO stat-line change (↑3); the CEO chart |
| 6 | `points[].gained` / `.lost`: prompts won and lost at each sync | every `syncHistory[]` row has `changes.gained[] / lost[]` (MA:913-933); older syncs from `storedChanges` (MA:958-994, `GET /api/ai-visibility/sync-timeline`) | RF reads only `syncHistory[0].changes` (RF:67-69) | Weekly / Client update: "Gains and losses" (gained up, lost down, per sync); live shows the net change per sync |
| 7 | `competitors[].cited[{path, n, prompts}]`: the competitor's pages AI cites | `citationStats(rivalDomain,'all').pages[]` with `prompts[]` per page (MA:1222-1238); `appearances[p][rival].citedPages` (MA:2705); `competitorPrompts[].theirPage` (MA:2906, 2920) | RF `cited` is our pages only (RF:95) | The action popover: "the rival's cited page" for each action; per topic once 10 lands |
| 8 | `engines[].competitors[{domain, visible}]`: per-competitor counts per engine | `citationsMentions[domain][engine]` (MA:2803-2823); `citationStats(domain, engine).perEngine` (MA:1192-1246); `getBrandView(rival).platforms[]` (MA:1022-1032) | RF `engines` is our `visible` only (RF:87) | A per-engine head-to-head metric in Competitor gap (a stat that switches the chart) |
| 9 | Extras on missed rows: `streak`, `firstSeen`, `history[]`, `sources[{domain, path}]` | `missedPrompts[]` (MA:2832-2862) | RF:94 | Competitor gap, Prompts tab: the "weeks they won" column (`streak`; today the tab has no value column); the answer drawer's "missed for N syncs" |
| 9b | Engine on gained / lost prompts | `syncHistory[].changes.gained[] / lost[]` (MA:913-933) with `trackedPrompts[].platforms` (MA:2878-2882) | RF reads only the prompt texts of `syncHistory[0].changes` (RF:67-69) | The engine favicon on Gained / Lost rows (today they have none) |

## (b) NEEDS NEW DATA

| # | Field | Where it would come from | Unlocks |
|---|---|---|---|
| 10 | `topic` on every prompt row (missed and visible), and `topics[]` counts per topic (us and each competitor) | The code path exists, the table doesn't: `applyTopics()` (MA:1787-1793) fills `trackedPrompts[].category` from `topicStore`, read via `app/api/prompt-topics/route.js` and `lib/prompt-topics.js`, from `prompt_categories (user_id, domain_url, name)` + `user_prompts.category_id`. That SQL is only in `docs/proposals/prompt-categories.sql`, not in `migrations/pg`, so the route answers `{available:false}` and every category is null (missed rows `topic: null` at MA:2847, `missedTopics` always `[]` at MA:2868). Apply the migration, then set `topic` in `missedItem` and on the visible rows, and group `appearances` by category for the counts | Competitor gap: "Your lead by topic" (the reference chart), "3/8 topics they lead", "Close the gap" actions grouped by topic ("Calculators page"). Missing prompts: "Missing per topic", quick wins by topic. Weekly: "Fix what was lost" by topic. CEO: "topics led", "Topics by lead", "Biggest wins" |
| 11 | `topicShare[]`: share-of-voice lead per topic (points, leader, weekly trend) | Needs 10, then `domain_score_history.competitor_scores` (per day) grouped by the prompts' topics, or recomputed from `appearances` per sync | CEO: "Your lead by topic", "Topics by lead", "Biggest wins" |
| 12 | `headToHead[].themFirst` / `youFirst`: who's named first when both are named | Partly there, only on demand: `getAnswer(key, engine)` (MA:1404-1440) returns `brands[]` in answer order and our `position`, from `user_keywords.serp_data.response_snapshots[].brands` (parsed in `answerOn`, MA:1690-1720). Not rolled up; needs a pass over every prompt × engine of the latest scan. Caveat MA:1710: a brand found only by `is_own_domain` is appended `unranked` | Competitor gap: "they win" = only them + them first (live counts only-them); the "+14 where both are named, them first" line |
| 13 | Per-competitor wins history (`headToHead[].theyWin[]` / `youWin[]` per sync) | `getBrandView(rival).syncHistory[].changes` exists only for the two loaded scans (MA:889-895). Full history: re-judge from `prompt_visibility_snapshot.response_text` (`migrations/pg/001_schema.sql:338`, `is_visible` is own-brand only; as `lib/snapshot-history.js` does) or from `user_keywords.serp_data.response_snapshots[].brands` (last 12 days) | Competitor gap stat-line changes ("23 they win ↑2", "57 you win ↑4"); live shows a change only on "you're named" |
| 13b | Answers naming each brand, per sync (counts, not shares) | `citationsMentions[domain][engine]` (MA:2803-2823) has mentions for the latest scan only; `scan_metrics.mentions` (`migrations/pg/009_scan_metrics.sql`) is per day but own brand only; `domain_score_history.competitor_scores` is a score, not a count. Needs a per-sync mention count per brand (from `user_keywords.serp_data.response_snapshots[].brands`) | Competitor gap KPIs "Answers naming Longbridge" and "Answers naming you" (the prototype's); today they show Longbridge's share of voice and prompts naming you |
| 14 | `nextSync` | Always null today (`initialTracking.schedule.nextScanAt`, MA:2972; `lib/mock-adapter-setup.ts:245`). The schedule is fixed in `deploy/install-crontab.sh:35-36` (`30 3 * * 1`, Monday 03:30 UTC); `user_llm_settings.sync_frequency` is stored but ignored. Compute "next Monday 03:30 UTC" | One scan: the footer could say when the next sync is ("Not enough history yet: one scan so far · next sync Nov 2") |

## Live-only substitutes (what the mock shows without these fields)

- Competitor gap: stats "they win" (only them) · "you're named" · "neither"; chart "Who's named" (you / rival / neither counts); no actions card (the list takes the full width).
- Weekly / Client update: chart "Change per sync" (net change in prompts named, from `points[].visible`); no actions card.
- CEO: stats share of voice · lead over #2 · rivals ahead; chart "Share by brand" (latest scan); list "Brands by share"; no actions card.
- Missing prompts: chart "Who's named instead" (by competitor, plus nobody); actions grouped by who's named ("Answer open prompts", "Beat Longbridge").
- The footer names what's missing: "Not in your data: lead by topic, who's named first".

## Adapter wording (app-side, no new data)

- The one-scan footer "Not in your data: score history (one sync is stored …)" mixes two messages. DESIGN.md section 7: "Not in your data: …" is for something not tracked; "Not enough history yet: one scan so far" for something tracked that needs more scans. The adapter could emit `notEnoughHistory: true`.
- The Content plan refuses when nothing is missing; v4 shows it as a finished report ("Nothing missing."). A `kind: 'content'` frame with no rows would keep one path.

## Not needed from the API

- Sentiment, traffic, backlinks, pricing: a custom question about them gets "Not in your data: …" and the closest report type.
- Favicons: from the domain, as the dashboard does (v4 shows them only inside the answer drawer).

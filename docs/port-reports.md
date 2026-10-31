# Porting Reports (v5) into the app

The design mock on branch `design/reports-v5` is the approved Reports design. This file is the checklist for the app
session: what to copy, which tokens come with it, what data each panel reads, every state, and what must stay
behind. Compare the port 1:1 with `screenshots/reports-v5/final/` (list at the end).

Ground rules for the port:
- Copy, don't redesign. Where the app already has a component the mock reuses (Visibility history, DrawerShell,
  ActionMenu, Segmented, Marker), use the app's and apply the mock's changes to it.
- Never fake data. A panel, column or KPI whose field is missing hides; it never shows a zero or a placeholder.
- Nothing in "Mock only" (section 6) ships.

## 1. Files to copy

| Mock path | What it is | Port |
|---|---|---|
| `src/pages/reports/v5/model.js` | `buildReport5(...)`: turns facts into the report view model (question, answer, KPIs, blocks, snapshot, steps, footer) for the four report types | Copy as-is. Pure functions, no React |
| `src/pages/reports/v5/model.test.js` | Tests for every report type and data situation (1 sync, 3+ syncs, nothing missing, live-only vs proposed fields) | Copy, run with the app's test runner |
| `src/pages/reports/v5/Report5.jsx` | The report page: header, KPI card, panels, What moved, Competitors table, Open prompts, Snapshot, step cards, brief drawer, layout | Copy |
| `src/pages/reports/v5/report5.css` | Every report style, scoped to `.r5` (section 2) | Copy |
| `src/pages/reports/ScheduledPage.jsx` | Scheduled: Upcoming strip, list, suggestions (empty), the New / Edit schedule drawer | Copy; wire to the real schedules API (section 6) |
| `src/components/ui/Marker.jsx` | The shared indicator glyph (tick / part ring / dashed ring / cross) | New file; Structured Data already imports it |
| `src/components/structured/StructuredDataPage.jsx` | Uses `Marker` in place of its local copy | Apply the diff |
| `src/components/dashboard/VisibilityHistory.jsx` | Gains optional props for Reports (`dataset`, `units`, initial view, no URL sync, `bare`, `compact`, plot height, single-sync note). With none passed it behaves exactly as on the Overview. With a one-line dataset the insight names the number ("Prompts missing fell 7 prompts this week.") and drops "still leads" | Apply the diff |
| `src/components/dashboard/Card.jsx` | Small prop pass-through for the bare card | Apply the diff |
| `src/pages/reports/ReportPage.jsx` | `writeReport(...)`: facts → `buildLiveReport` → `buildReport5`; renders `Report5`; question reading and "not tracked" | Apply the diff, minus the mock switches (section 6) |
| `src/pages/reports/parts.jsx` | The report URL reads `?kind=` (opens a report type directly) | Apply the diff |
| `src/data/mock.js` | `fitDomain(values, cap)`: count axes (prompts named, prompts they win) have no 100% ceiling | Apply the diff |
| `src/data/live-report.js` | The live adapter (`buildLiveReport`, `pointsIn`) | Already in the app's shape; keep the app's |

Components inside `Report5.jsx`, in page order:
`Report5` (header: question, answer, read line, date range menu, Export) → `KpiCard` (KPI tabs over
`VisibilityHistory compact`, or `Snapshot` below 3 syncs) → `layout(blocks)` places blocks → `Panel` (tabs, header
columns, `Row` / `Cell`, View all in place) · `WhatMoved` / `MovedRow` · `CompetitorsTable` · `OpenPrompts` →
`Steps` / `NextMoves` / `MoveCard` → `BriefDrawer` → footer line.

Layout rule (`layout()`): a block that can expand (View all) or is marked full gets its own row; short panels share
a row, up to 3. Panels use a CSS subgrid (`minmax(0,1fr) repeat(N, auto)`) so value columns line up and never
overflow; container queries hide the share pie under 380px and show engine icons only under 320px.

## 2. Tokens and CSS

All Reports tokens are scoped to `.r5` and do not touch the app's shared tokens.

**Surface and ink** (light / dark), from the prototype:
`--page #FAFAFA/#000`, `--card #FFF/#0A0A0A`, `--tabs #F5F5F5/#111`, `--line #EAEAEA/#1F1F1F`, `--bar #F6F6F6/#111`,
`--bar-hi #EFEFEF/#171717`, `--pill #EBEBEB/#1F1F1F`, `--ink #171717/#EDEDED`, `--ink2 #666/#A1A1A1`,
`--ink3 #8F8F8F/#707070`, `--chip #EDEDED/#1F1F1F`, `--plot #0068D6/#3291FF` (`--plot-a .16/.22`),
`--grid #EFEFEF/#1A1A1A`, `--good #1A7F4B/#4CC38A` (+`--good-bg`), `--bad #D93036/#FF6166` (+`--bad-bg`),
`--tip #0A0A0A/#1A1A1A`, `--tip-fg #EDEDED`. Dark applies under `html[data-theme="dark"]` and under
`prefers-color-scheme: dark` unless the theme is forced light.

**Reports-only type scale**: `--rep-text-h1 32px`, `--rep-text-answer 16px`, `--rep-text-read 14px`,
`--rep-text-card-title 17px`, `--rep-text-tab 15px` (also rows), `--rep-text-tip 13px`, `--rep-text-chip 12px`,
`--rep-row-h 40px`, `--rep-icon 18px`. KPI label 14px, KPI number 32px, column labels 12px uppercase, footer 13px.
Font: the app's (Manrope).

**Delta colours**: `--rep-good` / `--rep-bad` (same values as `--good` / `--bad`).

**`--color-line-strong`**: the app's existing token (`#d6d3d1` light, `#333` dark). Reports and Scheduled use it for
selected tiles, chips and focused inputs (a soft tint plus a 1px ring of this colour). No new value.

**Indicator glyphs** (`Marker`, one vocabulary with Structured Data): a full tick = all, a part ring = some (the arc
is the share), a dashed ring = none or not set up, a cross = lost. Tones: ink (default), good, bad. Stroke 2.5,
default size 20 (18 in rows). The share pie in Engines / Share columns is `Pie` in `Report5.jsx` (16px).

**Reset**: the `.r5` element reset sits in `@layer base`, so Tailwind utilities on app components inside a report
(the Visibility history card) still win. Keep it layered.

**Drawers**
- Brief drawer (`BriefDrawer`, `.sheet.brief`, `.bd-*`): 560px, right side, sticky header and footer, 40% page dim;
  focus is trapped, Esc / outside click / × close.
- Schedule drawer: the app's `DrawerShell` (560px, URL param `?schedule=new|tpl-<id>|<id>`), sticky footer.

**Motion** (all honour `prefers-reduced-motion`):
| What | Value |
|---|---|
| Chart line draw-in | `r5draw` .9s `cubic-bezier(.3,.7,.2,1)`; the dash is cleared on `animationend` |
| Chart area fade | `r5fade` .6s ease-out |
| Row bars grow | `r5grow` .55s `cubic-bezier(.3,.7,.2,1)` (scaleX from 0) |
| Rows / cards enter | `r5up` .24s ease-out (6px rise), `r5rise` .24s `cubic-bezier(.2,.8,.2,1)` (4px) |
| View all in place | max-height, `cubic-bezier(.2,.8,.2,1)`, up to 25 rows (`CAP`), then scrolls |
| Drawer | `r5slide` / `r5slideout` .24s ease-out; dim `r5dim` / `r5dimout` .24s |
| Tooltip / hover | opacity .1–.12s; row background .12s |
| Scheduled rows | fade in 200ms, 20ms stagger; hover actions crossfade 150ms; Upcoming chip click highlights its row 1.4s |
| Scheduled save from a suggestion | the new row fades in over 200ms |

## 3. Data each panel reads

Facts come from `accountFacts` (live: `src/data/live-facts.js`, shape in `src/data/live-facts-sample.js`,
`LIVE_FACTS_FIELDS`) through `buildLiveReport` in `src/data/live-report.js`.

### 3a. In live today
`brandId, name, domain, prompts, scans, score, visible, missed, youShare, compared, since, gained, lost, ran,
engines, competitors, missedRows, cited, points`.

### 3b. Being added by the app now (the mock's default path uses these)
- `missedRows[].topic`: the prompt's topic
- `missedRows[].engines`: which engines named the competitor on that prompt
- `lostRows[] / gainedRows[]`: `{ prompt, topic }` for prompts lost / gained since the sync before

### 3c. Proposed, not in the app yet (`?fields=proposed` in the mock)
Listed with source and owner in `docs/proposals-for-harsh.md`. Fields: `engines[].points` (per-engine history),
`headToHead[]` (per rival: who's first, prompts each wins, per-engine split, brands named per prompt),
`topics[]` (per topic: visible and competitors named), `topicShare[]` (per topic: lead, leader, trend, shares),
`competitors[].points` (per-competitor history), `competitors[].cited` (their cited pages, cited-page delta),
`points[].share / .gained / .lost` (per-sync share and movement).

### 3d. Panel by panel

Report types: Weekly summary (and Client update), CEO summary, Competitor gap (Head to head), Missing prompts
(Content). Every report has the header, the KPI card, the footer line (syncs, range, engines that ran or didn't).

| Report | Block | Reads | Missing field → |
|---|---|---|---|
| All | KPI card chart | `points[]` | below 3 syncs: the Snapshot instead of the chart |
| All | Snapshot (Share this sync, By engine) | `competitors[]`, `youShare`, `engines[]` | By engine hides when there's no per-engine split for the brands |
| All | Engines panel | `ran`, `engines[]` (named, share); sparkline from `engines[].points` | no `engines[].points`: no sparkline / change column; engines that didn't run show a dashed ring "didn't run" |
| All | Share of answers | `competitors[]`, `youShare` | — (always in live) |
| All | Your pages / Cited | `cited` | no pages: panel hides |
| Weekly | What moved (by topic, gained / lost / net, prompts on open) | `gained`, `lost`; topic from `lostRows[]` / `gainedRows[]` | 1 sync or nothing moved: block hides |
| Weekly | Next moves (win back / build on) | `lostRows`, `gainedRows`, `missedRows` (topic, competitors) | "Now naming" logos need `missedRows[].competitors`; no topic: block hides |
| CEO | KPIs: share of voice, lead over #2, prompts named, topics you lead | `youShare`, `competitors[]`, `visible`; topics KPI from `topicShare[]` | no `topicShare`: "Topics you lead" KPI and "Topics by your lead" panel hide |
| CEO | Competitors table (share, change, topics led, 8-week sparkline) | `competitors[]`; change and sparkline from `competitors[].points`; topics led from `topicShare[]` | those columns hide |
| CEO | Biggest wins | `gainedRows[]` (topic), `points[].gained` | no gains: block hides |
| Competitor gap | KPIs: their share, prompts naming you, prompts they win, your share | `competitors[]`, `visible`, `missedRows[]` filtered to the rival | "Prompts they win" history needs `headToHead[].theyWin` |
| Competitor gap | Topics (Named instead, Split, Them, Missing) / Prompts tab | `missedRows[]` (topic, competitors); Them ring from `topics[]` | no `topics[]`: Them column hides; no topic: Topics tab hides, Prompts tab stays |
| Competitor gap | What moved | as Weekly | as Weekly |
| Competitor gap | Engines (You / Them / Share) | `ran`, `engines[]`; Them from `headToHead[].engines` | no `headToHead`: Them column hides |
| Competitor gap | Their pages | `competitors[].cited` | hides |
| Competitor gap | Close the gap cards + brief drawer | `missedRows[]` grouped by topic (prompts, engines, who's named) | no topic: block hides |
| Missing prompts | KPI Missing (+ history from `points[].visible`) | `missed`, `points[]` | — |
| Missing prompts | Missing by topic (Named instead, Split, Competitor, Nobody) / Prompts tab | `missedRows[]` (topic, competitors, engines) | no topic: Topics tab hides |
| Missing prompts | Who's named instead (Topics, Prompts) | `missedRows[].competitors` | — |
| Missing prompts | Open prompts (named by nobody, by topic) | `missedRows[]` with no competitors | none: block hides |
| Missing prompts | Their pages | `competitors[].cited` | hides |
| Missing prompts | Quick wins | `missedRows[]` by topic | no topic: hides |
| Scheduled | Last sent dots, first line | the schedule's past runs (verdict, headline); first line = `writeReport(...).view.answer` | no runs: "Not sent yet" |
| Scheduled | Suggestion preview | `writeReport` for the template; fallback: its KPI names | — |

## 4. States

| Panel | 1 sync | 3+ syncs | Empty | Missing field |
|---|---|---|---|---|
| KPI card | Snapshot (share bars, By engine) and "One sync" footer; no deltas | Chart (Weekly / Monthly, Trend / Share / Growth), deltas vs period start, best / avg labels | — | KPI hides (section 3d) |
| Engines | named and share, no change / sparkline | + change, sparkline | — | engine didn't run: dashed ring "didn't run" |
| What moved | hidden (nothing to compare) | rows by topic | "nothing moved": block hides | no topic: ungrouped |
| Topics / Prompts | shown | shown | brand named everywhere: the Missing report says so in the answer and hides the panels | Them column / Topics tab hide |
| Competitors table | share only | + change, sparkline | — | columns hide |
| Steps (Next moves / Close the gap / Biggest wins / Quick wins) | shown | shown | hides | hides |
| Panel lists | up to 7 rows, then View all (in place, up to 25, then scroll) | same | short list: ends in a muted summary line | — |
| Scheduled list | — | — | Empty: suggestion rows (dashed ring, preview, Set up) + "Write your own schedule"; Upcoming hidden | — |
| Scheduled row: active | next send + "in N days"; hover: Send now · Skip next · ··· | | | |
| Scheduled row: paused | "Paused" chip, "was <date>", cells at 50%; hover: Resume · ···; absent from Upcoming | | | |
| Scheduled row: failed | "Failed <date>" in red + inline Retry; hover: Retry · ··· | | | |
| Schedule drawer | New (template from Set up, or the first), Edit (prefilled + Pause / Delete); Save disabled until it has a recipient (and a question for Custom) | | | |

## 5. Interactions to keep
- KPI tabs switch the chart; hovering the chart glides between syncs (keyboard arrows too).
- Panel tabs, View all in place, rows that open (What moved, Open prompts "+n more").
- Step cards open the brief drawer; Copy brief; Open in Prompt Hub.
- Scheduled: Upcoming chip hover tooltip ("Weekly summary · Mon Nov 2, 9:00 · 1 recipient"), click scrolls to and
  highlights the row; dots open that sent report; hover actions also show on keyboard focus.

## 6. Mock only: do NOT port
- **`Coming soon: sending is part of the app, not the preview.`**: the footer line under the Scheduled list and the
  toast behind Send now / Retry. In the app these call the real send.
- **Sample brands and data**: `src/data/live-facts-sample.js`, `src/data/live-facts-proposed.js`, the brands in
  `src/data/reports.js` (Finance of America, Dermasuri, Lumen, Brightside, Northwind), the schedules and their runs,
  and the drawer's `TEAM` list (use the workspace's team).
- **URL switches**: `?live=0` (sample builders instead of the live adapter), `?fields=proposed` (proposed fields),
  `?mock=empty` and `?brand=` on Scheduled.
- **`TODAY = Oct 28 2026`** in `ScheduledPage.jsx`: use the real date.
- **Timezone line** "Times in Europe/London (GMT)": use the workspace timezone.
- **"Connect Slack"**: a dead button in the mock; wire it or hide Slack.
- `screenshots/` folders.

## 7. Screenshots (`screenshots/reports-v5/final/`)

Each at 1280 and 1440, light and dark (`<name>-<width>-<theme>.png`):

| Name | Shows |
|---|---|
| `report-weekly` | Weekly summary, Dermasuri, default state |
| `report-weekly-expanded` | the same with every View all, "+n more" and What moved row open |
| `report-ceo`, `report-ceo-expanded` | CEO summary |
| `report-head-to-head`, `report-head-to-head-expanded` | Competitor gap vs CeraVe |
| `report-content`, `report-content-expanded` | Missing prompts |
| `drawer-brief` | the brief drawer from the first Close the gap card |
| `all-reports` | All reports |
| `scheduled-empty` | Scheduled, Finance of America, no schedules |
| `scheduled-filled` | Scheduled, Dermasuri: active, failed, paused |
| `drawer-schedule-new` | the New schedule drawer |

Hover states for Scheduled (strip tooltip, active / paused / failed row actions, 1440 light and dark) are in
`screenshots/scheduled-final/fixes/`; the Edit drawer is in `screenshots/scheduled-final/drawer-edit-*`.

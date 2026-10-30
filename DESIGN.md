# DESIGN.md — the kraffic dashboard mock

What the code does today, written down so every session and every port follows the same system. Captured from
`src/index.css`, `CLAUDE.md` section 2 and `src/pages/reports/frame.jsx` on 2026-10-30; nothing here is a new
decision. When the code and this file disagree, fix one of them in the same change.

## 1. Tokens (light and dark)

All colours live in `src/index.css`: the light values in `@theme` and `:root`, the dark values in
`html[data-theme="dark"]` and the matching `prefers-color-scheme` block. Components use the tokens, never a hex,
never `gray-*`, never `bg-white`.

| Role | Token | Light | Dark |
|---|---|---|---|
| Page | `--color-page` | `#fafaf9` | `#000000` |
| Card surface | `--color-surface` | `#ffffff` | `#111111` |
| Popovers, drawers | `--color-raised`, `--color-overlay` | `#ffffff` | `#1B1B1B` |
| Hairline | `--color-line` | `#e7e5e4` | `#222222` |
| Soft background (chips, active nav) | `--tint` | `#F5F5F4` | `#1A1A1A` |
| Ink (text, primary buttons, your data) | `--ink` | `#171412` | `#ECECEC` |
| Text steps | `--color-stone-900` … `--color-stone-500` | stone scale | remapped greys |
| Loss, failure | `--negative` | `#DC2626` | `#F87171` |
| Beta tag, the only violet | `--beta` | `#6E56CF` | `#7C66DC` |
| Reports send button, the only blue | `--send` | `#3C65C0` | same |
| Chart: you | `--line-you` = `--ink` | ink | ink |
| Chart: competitors, line chart only | `--line-1` … `--line-4` | indigo, red, mint, fuchsia | lighter tints |
| Chart: competitor bars and donuts | `--data-c1` … `--data-c4` | `#78716C` … `#E7E5E4` | `#A3A3A3` … `#3A3A3A` |
| Chart track | `--data-track` | `#F1F0EE` | `#1A1A1A` |

Reports alias the chart tokens; they never carry their own hues. **Current, under review:** the Reports pairing of
ink + indigo (`--rep-primary` + `--rep-rival`) is what ships today; the owner found it flat, and three options are
being compared on the Competitor report (graphite only · indigo on the rival series only · a vivid blue-indigo /
amber pair). Until one is picked, nothing below changes.

| Reports role | Token | Resolves to |
|---|---|---|
| Us | `--rep-primary` | `--line-you` (ink) |
| Our tint (held, earlier weeks) | `--rep-primary-tint` | `--data-c2` |
| The main competitor | `--rep-rival` | `--line-1` |
| Nobody, neither, missed | `--rep-neutral` | `--data-c4` |
| Card hairline | `--rep-line` | `#EAECF0` light, `#232323` dark |
| Table header fill | `--rep-head` | `#F9FAFB` light, `#161616` dark |
| Card lift | `--rep-shadow` | `0 1px 2px rgba(16,24,40,.05)` light, none dark |
| Dark tooltip | `--rep-tip`, `--rep-tip-line`, `--rep-tip-fg`, `--rep-tip-meta` | `#101828` light, `#1B1B1B` dark |
| Change chip, good | `--rep-up-fg` on `--rep-up-bg` | green text on a green tint |
| Change chip, bad | `--rep-down-fg` on `--rep-down-bg` | `--negative` on a red tint |

## 2. Type

- Manrope (variable), loaded by the app shell; `tabular-nums` on every number.
- Weights in use: 400 (body, labels), 500 (KPI values, next-step buttons, "Only X" results), 600 (titles, bold
  values). No 700 or heavier in Reports.
- The scale, from `src/index.css`: caption 13, small 14, body 15, title 18, h1 30, kpi 40. Reports use 32/600 for
  the H1, 16/400 for the finding, 14 for labels, 15 for table cells, 13 for meta, 28/500 for KPI values.
- Sentence case everywhere. No uppercase labels, no letter-spacing tricks.

## 3. Colour rules

- Graphite first: ink and the grey steps for healthy data. Brand hues only in the Visibility history line chart
  and in Reports' competitor series, and the user's own brand is always ink.
- Red (`--negative`) only for a loss of yours or a failure. A competitor's own gain is never red; it's the change
  chip's job to say whether a move is bad for you.
- Violet (`--beta`) only for the Beta tag. Blue (`--send`) only for the Reports send button.
- No yellow, no coloured pills or links, no rainbow palettes. At most three colours in any one chart.

## 4. Forbidden effects

- No gradients, glows, blurs, neon, glassmorphism or background blobs (the one `linear-gradient` in the codebase is
  the loading shimmer).
- No drop shadows on charts; cards get at most the 1px `--rep-shadow` in light and a border only in dark.
- No "01 / 02" section numbering, no eyebrow labels, no decorative icons, no emoji.
- No load animations that loop, count up, pulse or bounce. Motion is ≤500ms, ease-out, once, and off under
  `prefers-reduced-motion`.

## 5. Reports: the three-band frame

Every report kind (CEO summary, Competitor gap, Weekly summary and its client version, Missing prompts, Custom
question) renders through `src/pages/reports/frame.jsx` from a `frame` object built in `src/data/reports.js`.

1. **Header**: the question as the H1 (32/600), one finding sentence under it (16/400, at most ~20 words), for a
   custom question one "How I read your question" line; on the right the date range, the frequency and Export as
   44px outline buttons with a 10px radius.
2. **Band 1, the KPI strip**: one card, equal cells with 1px dividers. Each cell: a 14px label, the number, the
   change chip with "vs <start>". **Numbers only**: no sparklines or mini bars inside a tile (decided; the code
   still draws them, see Known gaps). The strip is the only place headline numbers live. Tiles are selectable and
   switch the main chart.
3. **Band 2, two visuals**, 2/3 + 1/3, equal height, each a 14px label plus a legend and nothing else. Left: the
   main chart. Right: the breakdown, then a hairline and "By engine".
4. **Band 3, the table**: single-line cells, 52px rows, a header on `--rep-head`, sortable columns, a Trend column
   with an inline sparkline where the data exists, short next-step text buttons with an arrow, rows that open to
   their prompts, the source line and "Showing N of M" in the footer.
5. **Band 4** (CEO summary only): the pages AI cites most.

Grid: 16px between bands and cards, 20px card padding, 12px card radius, left edges aligned, everything on an 8px
grid. Follow-up chips sit 12px under the table, then the composer.

**Visual reference for Reports:** `~/Documents/design-refs/reports/doctime-reports.png` (outside every repo). Copy
its structure and restraint, apply our tokens.

## Charts

- Axes always: a baseline and a left axis with round ticks (1, 2, 5, 10, 20, 25, 50, 100 steps, at most five), and
  the y-axis rounds up past the tallest bar so nothing touches the top.
- Percentages in one chart sum to 100 (largest remainder, `shares()` in `src/data/reports.js`).
- Topic charts are sorted by our lead, largest first.
- Hover fades the other columns to 35% and shows the dark tooltip; nothing else moves.
- At most three colours per chart: us, one competitor, neutral. Red is never a series colour.
- Sparklines only in a table's Trend column, never in a KPI tile or a legend.

## 6. Words

- One finding sentence per report, under the H1. Short next-step buttons (≤6 words). Everything else is wordless:
  names, numbers, units and one- or two-word baselines on the screen; explanations go in tooltips and "Explain
  this". No explainer paragraphs, no insight rows, no marketing words.
- Brands by their display names, never slugs or domains.
- Sentiment bands, in this order and with these labels only: Very positive · Mostly positive · Mixed · Mostly
  negative · Very negative.

## 7. Missing data

- Nothing is estimated. A failed or incomplete scan is a gap ("—"), never 0.
- An engine that didn't run is named ("Gemini, Claude · didn't run") and left out of every count.
- Two different messages, never mixed:
  - **"Not in your data: …"** for something Kraffic doesn't track (sentiment, a page's traffic, an untracked
    competitor). In the table footer, with a link to where it would live.
  - **"Not enough history yet: one scan so far"** for something tracked that needs more than one scan (changes,
    trends, sparklines). With only one scan there are no change chips, no trends and no sparklines, and this line
    replaces them.
- A number is the same everywhere it appears, and appears once as a claim.

## Known gaps (code that doesn't follow this file yet)

- KPI tiles still draw mini charts: the sparkline in Visibility score / Prompts named / Share of voice and the
  segment pills in Competitors ahead (`KpiStrip` in `src/pages/reports/frame.jsx`). Decided: numbers only.
- Two `font-bold` (700) uses outside Reports: the wordmark in `src/components/ui/Logo.jsx` and the phone nav's
  home link in `src/components/dashboard/MobileNav.jsx`. The scale stops at 600.
- The adapter's footer wording (`src/data/live-report.js`, copied unchanged from the app): "Not in your data: score
  history (one sync is stored, so no change, sparkline or trend line is drawn)" is the one-scan message in the
  wrong form; section 7 wants "Not enough history yet: one scan so far". App-side fix.
- "Source: 1 weekly syncs" (the frame pluralises the source line unconditionally). Should read "1 weekly sync".

## 8. Design guides, in order of authority

1. The owner's instructions, then this file.
2. `dashboard-design`: charts, tables, data honesty.
3. `unslop`: the slop audit and the 9-pass order.
4. `impeccable`: `/impeccable document`, the detector hook, critique.
5. `awesome-design-md`: reference only, at `~/Documents/design-refs/awesome-design-md`, never copied into a repo.

Our tokens and colours win over any guide's house style. Reports keep the one finding sentence and the short
next-step buttons; everything else follows the wordless rule. No guide's sign-off line goes into a reply, a commit,
a file or the UI.

**Run unslop's audit and direction first, then wait for the owner's OK before editing.**

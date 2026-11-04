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
| Hairline | `--color-line` | `#DEDCDA` | `#2A2A2A` |
| Section rule, hovered border | `--color-line-strong` | `#CFCCC9` | `#3D3D3D` |
| Soft background (chips, active nav) | `--tint` | `#F5F5F4` | `#1A1A1A` |
| Ink (text, primary buttons, your data) | `--ink` | `#171412` | `#ECECEC` |
| Text steps | `--color-stone-900` … `--color-stone-500` | stone scale | remapped greys |
| Loss, failure | `--negative` | `#DC2626` | `#F87171` |
| Softer report-verdict dot only (muted amber) | `--caution` | `#B8893E` | `#C9A160` |
| Sentiment: a Mixed page | `--sent-mixed` | `#57534E` | `#808080` |
| Beta tag, the only violet | `--beta` | `#6E56CF` | `#7C66DC` |
| Beta pill text / fill (from `--beta`) | `--beta-fg`, `--beta-bg` | `--beta` on `--beta` at 15% | `--beta` 65% toward white, on `--beta` at 15% |
| Reports send button, the only blue | `--send` | `#3C65C0` | same |
| Chart: you | `--line-you` = `--ink` | ink | ink |
| Chart: competitors, line chart only | `--line-1` … `--line-4` | indigo, red, mint, fuchsia | lighter tints |
| Share of voice + Visibility history brands | `BRAND_PALETTE` (`src/utils/brandColors.js`) | by rank, see §3 | +8% lightness |
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

- Graphite first: ink and the grey steps for healthy data. Brand hues only in Share of voice, the Visibility history
  chart (the brand palette below) and Reports' competitor series. In Share of voice and Visibility history the user's
  brand takes its palette colour by rank like every other brand (owner, 2026-11-03); elsewhere it stays ink.
- Red (`--negative`) only for a loss of yours or a failure. A competitor's own gain is never red; it's the change
  chip's job to say whether a move is bad for you.
- Violet (`--beta`) only for the Beta pill. Beta pill: 18px, 11px text, soft violet tint, no sparkle. Only on pages
  still in preview. (Owner, 2026-11-04, replacing the solid violet tag: violet text on violet at 15%, `--beta-fg` on
  `--beta-bg`, 11px/600, 6px side padding, no motion; `components/ui/BetaTag.jsx`.) Blue (`--send`) only for the
  Reports send button.
- **Sidebar (owner, 2026-11-04):** 232px wide. The logo stays pinned at the top and the theme switch + brand card at
  the bottom; when the nav doesn't fit (1366×768 with every section open) only the nav list scrolls, with a thin 6px
  scrollbar shown on hover (`.nav-scroll`), never sideways. Nothing is cut off. The brand card reads as the live site:
  the brand's domain on line 1, its short name on line 2 (`shortName` on the mock brands, else the name).
- **Sidebar nav density (owner, 2026-11-04, after peec.ai), nav items only; the logo header and the theme + brand
  card footer are unchanged:** rows 30px (44px below lg, the phone drawer's touch rows), 8px side padding, 6px radius,
  1px apart; 14/500 ink text; 16px icons at a 1.5 stroke, `--color-stone-500` (ink when selected), 10px to the text.
  Selected = the `--tint` background, no left bar. Section labels 12/500 `--color-stone-500`, 16px above each section
  after the first, 4px below the label, with a ▾ caret that collapses the section (height, 200ms; none under reduced
  motion). Collapsed sections are kept per account in localStorage (`kraffic:nav:collapsed:<domain>`); a collapsed
  section still shows the current page's row.
- No yellow, no coloured pills or links, no rainbow palettes. At most three colours in any one chart. Exceptions,
  approved by the owner on 2026-11-02 and updated on 2026-11-03 (built in the app first):
  - **Brand colours in Share of voice and Visibility history:** a fixed cool palette assigned by rank (biggest share
    first, exact counts; a tie keeps the tracked order), one brand → colour map for both cards, so a brand has one
    colour on the page and it follows the engine filter. Light: `#4F46E5`, `#6366F1`, `#38BDF8`, `#818CF8`,
    `#A78BFA`, `#C084FC`, `#E879F9`. Dark, +8% lightness: `#716AEA`, `#888BF4`, `#5FCAF9`, `#A8AFFA`, `#C5B2FC`,
    `#D4ACFD`, `#EFA0FB`. Brands past the 7th share one grey "Other brands" slice (`--color-stone-500`, never
    near-white). The user's own slice is the pulled-out one. Solid fills, no gradient or glow. (This replaces the
    short-lived 2026-11-02 "every brand takes its logo's colour" rule.)
  - **Medals, in Share of voice only:** gold `#E0A200` (22px, the #1 row), silver `#9CA3AF` and bronze `#B4703A`
    (16px). The "Top share" pill text uses the darker gold `#A87700` (on gold at 12%) so it stays readable.
  - **Muted amber (`--caution`)** only for the dots of the softer report verdicts (Slower week, Slower month, Room to
    grow). The verdict's label stays neutral text. "No yellow" still applies everywhere else.

- **Opportunities → Content (owner's spec, 2026-11-04):** green ✓ / red ✕ marks on engine icons, comparison cells and
  key points (`--rep-up-fg` / `--negative`); a muted amber (`--caution`) marker on "Confirm with your team" lines and
  the slim "Draft for client review" bar; the "Waiting for publish" dot pulses (`.status-pulse`, off under reduced
  motion), the one looping animation besides the existing status dot.
- **Content, round 3 (owner, 2026-11-04):** ink and grey only. The one colour is green (`--co-improved`, #16A34A) for
  the "▲ Improved" status and ▲ improvement deltas. Logos are the brands' real ones (SiteLogo, as the Overview).
- **Lines, round 4 (owner, 2026-11-04):** the hairlines were too faint in light mode, so `--color-line` and
  `--color-line-strong` are stronger everywhere (table above; dark mode one step stronger too). Section rules use
  `--color-line-strong`.
- **Content workspace, rounds 5–7 (owner, 2026-11-04):** one accent from the brand palette, the indigo
  (`BRAND_PALETTE[0]`, dark +8%), exposed as `--co-a` on the workspace root from `utils/brandColors.js`: the writing
  checklist's turning ring and the draft's worked-example chart (the step deck that also used it is gone). The Search
  Console chart uses Sentiment's own Mix tokens (ink and `--sent-track` grey, no red). Engine logos on the page show
  only the engines that apply, in full colour (no greyed icons, no ✓ / ✕ under them), as in the Missed prompts table.
  The step's action lives in the payoff bar (ink primary button) and, once it scrolls away, the dark action dock.
- **Content workspace, focus mode, rounds 10–15 (owner, 2026-11-04):** steps 3–5 (Your data, Draft, Publish) render
  only in a centred focus panel (`workspace/FocusPanel.jsx`, a dialog: 880px, 1200px for the Draft, each capped at
  100vw − 48px; 32px from the top, as tall as its content up to 100vh − 64px; 16px radius, a soft 2-layer shadow in
  light). The page never shows those steps: it shows step 1, else step 2's layout, and its payoff bar says what step
  3–5 is doing, live, with Resume. Exceptions to §4, owner-requested and scoped to this workspace:
  - **Blur**: the page behind the focus panel blurs (8px backdrop blur) and dims (`--page` at 55% light / 65% dark),
    `.co-veil` in `index.css`. Focus mode only.
  - **Looping motion while the draft is written**: the small turning ring before "Writing the draft…" on the page bar,
    the writing view's current-step ring and its soft pulse, the outline's typing caret, the small rings on rows being
    checked. Static (or absent) under reduced motion, where the writing view is skipped.
  - **Spring travel**: the panel moves from the step band to the centre and back (FLIP, 450ms, ≤1% overshoot).
  The page bar's middle is one stakes block, the 4 engines over "Named on n of 4" (named: full colour on a small ink
  ring; missed: greyed, lit by the button). It replaces the "Engine logos show only the engines that apply" rule
  above for the bar only.
- **Content workspace, Draft step v1 (owner, 2026-11-04):** the workspace shows what `content-recommend` returns
  (`src/data/contentRecommend.js`, derivations in `pages/opportunities/draft/recommend.js`): 3 steps, Target page
  (pageRecommendation + its evidence) → Draft → Copy & publish. Search Console, Your data, Publish & track and the live
  5-step writing view are behind `?backend=full`. While writing: one honest state (the app's two loading lines, a
  shimmering outline skeleton: a loop, the owner's exception). The draft is our design, not the app drawer's: our type
  scale, our rows and rail; flags tagged by label with the score as a number; comparisons with the same labels as a
  plain grid, else short lists side by side; FAQ all open. Markdown is parsed to a text-only tree
  (`draft/markdown.js`): no raw HTML, http/https links only with rel="noopener noreferrer".
  Target page (v1): a Google page-1 rank ladder and a "what the winners have" format matrix (`workspace/TargetV1.jsx`),
  with a ~1.2s load sequence and linked hover. Round 3: "The draft adds" lists only what the draft adds (R21); 16px
  under its rows (the column ends where its content ends, nothing pinned): once a draft exists its preview (R27, Open
  draft → the Draft step in focus), else a small secondary "Write the draft →" (the bar keeps the primary); under "Your page" an "After this draft" row (R28:
  added formats as 40% ticks that draw in, a format the draft doesn't add stays a red ring). The bar's sub-line counts
  flags checked, never the weighted points (those stay in the readiness ⓘ). Engine icons come from citedPages[].engines: 'google' = organic rank (no
  icon), 'aio' = Google AI Overview, 'ai' = resolved from the prompt's answers, else a neutral "AI".
  **Light-only contrast, Content workspace only (owner):** on `.co-ws` (and its focus-panel portal), light theme:
  dividers #E3E3E3, section rules #CFCFCF, card borders #DDDDDD, muted text #6B6B6B (5.1:1), hover tint #F0F0F0, the
  matrix's empty ring #B8B8B8, the ladder's empty slot #C4C4C4. Dark is unchanged. App-wide adoption is the owner's call.
  The focus panel: min(880 | 1200px, viewport − 48px) wide, min(content, viewport − 48px) tall, centred by layout (a
  fixed grid with 24px padding); nothing left on its transform after the FLIP.

## 4. Forbidden effects

- No gradients, glows, blurs, neon, glassmorphism or background blobs (the one `linear-gradient` in the codebase is
  the loading shimmer).
- No drop shadows on charts; cards get at most the 1px `--rep-shadow` in light and a border only in dark.
- No "01 / 02" section numbering, no eyebrow labels, no decorative icons, no emoji.
- No load animations that loop, count up, pulse or bounce. Motion is ≤500ms, ease-out, once, and off under
  `prefers-reduced-motion`.

## 5. Reports (final design, v5)

Every report type (Weekly summary and its Client update, CEO summary, Competitor gap, Missing prompts, a custom
question) renders through `src/pages/reports/v5/Report5.jsx` from the view model in `src/pages/reports/v5/model.js`,
styled by `report5.css` (scoped to `.r5`). Port checklist, data per panel and every state: `docs/port-reports.md`.

**Anatomy, top to bottom**
1. **Header**: the question as the H1, one answer sentence under it, for a typed question one "How I read it" line;
   the date range and Export as menus.
2. **Main card**: KPI tabs (label, number, delta chip; numbers only) fused to the Visibility history card in
   compact mode (240px plot, legend on the controls row, best / avg labels in the right gutter). Under 3 syncs the
   chart is replaced by the Snapshot (share this sync, by engine).
3. **Panels**: tabbed lists with right-aligned value columns on a subgrid; up to 7 rows, View all expands in place
   (up to 25, then scrolls); a short list ends in a muted summary line. Layout rule: a panel that can expand, or a
   full-width block, gets its own row; short panels share a row, up to 3, stretched to the tallest.
4. **Blocks** per type: What moved (topics, gained / lost / net bars around a zero line, rows open to prompts),
   Competitors table, Open prompts.
5. **Steps**: one card per action (Next moves, Close the gap, Biggest wins, Quick wins); a card opens the 560px
   brief drawer.
6. **Footer**: the syncs, the range, the engines that ran and those that didn't.

**Reports-only exceptions** (the rest of the app keeps its own rules): the type scale `--rep-text-*` (H1 32, answer
16, KPI 14 / 32, tab and row 15, row 40px, column labels 12 uppercase, footer 13, icon 18); the blue chart line and
fade (`--plot`); coloured favicons in panel rows; sparklines in panel change columns and the Competitors table.

**Delta chips**: `+14` / `−2` on `--good-bg` / `--bad-bg` in `--rep-good` / `--rep-bad`; a lower-is-better number
(Missing) flips; no chip with one sync.

**Indicators**: one vocabulary, shared with Structured Data (`src/components/ui/Marker.jsx`): tick = all, part ring =
some, dashed ring = none / not set up / didn't run, cross = lost.

**Motion**: the chart line draws in (.9s), the area fades (.6s), row bars grow (.55s), rows and cards rise in
(.24s), View all expands in place, drawers slide in .24s over a dim; all off under reduced motion.

**Scheduled**: the All reports frame (title + Beta, brand switcher, New schedule); a 56px Upcoming strip (14 days,
W / C / G chips, today tinted); one list (When · Report · Last sent dots + first line · To; hover actions on a solid
group: Send now · Skip next, Resume when paused, Retry when failed); empty = the same list as suggestions with a
preview and Set up; New / Edit in the site's right drawer.

## Charts

- Axes always: a baseline and a left axis with round ticks (1, 2, 5, 10, 20, 25, 50, 100 steps, at most five), and
  the y-axis rounds up past the tallest bar so nothing touches the top.
- Percentages in one chart sum to 100 (largest remainder, `shares()` in `src/data/reports.js`).
- Topic charts are sorted by our lead, largest first.
- Hover fades the other columns to 35% and shows the dark tooltip; nothing else moves.
- At most three colours per chart: us, one competitor, neutral. Red is never a series colour.
- Sparklines only in a table's Trend / change column (Reports: Engines and Competitors), never in a KPI tile or a
  legend.

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
- An engine whose latest scan gave no result has no score (null), never 0: the score ring is the empty track with a
  muted "—" in the centre (no fill, no count-up); a score or count reads "—" in muted text with an ⓘ "No result from
  {Engine} in the latest scan" (`src/utils/score.js` `fmtScore`, `src/components/ui/NoResult.jsx`); its change lines
  (▲/▼ since …) are hidden; per-engine scores in menus, tables and Share of voice read "—"; charts leave a gap at that
  point (null, never a drop to 0). The All-engines score is unchanged: it averages the engines that answered. Preview:
  `?noresult=gemini&engine=gemini`.
- Two different messages, never mixed:
  - **"Not in your data: …"** for something Kraffic doesn't track (sentiment, a page's traffic, an untracked
    competitor). In the table footer, with a link to where it would live.
  - **"Not enough history yet: one scan so far"** for something tracked that needs more than one scan (changes,
    trends, sparklines). With only one scan there are no change chips, no trends and no sparklines, and this line
    replaces them.
- A number is the same everywhere it appears, and appears once as a claim.

## Known gaps (code that doesn't follow this file yet)

- The old frame (`src/pages/reports/frame.jsx`) still renders the report skeleton and drew mini charts in KPI tiles;
  v5 replaces it for reports. Decided: numbers only.
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

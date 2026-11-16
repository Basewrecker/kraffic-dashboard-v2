# Fact Check: handoff for porting

Design-only page in the mock. It is the redesign of the app's "Website facts" (Optimize → Website facts, Harsh's
feature: `lib/website-facts.js`, `lib/website-fact-claims.js`, `app/api/website-facts/route.js`, migrations 014 and 015).
Same data and the same four actions (confirm, reject, add a fact, read the website again). Everything else on the page
is presentation, or a rule derived from that data in the mock.

- Branch: `design/website-facts` (local, not pushed)
- Sample brand only (Dermasuri). No client data anywhere.

## 1. Route and files

| What | Where |
|---|---|
| URL | `/website-facts` (sidebar label "Fact Check", Beta pill). `/fact-check` is already taken by the older hidden page `pages/insights/FactCheckPage.jsx`; decide which address the port uses. |
| Page | `src/pages/facts/WebsiteFactsPage.jsx` (one file, all components) |
| Data and rules | `src/data/websiteFacts.js` (sample data + every derived rule, no React) |
| Rule tests | `src/data/websiteFacts.test.js` (13 tests, `node --test src/`) |
| Styles | `src/index.css`, the block that starts `---- Website facts`: the `--logo-plate` token, the `wf-*` keyframes and classes, `.wf-ghost` |
| Route | `src/App.jsx` (`PAGES['/website-facts']`) |
| Sidebar | `src/components/dashboard/Sidebar.jsx` (Optimize group, after Site Audit) |
| Empty-brand title | `src/components/EmptyBrand.jsx` (`TITLES['/website-facts']`) |

Shared pieces it uses, unchanged:

| Piece | File | Used for |
|---|---|---|
| `SiteLogo` | `src/components/ui/SiteLogo.jsx` | Every logo: the brand's and the sources' (Trustpilot, BBB, TIME, Money, Leaping Bunny). It loads the site's favicon from Google's favicon service at runtime; there are no logo files in the repo. |
| `EdgeTip` | `src/components/ui/EdgeTip.jsx` | Every tooltip and hover card (portal, never clipped, max 260px) |
| `BetaTag` | `src/components/ui/BetaTag.jsx` | The Beta pill |
| `CrossFade`, `GLIDE`, `useCountUp` | `src/components/ui/motion.jsx` | Text cross-fades, the shared easing, counting numbers |
| `brand` | `src/store/workspace.js` | Brand name and domain |
| Icons | `lucide-react` | Kind icons (see `KIND_ICON` in the page), `Check`, `Plus`, `X`, `ChevronDown`, `ArrowUpRight`, `RefreshCw`, `Search` |
| `card-in`, `fade-in` keyframes | `src/index.css` (shared) | Entrances |

No AI engine logos are used: this feature's data has no link to an engine.

## 2. Page structure, top to bottom

1. **Hero** (`Hero`). Brand logo, "Fact Check" + Beta, the domain link. Right: "Checked against" + the source logos, and
   the primary button ("Read website again" / "Read website" / "Reading…"). Below: "3 of 13" + "facts confirmed", then
   one segment per fact in three groups with a count under each: confirmed (filled graphite), need your call (red
   outline), ready to confirm (grey outline).
2. **Where we read it** (`PagesRead`, `SiteRing`, `SectionBlock`). Title with "Facts came from 8 pages" on the same line.
   A ring with three parts clockwise from 12 o'clock (pages a fact came from, pages read with no facts, pages that
   couldn't be read in red); only "38/40" inside it; "pages read / 2 couldn't be read" beside it. Then one compact box
   per site section that gave facts (count, name, page count, one row of its facts' logos or icons). Bottom line: the
   sections with no facts, and "Retry".
3. **2×2 grid, equal columns** (from 1024px; one column below).
   - **Your call** (`ConflictItem`, `DiffersItem`, `CallSide`, `ResolvedLine`). Numbered decisions. Header: number, the
     fact's name, "Doesn't match" in red, and "Drop this fact" at the right where it applies. Two plain columns split by a
     hairline: source label with logo, the value large, the quote, the action ("Keep this one"; the source's column has
     "Open the source ↗"). A resolved decision is one line with Undo.
   - **Checked against outside sources** (`SourcesCard`, `SourceNode`). Summary line ("2 match · 1 doesn't match · 1 not
     found"). A diagram: the brand node on the left, the sources stacked on the right, one curved connector each (solid
     graphite = matches, red and broken in the middle = doesn't match, faint dotted = not found). Beside each source: name,
     value (a mismatch shows both), link. Under it: "No outside source for 9 facts" + their icons, and
     "Checked Nov 10 · Check again".
   - **Ready to confirm** (`ReadyList`, `ReadyLine`, `Tick`). Title + count, one helper line, the single primary button
     ("Confirm all 8" / "Confirm 7"). Three labelled groups split by hairlines: Contact, Awards and accreditations, Site
     claims. Row: light tick (on by default), logo or line icon, the value with its key part heavier.
   - **Fact sheet** (`FactSheet`, `FactBlock`, `ContactLine`, `AddFact`, `KindPicker`). Header: brand logo, "Dermasuri's
     fact sheet", "3 of 13 in use", a quiet "+ Add a fact". Three sections split by hairlines, always in this order:
     In use, Your call (label in red), Waiting. Open blocks in two columns: logo or icon, the key figure, a short label.
     Contact is four plain icon + value pairs; the address takes a full row.
4. **Read, but not facts** (`NotFacts`, `NotFactRow`). A slim full-width bar with a preview of its texts. Open: one plain
   row per text (icon, text, "Page title · home page", "Use as a fact", a × to dismiss).
5. **Rejected** (`Fold`). A collapsed bar that only appears once something has been rejected. It lists the rejected
   values struck through. Not part of the approved structure; keep or drop when porting.

## 3. States

| State | How to see it | What changes |
|---|---|---|
| Nothing confirmed | Default load | 3 facts already in use (the app confirms matched claims on its own), 2 calls, 8 ready |
| Some confirmed | Untick rows, then "Confirm 7" | The unticked rows stay; a line "7 confirmed · Undo" sits at the foot of Ready to confirm |
| All confirmed | "Confirm all 8" | Ready to confirm shows its done state in the same cell: "Nothing left to confirm" while calls are open, "Nothing needs you" when none are, with "8 confirmed … Undo" |
| Calls resolved | "Keep this one" / "Drop this fact" | Each decision collapses to one line with Undo; with none open, "Nothing needs your call" fills the card |
| Everything done | `?wf=done` | All of the above at once |
| Popover open | "+ Add a fact" | A popover under the button (kind picker, field, Add fact, Cancel). No card changes height. Esc and click-outside close it, Tab stays inside, focus returns to the button |
| Bar expanded | Click "Read, but not facts" | It opens downward in place; nothing above moves |
| Reading in progress | "Read website again", "Retry" or "Check again" | Button reads "Reading…"; the hero line says which page or source; the ring shows one grey progress arc and counts up; then each source is checked in turn ("Checking…", the others dimmed). Mock timing: 60ms a page, 800ms a source |
| Empty (never read) | `?wf=empty` | Only the hero (a sentence about what reading does, "Read website") and Where we read it with an empty ring |
| Read failed | **Not built** | See section 7 |
| Page loading / error | `?state=loading`, `?state=error` | The app shell's own states, not designed for this page |

## 4. Data

The page reads exactly what `GET /api/website-facts` returns. Field names are the app's.

```ts
type Fact = {
  id: string                       // required
  category: 'identity' | 'contact' | 'page' | 'claim' | 'custom'   // required
  field:                            // required
    | 'brand_name' | 'phone' | 'email' | 'address'                 // contact
    | 'title' | 'description' | 'heading'                          // page text ("Read, but not facts")
    | 'trustpilot_rating' | 'bbb_rating' | 'award' | 'years' | 'accreditation' | 'claim'
    | 'note'                                                       // added by the user
  value: string                     // required
  status: 'DISCOVERED' | 'CONFIRMED' | 'REJECTED' | 'ADDED_BY_YOU'  // required
  source: 'WEBSITE_READ' | 'WEBSITE_CLAIM' | 'YOU'                  // required
  notes?: string | null             // the check's result, in words; the verdict is parsed from it
  evidence?: Evidence[]
}
type Evidence = {
  url: string                       // required
  page_title?: string | null
  snippet: string                   // required: the site's sentence, or the source's value
  source_type?: 'WEBSITE' | 'TRUSTPILOT' | 'BBB' | 'AWARD_PAGE'     // missing = WEBSITE
}
type Page = {
  id: string; url: string           // required
  title?: string | null
  http_status?: number | null
  words: number
  ok: boolean                       // required
  error?: string | null             // shown when ok is false
  fetched_at: string                // ISO; "Checked Nov 10" is read from it
}
```

What each section needs:

| Section | Reads | Notes |
|---|---|---|
| Hero | fact `status`; the sources of claims | Counts are of merged facts (see below) |
| Where we read it | every `Page` (`url`, `ok`, `error`, `title`); each fact's WEBSITE evidence `url` | Sections are the first folder of the path |
| Your call | claims whose note says the source differs; pairs of `years` claims that contradict | |
| Sources | claims that name a source: `notes`, the WEBSITE and outside evidence | |
| Ready to confirm | facts with `status: 'DISCOVERED'` that aren't calls and aren't page text | |
| Fact sheet | every fact that isn't rejected or page text | |
| Read, but not facts | facts with `category: 'page'` and `status: 'DISCOVERED'` | |

Actions and what they map to:

| On the page | App action today |
|---|---|
| Confirm (tick + button), "Keep this one" | `confirm` per fact |
| "Drop this fact", the other side of a contradiction, × Dismiss | `reject` per fact |
| "+ Add a fact" | `add` (`field`: note / phone / email / address) |
| "Read website again", "Retry", "Check again" | `refresh` (all three do the same thing) |
| Every **Undo** | **Mock only.** The API has no way back to `DISCOVERED` |
| "Use as a fact" | **Mock only.** The mock moves the text out of `category: 'page'` so it waits with the other facts; the app would need an action for this (or treat it as `confirm`) |

**Mock only: rules the page derives** (all in `src/data/websiteFacts.js`, each with a test). The app returns none of
these today; port the functions or move them server-side.

| Rule | Function | What it does |
|---|---|---|
| Verdict | `verdictOf` | Reads `notes`: "matches" / "appears on the list" → agrees; "site claims" / "differs" → differs; else not checked |
| Source of a claim | `sourceOf` | From the outside evidence's host, else guessed from the field or the value (TIME, Money) |
| Display logo | `markOf` | The source's logo, or a certifier named in the value (only "Leaping Bunny" is known) |
| Duplicates | `dupKey`, `mergeFacts` | The same rating or award in different words becomes one fact with its pages. Every count on the page is of merged facts |
| Contradiction | `yearConflicts` | Only for `years`: "Over N years" against "Established YYYY" |
| Buckets | `bucketsOf` | kept / rejected / notFacts / conflicts / differs / ready / cards |
| Claim inside the sentence | `claimParts` | Splits the site's sentence around the claim |
| Differing part | `diffOf` | The characters where site and source part ways ("A+" vs "A" → "+") |
| Key part of a value | `keyPart` | The number, rating or award name, set a weight heavier |
| Block text | `tileOf`, `pairTileOf` | Key figure + short label for the fact sheet ("2 million" · "bottles sold") |
| Short name | `shortName` | "TIME Best Companies 2024" for hover cards |
| Page sections | `sectionOf`, `pageSections`, `factsOnPage` | Grouping pages and finding the facts on one |
| Add-a-fact kinds | `ADD_KINDS` | Labels, hints and groups for the picker (the four kinds are the app's) |

**Mock only: sample data.** `sampleFacts`, `samplePages`, `READ_AT`. 21 facts and 40 pages for a made-up skincare
brand, built to include duplicates (TIME ×3, Trustpilot ×2, Money ×2), a mismatch (BBB), a contradiction (years) and two
unreadable pages.

## 5. Tokens

**Colour.** Graphite only, plus one red. No colour of the page's own (an earlier copper accent was removed).

| Token | Light | Dark | Used for |
|---|---|---|---|
| `--ink` / `--on-ink` | #171412 / #FFF | #ECECEC / #000 | Primary buttons only (one solid-ink element per card at most) |
| `stone-900` | | | Values, titles |
| `stone-700` | | | The ring's "facts" part, ticks |
| `stone-600` | | | All supporting text, matching connectors, filled hero segments. Nothing lighter is used for text |
| `stone-400` / `stone-300` | | | The ring's "no facts" part, dotted connector / outlines, segment tracks |
| `--negative` | #DC2626 | #F87171 | The red Sentiment uses. "Doesn't match", "Your call", the differing part, the hero's "need your call" segments, the mismatch connector, unreadable pages on the ring |
| `--color-line` | #DEDCDA | #2A2A2A | Card borders, Your call's dividers, the ring's track |
| `--div` | #EFEDEB | #1C1C1C | Hairlines inside cards |
| `--color-surface` / `--color-raised` | #FFF | #111 / #1B1B1B | Cards / popovers and tooltips |
| `--tint` | #F5F5F4 | #1A1A1A | Hover backgrounds, the tick's fill, number badges |
| `--logo-plate` (**new**) | #FFF | #FFF | A white plate behind source logos so dark marks read in dark mode |

**Type** (Manrope). Three weights and no in-between ones:

| Role | Size / line | Weight |
|---|---|---|
| Section titles | 18 / 26 | 700 |
| Hero number | 40 / 44 (`text-kpi`) | 600 |
| Section-box counts | 30 / 36 | 600 |
| Decision values | 20 / 26 | 600 |
| Fact-sheet figures | 18 / 24 (15 when longer than 18 characters) | 700 |
| Values, row text, buttons | 14–15 | 600 |
| Key part inside a 600 value | | 700 |
| Supporting text, labels | 13 / 18, 12 / 16 | 400, `stone-600` |
| Ring centre | 14 / 16, one line, never under 11px | 700 |

**Spacing and shape.** Cards: `rounded-xl` (12px), 1px `--color-line`, padding 20px (24px from `lg` on the hero and
Where we read it). Gaps between cards 12px, 16px from `md`. Inner boxes `rounded-lg` (8px). Ready to confirm rows 47px;
fact-sheet blocks 14px apart in rows and 24px in columns; hairline sections with 14px above and below.

## 6. Animations

Every animated element carries `wf-anim`; `@media (prefers-reduced-motion: reduce)` turns its animation and transition
off. The JS sequences check `reduced()` and apply their end state at once. `GLIDE` is `cubic-bezier(.2,.8,.2,1)`.

| Where | What | Duration, easing | Reduced motion |
|---|---|---|---|
| Hero | Number counts up from 0 | 600ms, ease-out cubic | Final number |
| Hero | Filled segments grow left to right, 50ms apart | 260ms, GLIDE (`wf-seg`) | Filled |
| Hero | Groups resize when counts change | 300ms, ease-out | Instant |
| Ring | The three parts sweep in in order (150ms, then 330ms apart) | 520ms, `cubic-bezier(.22,1,.36,1)` (`wf-ring`) | Drawn |
| Ring | Hovered part thickens, others dim | 150ms, ease-out | Instant |
| Ring | Centre number and the label beside it cross-fade | 130ms | Instant swap |
| Section boxes | Stagger in, 90ms apart | 200ms, ease-out (`card-in`) | Shown |
| Section boxes | Logos pop in sequence, 60ms apart | 240ms, GLIDE (`wf-pop`) | Shown |
| Section boxes | Hover lift; the hover card appears | 200ms; 200ms (`card-in`) | No lift motion |
| Your call | A side that can be kept underlines its value in red on hover | 150ms | Instant |
| Your call | Chosen side stays, the other fades; resolves after 600ms | 300ms | Resolves at once |
| Your call | Resolved line appears | 200ms (`card-in`) | Shown |
| Sources | Brand node pops; connectors draw one after another, 240ms apart | 240ms GLIDE; 420ms ease-out (`wf-draw`) | Drawn |
| Sources | The red connector breaks once drawn; the dotted one fades in | 200ms; 300ms (`fade-in`) | Shown |
| Sources | Hovered connector thickens, others dim | 150ms, ease-out | Instant |
| Sources, Your call | The differing part pulses once | 800ms, ease-out, after 1000ms (`wf-diff`) | Red, no pulse |
| Ready to confirm | Tick draws | 160ms, ease-out | Shown |
| Ready to confirm | Confirm: rows are confirmed 130ms apart and dim | 200ms opacity | All at once |
| Ready to confirm | Button number ticks | 200ms | Final number |
| Fact sheet | A block that changes section moves there | 420ms, GLIDE (Web Animations) | Jumps |
| Fact sheet | A new block fades in; the "in use" count ticks | 260ms ease-out; 300ms | Shown |
| Fact sheet | Hover background | 150ms | Instant |
| Add a fact | Popover scales and fades from the button | 160ms, ease-out (`wf-panel`) | Shown |
| Read, but not facts | Height eases open | 300ms, ease-out (grid rows) | Instant |
| Read, but not facts | Rows stagger in, 70ms apart | 200ms (`card-in`) | Shown |
| Read, but not facts | "Use as a fact": the text travels to the fact sheet | 560ms, GLIDE (`.wf-ghost`, fades in the last 15%) | No travel |
| Read, but not facts | Dismiss: the row fades; "Undo" stays 5s | 200ms | Removed at once |
| Reading | Button icon spins | 900ms, linear, looping (`wf-spin`) | Still |

## 7. Unfinished or rough

- **No "read failed" state.** Nothing is designed for a refresh that errors (the app shows a red line today). Individual
  unreadable pages are covered (the red part of the ring, "Retry").
- **No state for "read, but zero facts found".** `?wf=empty` is "never read".
- **Undo and "Use as a fact" have no API.** See section 4. Every Undo on the page is mock only.
- **Nothing is saved.** Confirm, reject and add last until reload.
- **The derived rules are heuristics.** Duplicate merging is by normalised wording; contradictions are only detected for
  years in business; the fact-sheet labels come from the words around the key figure (so "9 in 10" reads "dermatologists
  we surveyed"). They are tested, but only against the sample.
- **Certifier logos** are a one-item list (Leaping Bunny). Source logos depend on Google's favicon service at runtime.
- **Row 1 heights.** Your call and the sources card share edges because the diagram stretches to the card's height. With
  six or more sources the rows would get tight (minimum 216px for the diagram).
- **Row 2 heights.** Ready to confirm and the fact sheet meet because Ready's rows share out a few leftover pixels (1px
  at 1440, 3px at 1280). If their natural heights drift apart (many more facts on one side), rows will visibly spread or
  the fact sheet will gain space between its sections.
- **Fact sheet with an odd number of blocks before Contact** leaves the right-hand cell of that row empty.
- **Sources bottom line** wraps "Checked … · Check again" to a second line at 1280.
- **"Rejected" bar** at the very bottom is leftover from early rounds and was never reviewed in the final design.
- **Below 1024px** everything stacks in one column. Phone and tablet layouts were not reviewed.
- **Accessibility pass not done.** Ring parts and section boxes are focusable and labelled, the popover traps focus, but
  there was no screen-reader or contrast audit.
- **No browser tests** for this page; only the unit tests for the rules.
- **Unused exports** left in `websiteFacts.js`: `numeralOf`, `VERDICT_WORD`.
- **Hero total moves.** Rejecting a fact removes it from the total ("12 of 12" after dropping one of 13).
- **Mock-only internals to rename when porting:** the `wf-` class prefix and the `data-wf-from`, `data-wf-slot` and
  `data-flip` attributes (used to find elements for the travel and move animations).

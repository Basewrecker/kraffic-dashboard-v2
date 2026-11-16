# Walkthrough: handoff for the app session

Written from the mock at `75c1a7d` on branch `design/app-sync` (worktree `content-final`), 2026-11-16. The owner has said
the design is final. Nothing in the app repo was changed for this document. Everything here is mock only: none of it
exists in the app yet.

The walkthrough is: a Welcome card, five pointers on the sidebar, then six "Getting started" steps done in order. Each
step has its own run of pointers. Progress shows on a small card in the sidebar (the "stack") and on a sheet it opens
(the "board"). One card in Settings starts it all again.

**Wording rule (owner):** no text the user sees uses the words "walkthrough", "tour" or "pointers". Those words are
code names only. The user-facing name is "Getting started" / "the guide" / "the guided setup".

## 1. Files

All in `src/walkthrough/` unless a path says otherwise.

| File | What it does |
|---|---|
| `tour.js` | Every word and rule, no React: the Welcome texts, every pointer (`TOURS`), the six steps (`TASKS`), saved-progress shape, what ticks a step, where a pointer's card goes (`placeCard`), the lit area's size (`fitHole`), page matching for flows (`atOf`, `onPage`), resume and Back rules. Fully unit-tested. |
| `tour.test.js` | 14 unit tests for the rules above. |
| `motion.js` | The one motion system: easing `cubic-bezier(0.22, 1, 0.36, 1)`, fades 200ms, moves 320ms, large moves 450ms, `tween` for the lit area, reduced-motion check, and the 4x slow-motion switch. |
| `store.js` | State (a `useSyncExternalStore` store). Saved in `localStorage` under `kraffic:walkthrough`; live state (which pointer is up, board open, the step that just ticked). All actions: start/end/step a run, the "do this" click (`didStep`), ticking, resume, `restart`, `finish`. |
| `Walkthrough.jsx` | Mounted once in `src/App.jsx`. The **Welcome** card; the **pointers** (one dim layer as an SVG with the lit area cut out, the card with its caret, the arrival ring, keys); the **"do this" pointer** (lit element clickable, "Click it to continue", waits for what the click opened); the closing card; the small confirmation toast. |
| `Board.jsx` | The **board**: the sheet with the hero (step name, reason, Start/Replay, "Opens …"), the preview of what the step opens, the six-frame trail, the all-done summary. Also exports `Mini`, the grey miniatures shared with the sidebar card. |
| `GettingStarted.jsx` | The **sidebar stack card** (default export); `ConfirmSetup`, Brand Setup's Save bar for step 1; `ReplayGuide`, the **Settings card's** Replay button and its confirm dialog. |
| `Swap.jsx` | A text swap used by the card and board (out and up, in from below; `roll` for numbers). |
| `src/index.css`, block "---- Walkthrough" at the end | All `wt-*` classes and tokens: the six step colours `--wt-c1…c6`, `--wt-ease/fade/move/large`, the stack card, dots, frames, tiles, sheet, wash, reduced-motion block. |
| `src/components/ui/SiteLogo.jsx` | Gained an optional `fallback` prop (the globe shown when a logo doesn't load), as the app's SiteLogo has. |
| `src/components/dashboard/Sidebar.jsx`, `MobileNav.jsx` | Mount the stack card above the brand switcher (and in the phone menu drawer); `data-tour="nav-…"` on each sidebar group; `data-tour-near` on the theme toggle. |
| `src/components/setup/SetupPage.jsx` | `data-tour` marks on the Brand Setup cards, `<ConfirmSetup />`, and the Settings card (`#getting-started`) at the bottom of the page. |
| `src/components/prompts/PromptsPage.jsx`, `dashboard/PageHeader.jsx`, `dashboard/KpiCard.jsx` | `data-tour` marks for the Prompt Hub and Visibility Overview pointers. |
| `tests/walkthrough.browser.test.mjs` | One browser test of the whole first-time run: Welcome, the sidebar pointers, steps 1 to 6 through their flows, leaving midway and resuming, Replay, all done, the scanning state, reduced motion, phone width. |

Pages that are copies of the app's own files (Sentiment, Fact Check, Content, the Content workspace) have **no marks
added**: their pointers find elements by selectors those pages already have. In the app, add `data-tour` attributes
instead of relying on these selectors; the selectors in section 3 say which element is meant.

## 2. Welcome and the sidebar pointers

**Welcome card** (centred, page dimmed):

- Title: "Welcome to Kraffic"
- Text: "Let’s get {brand} set up. It takes about five minutes. We’ll show you where things are and what to do first." (`{brand}` is the brand's name)
- Primary button: "Start the guide"
- Second button: "Skip, I know my way around"
- Note under a hairline: "You can take it again any time from Settings."

"Start the guide" runs the five sidebar pointers. After the fifth, the board opens. The skip button closes Welcome;
the sidebar card stays.

**Pointer card, every pointer:** the text; "n of N"; **Skip**; **Back**; **Next** (the last one says **Done**). Keys:
→ ↓ Enter next, ← ↑ back, Esc closes. `{brand}` in a text is the brand's name.

**"Do this" pointer:** the lit element is clickable and nothing else on the page is. In place of Next the card shows
"Click it to continue" in grey. Back and Skip stay. The click moves on. The next pointer starts from nothing once what
the click opened has settled; until then nothing is dimmed and the page is free to use. Back is disabled on the
pointer straight after a click.

### The sidebar (run after Welcome; code name `orientation`)

| # | Page | Text (exactly as shown) | Lit element | Notes |
|---|---|---|---|---|
| 1 | `sidebar` | This is where you see how AI talks about {brand}. | `[data-tour="nav-insights"]` | card prefers: right |
| 2 | `sidebar` | This is where you write pages for the prompts you’re missing. | `[data-tour="nav-opportunities"]` | card prefers: right |
| 3 | `sidebar` | This is where you fix what holds you back: your site’s data, facts and pages. | `[data-tour="nav-optimize"]` | card prefers: right |
| 4 | `sidebar` | Your brand, your competitors and what we track live here. | `[data-tour="nav-settings"]` | card prefers: right |
| 5 | `sidebar` | This is your plan. Six steps, in order. Start with the first one. | `[data-tour="getting-started"]` | card prefers: right |

## 3. The six steps

| # | Headline on the board | Line under it | Short name (trail, sidebar card) | "Opens" | First page | Run (`TOURS` key) |
|---|---|---|---|---|---|---|
| 1 | Confirm your brand and competitors | We track what you tell us here. | Your brand | Brand Setup | `/brands` | `brand-setup` |
| 2 | Review the prompts we track | These are the questions people ask AI. | Your prompts | Prompt Hub | `/tracker` | `prompt-hub` |
| 3 | See where you stand | Your first results are in. | Where you stand | Visibility Overview | `/overview` | `overview` |
| 4 | Check what AI says about you | See the tone, and fix wrong facts. | What AI says | Sentiment, then Fact Check | `/sentiment` | `tone` |
| 5 | Create your first content | Write a page for a prompt you’re missing. | First content | Content | `/opportunities/content` | `content` |
| 6 | Reach out on one opportunity | Ask a publication to mention you. | Reach out | Sentiment, then Opportunities | `/sentiment` | `outreach` |

Steps are done in order: only the current step can be started or ticked. In every table below, "Lit element" is the CSS
selector the mock uses.

### Step 1: Confirm your brand and competitors

- **Opens:** Brand Setup (`/brands` first).
- **Ticks when:** **Save** in the bar the mock adds at the foot of Brand Setup while step 1 is open (`ConfirmSetup`; the page itself saves each change as it is made). Finishing or skipping the pointers does not tick it.
- **Needs first results:** no.

| # | Page | Text (exactly as shown) | Lit element | Notes |
|---|---|---|---|---|
| 1 | `/brands` | Check these are right. We look for this name in AI answers. | `[data-tour="setup-brand"]` | card prefers: bottom |
| 2 | `/brands` | Add other names people use for {brand}, so we don’t miss mentions. | `[data-tour="setup-names"]` | card prefers: bottom |
| 3 | `/brands` | Add the brands you compete with. We compare you with them. | `[data-tour="setup-competitors"]` | card prefers: bottom |
| 4 | `/brands` | Save when it looks right. You can change it later. | `[data-tour="setup-save"]` | card prefers: top |

### Step 2: Review the prompts we track

- **Opens:** Prompt Hub (`/tracker` first).
- **Ticks when:** The last pointer's **Done** (Skip or Esc does not tick it).
- **Needs first results:** no.

| # | Page | Text (exactly as shown) | Lit element | Notes |
|---|---|---|---|---|
| 1 | `/tracker` | These are the questions we ask AI about {brand}. Open one to read the answers. | `#tracked-prompts` (top 319px only) | card prefers: bottom |
| 2 | `/tracker` | Add a question your customers would ask. | `[data-tour="prompts-add"]` | card prefers: bottom |
| 3 | `/tracker` | Or let us find prompts from your site, or import a list. | `[data-tour="prompts-find"]` | card prefers: bottom |

### Step 3: See where you stand

- **Opens:** Visibility Overview (`/overview` first).
- **Ticks when:** **Opening Visibility Overview** (Start is enough; the pointers are extra). If pointers are up, the tick is held until they close.
- **Needs first results:** yes (shows “Waiting for your first results” while the first scan runs).

| # | Page | Text (exactly as shown) | Lit element | Notes |
|---|---|---|---|---|
| 1 | `/overview` | This is how often AI names {brand} for your prompts. | `[data-tour="overview-score"]` | card prefers: bottom |
| 2 | `/overview` | Visible means AI names you. Missed means it names someone else. | `[data-tour="overview-prompts"]` (all matches, lit as one box) | card prefers: bottom |
| 3 | `/overview` | See one AI engine at a time. | `[data-tour="overview-engine"]` | card prefers: bottom |
| 4 | `/overview` | This shows how your visibility changes over time. | `#history` | card prefers: right |

### Step 4: Check what AI says about you

- **Opens:** Sentiment, then Fact Check (`/sentiment` first).
- **Ticks when:** The last pointer's **Done** on Fact Check (pointer 7 of 7).
- **Needs first results:** yes (shows “Waiting for your first results” while the first scan runs).

| # | Page | Text (exactly as shown) | Lit element | Notes |
|---|---|---|---|---|
| 1 | `/sentiment` | This is the tone of the sources AI relies on when it talks about {brand}. | `section[aria-label="Sentiment spectrum"] > div:first-child > div:first-child` | card prefers: right |
| 2 | `/sentiment` | Each logo is a publication, placed by its tone. | `section[aria-label="Sentiment spectrum"] > div:first-child > div.min-w-0` | card prefers: bottom |
| 3 | `/sentiment` | Open any page to see what it says about you. | `#pages-on-h, li[data-row="sync"]` (all matches, lit as one box) | card prefers: left |
| 4 | `/sentiment` | Neutral and mixed pages are your chance to win a better mention. This opens the list. | `.k-mo-btn` | card prefers: bottom |
| 5 | `/website-facts` | These are the facts we found on your site, and whether AI agrees with them. | `[data-fc-hero]` | card prefers: bottom |
| 6 | `/website-facts` | Compare what you say with what others say. | `[data-fc-box]` (all matches, lit as one box) (top 300px only) | card prefers: top |
| 7 | `/website-facts` | See why a fact doesn’t match, then fix it on your page. | `li.fc-row:has([data-fc-fix]) ▸ [data-fc-why-link], [data-fc-fix]` (all matches, lit as one box) | opens `[data-fc-box="site"] [data-fc-more][aria-expanded="false"]` first; card prefers: bottom |

### Step 5: Create your first content

- **Opens:** Content (`/opportunities/content` first).
- **Ticks when:** **The draft appearing** (pointer 9 is reached). The tick is held until the pointers close, so it is seen on the board.
- **Needs first results:** yes (shows “Waiting for your first results” while the first scan runs).

| # | Page | Text (exactly as shown) | Lit element | Notes |
|---|---|---|---|---|
| 1 | `/opportunities/content` | These are prompts where AI doesn’t name you yet. | `#missed-prompts` (top 340px only) | card prefers: bottom |
| 2 | `/opportunities/content` | This shows where each page is: to create, draft ready, waiting to publish, or being checked. | `#missed-prompts thead th:last-child, #missed-prompts tbody td:last-child` (all matches, lit as one box) (top 340px only) | card prefers: left |
| 3 | `/opportunities/content` | Open this prompt to start. | `#missed-prompts tbody tr` containing “Create content” | **do this**; card prefers: bottom |
| 4 | `/opportunities/content/*` | This shows who AI names today and what your draft will add. | `[data-step-head]` | card prefers: bottom |
| 5 | `/opportunities/content/*` | Start here. We write a draft for your page. | `.co-head-btn button` | **do this**; card prefers: bottom |
| 6 | `/opportunities/content/*` | Add your own numbers or documents. They make the page yours. | `.co-panel [data-step="data"] .border-dashed` | card prefers: top |
| 7 | `/opportunities/content/*` | We write in your brand’s voice. Check or change it here. | `.co-panel [data-guidelines-used]` | card prefers: bottom |
| 8 | `/opportunities/content/*` | Create the draft. | `.co-panel button` containing “Write the draft” | **do this**; card prefers: bottom |
| 9 | `/opportunities/content/*` | Read it and change anything you like. | `.co-panel article[aria-label="Draft"]` (top 420px only) | ticks the step; card prefers: right |
| 10 | `/opportunities/content/*` | Copy it or download it, then publish it on your site. | `.co-panel button` containing “Copy content” / “More” (all matches, lit as one box) | card prefers: top |
| 11 | `/opportunities/content/*` | After you publish, we check your page and watch the AI engines for four weeks. | — | closing card (no lit element); card prefers: centre |

### Step 6: Reach out on one opportunity

- **Opens:** Sentiment, then Opportunities (`/sentiment` first).
- **Ticks when:** **Clicking the first row's Reach out button** (pointer 4, "do this").
- **Needs first results:** yes (shows “Waiting for your first results” while the first scan runs).

| # | Page | Text (exactly as shown) | Lit element | Notes |
|---|---|---|---|---|
| 1 | `/sentiment` | Neutral and mixed pages are your chance to win a better mention. Open the list. | `.k-mo-btn` | **do this**; card prefers: bottom |
| 2 | `/sentiment` | These publications mention you, but not clearly in your favour. | `#missed-opportunities` (top 340px only) | card prefers: top |
| 3 | `/sentiment` | These AI engines use this page as a source. | `#missed-opportunities thead tr:first-child th:nth-child(2), #missed-opportunities tbody td:nth-child(2)` (all matches, lit as one box) (top 340px only) | card prefers: right |
| 4 | `/sentiment` | This opens the best way to contact the publication. | `#missed-opportunities a.k-reach` | **do this**, ticks the step, link stays (mock); confirmation: “Reach out opened. In this mock the link stays on this page.”; card prefers: left |

### No page hints

There is no "?" beside page titles (removed on the owner's instruction, 2026-11-16). The Settings card is the only way
back in. `TOURS` still holds `sentiment` and `fact-check` as separate lists only because step 4's run (`tone`) is built
from them; nothing starts them on their own.

### Rules for every run

- After a step's run ends, the board opens again, showing the step ticking and the next step sliding in.
- **Replay** on a done step runs the same pointers from the first one. It never ticks anything.
- Leaving midway (Skip, Esc, or going to another page) leaves the step not done. **Start** then resumes from the first
  pointer of the page the run stopped on. The mock keeps this only in memory: a reload forgets it.
- Never more than one pointer on screen. The card never covers the lit element.
- A pointer whose element isn't on the page is passed over after 2.5 seconds. A pointer that follows a click waits for
  as long as it takes; if a later pointer's element shows up first (the draft was already written), it goes to that one.
- Step 5, between pointers 5 and 6: for a brand with no guidelines, the click opens the one-time Brand Guidelines screen.
  No pointer is up on it; pointer 6 starts when "Add your data" appears.
- Step 4, pointer 7: "Fix it" only exists in Fact Check's full list, so the pointer opens that list first.

## 4. States, with screenshots

All screenshots are in `docs/walkthrough-handoff/`, light and dark, taken at 1440 by 900 (the 0.8 UI scale applies).

### The board

The sheet has one fixed height in every state. Top row: "Getting started", "n of 6", six segments, close. Hero left:
headline, line, then **Start** (or **Replay**) with "Opens" and the page names. Hero right: the preview; clicking it is
Start. Trail: six frames. A done frame shows a tiny visual of its result, an ink tick and its result line; a frame not
done shows a grey miniature; the current one says "Up next" in its step's colour. Only the frame shown in the hero has
an outline (1.5px, its step's colour). Upcoming frames can't be clicked.

| State | Light | Dark |
|---|---|---|
| Step 1 current (0 of 6) | ![Step 1 current (0 of 6), light](walkthrough-handoff/board-step-1-brand-light.png) | ![Step 1 current (0 of 6), dark](walkthrough-handoff/board-step-1-brand-dark.png) |
| Step 2 current | ![Step 2 current, light](walkthrough-handoff/board-step-2-prompts-light.png) | ![Step 2 current, dark](walkthrough-handoff/board-step-2-prompts-dark.png) |
| Step 3 current | ![Step 3 current, light](walkthrough-handoff/board-step-3-results-light.png) | ![Step 3 current, dark](walkthrough-handoff/board-step-3-results-dark.png) |
| Step 4 current | ![Step 4 current, light](walkthrough-handoff/board-step-4-tone-light.png) | ![Step 4 current, dark](walkthrough-handoff/board-step-4-tone-dark.png) |
| Step 5 current | ![Step 5 current, light](walkthrough-handoff/board-step-5-content-light.png) | ![Step 5 current, dark](walkthrough-handoff/board-step-5-content-dark.png) |
| Step 6 current | ![Step 6 current, light](walkthrough-handoff/board-step-6-outreach-light.png) | ![Step 6 current, dark](walkthrough-handoff/board-step-6-outreach-dark.png) |
| A done step picked from the trail: Replay | ![A done step picked from the trail: Replay, light](walkthrough-handoff/board-done-step-picked-replay-light.png) | ![A done step picked from the trail: Replay, dark](walkthrough-handoff/board-done-step-picked-replay-dark.png) |
| First scan running: “Waiting for your first results”, no Start | ![First scan running: “Waiting for your first results”, no Start, light](walkthrough-handoff/board-waiting-for-results-light.png) | ![First scan running: “Waiting for your first results”, no Start, dark](walkthrough-handoff/board-waiting-for-results-dark.png) |
| All done: “You’re set up”, the six frames as a 3 by 2 grid, Done | ![All done: “You’re set up”, the six frames as a 3 by 2 grid, Done, light](walkthrough-handoff/board-all-done-light.png) | ![All done: “You’re set up”, the six frames as a 3 by 2 grid, Done, dark](walkthrough-handoff/board-all-done-dark.png) |

All done: headline "You’re set up", line "Kraffic keeps checking AI for you. Come back each week to see what changed.", button **Done**, and in the
trail's place "You can take the guided setup again from Settings." Done closes the board and sends the sidebar card away.

A step ticking (not a still): the frame's tile fills with its result, the tick pops in, numbers count up, the hero
swaps to the next step, the segment fills. On the last step the six frames rise from the trail and settle as the grid.

### The sidebar card (the "stack")

One row. Left: up to three cards (48 by 40, 9px corners): the current step's tinted frame with its miniature on top, the
next two steps' colours peeking behind at 5 and 11 degrees. Right: "Getting started", "Next: {short name}" with the name
in ink, six 7px dots (done: filled in the step's colour; current: a ring; later: light grey). Hover fans the stack out.
A step finishing: the top card slides up and fades, the next turns to the front, the dot fills (450ms), then the board
grows out of the top card.

| State | Light | Dark |
|---|---|---|
| 0 of 6 | ![0 of 6, light](walkthrough-handoff/card-0-of-6-light.png) | ![0 of 6, dark](walkthrough-handoff/card-0-of-6-dark.png) |
| 1 of 6 | ![1 of 6, light](walkthrough-handoff/card-1-of-6-light.png) | ![1 of 6, dark](walkthrough-handoff/card-1-of-6-dark.png) |
| 2 of 6 | ![2 of 6, light](walkthrough-handoff/card-2-of-6-light.png) | ![2 of 6, dark](walkthrough-handoff/card-2-of-6-dark.png) |
| 3 of 6 | ![3 of 6, light](walkthrough-handoff/card-3-of-6-light.png) | ![3 of 6, dark](walkthrough-handoff/card-3-of-6-dark.png) |
| 3 of 6, hover (fanned) | ![3 of 6, hover (fanned), light](walkthrough-handoff/card-hover-light.png) | ![3 of 6, hover (fanned), dark](walkthrough-handoff/card-hover-dark.png) |
| 4 of 6 (two cards left) | ![4 of 6 (two cards left), light](walkthrough-handoff/card-4-of-6-light.png) | ![4 of 6 (two cards left), dark](walkthrough-handoff/card-4-of-6-dark.png) |
| 5 of 6 (one card left) | ![5 of 6 (one card left), light](walkthrough-handoff/card-5-of-6-light.png) | ![5 of 6 (one card left), dark](walkthrough-handoff/card-5-of-6-dark.png) |
| First scan running: “Waiting for your first results” | ![First scan running: “Waiting for your first results”, light](walkthrough-handoff/card-waiting-light.png) | ![First scan running: “Waiting for your first results”, dark](walkthrough-handoff/card-waiting-dark.png) |
| All done: “You’re set up”, “All six steps done” | ![All done: “You’re set up”, “All six steps done”, light](walkthrough-handoff/card-all-done-light.png) | ![All done: “You’re set up”, “All six steps done”, dark](walkthrough-handoff/card-all-done-dark.png) |

All done: the card fades and the sidebar closes the gap, either at once on the board's **Done**, or six seconds after
the board is closed without it. At the 0.8 UI scale the "Next:" line wraps to a second line for longer names; it is
never cut.

### The rest

| What | Light | Dark |
|---|---|---|
| Welcome | ![Welcome, light](walkthrough-handoff/welcome-light.png) | ![Welcome, dark](walkthrough-handoff/welcome-dark.png) |
| A pointer (sidebar, 1 of 5) | ![A pointer (sidebar, 1 of 5), light](walkthrough-handoff/pointer-light.png) | ![A pointer (sidebar, 1 of 5), dark](walkthrough-handoff/pointer-dark.png) |
| A “do this” pointer (step 5, 3 of 11) | ![A “do this” pointer (step 5, 3 of 11), light](walkthrough-handoff/pointer-do-this-light.png) | ![A “do this” pointer (step 5, 3 of 11), dark](walkthrough-handoff/pointer-do-this-dark.png) |
| The Settings card | ![The Settings card, light](walkthrough-handoff/settings-card-light.png) | ![The Settings card, dark](walkthrough-handoff/settings-card-dark.png) |
| Replay’s confirm | ![Replay’s confirm, light](walkthrough-handoff/settings-replay-confirm-light.png) | ![Replay’s confirm, dark](walkthrough-handoff/settings-replay-confirm-dark.png) |

**Settings card:** at the bottom of Brand Setup (`/brands`, `#getting-started`). Title "Getting started", line "Take the
guided setup again, from the start.", button "Replay". Replay asks once, "Start the guide again from the beginning?"
with "Replay" and "Cancel", then clears progress and starts from the Welcome card. There is no other way back in: no
sidebar item, no brand-menu item, no options on the board, no switches.

**Phone width:** the pointer card is a sheet across the bottom of the window (at the top when the lit element is down
there), with no caret; the board is full screen; the stack card is in the menu drawer.

**Reduced motion:** fades only. No fan, no slide, no gliding lit area.

## 5. Sample data in the mock that needs real data in the app

| Where | Mock | App needs |
|---|---|---|
| Progress | `localStorage` key `kraffic:walkthrough`: `{ show, welcome, done: [step ids], scanning, closed }`, per browser | Saved per user (or per brand: owner to decide), on the server |
| Who sees Welcome | Only `?walkthrough=new`, or Replay in Settings | A real first-sign-in rule |
| `scanning` (steps 3 to 6 wait) | A demo flag | The brand's real "first scan finished" state |
| Step 1 tick | The mock's own Save bar (`ConfirmSetup`), because the mock's Brand Setup saves as you type | The app's real save or confirm on Brand Setup |
| Step 5 tick | The mock's draft is a stand-in that appears after a loader of about six seconds | The real draft arriving from the content generator |
| Step 6 tick | The link is stopped from opening and a toast says "Reach out opened. In this mock the link stays on this page." | Let the link open as normal; tick on the click. Drop the toast or reword it |
| Board previews and frame results | Mock data: brand and competitors (`TRACKED_BRANDS`, `account`), tracked prompts and which engines name the brand (`trackedPrompts`), visibility score and its history (`getBrandView`, `getHistory`), sentiment score, counts and pages (`sentimentFor`), the first missed prompt and who is cited (`missedPrompts`), the first neutral or mixed page and its reach-out label (`reachOutFor`) | The same values from the app's own data for the current brand |
| Frame result lines | "3 competitors", "152 tracked", "Visibility 73", "23 pages read", "1 draft", "1 sent" from mock numbers; "1 draft" and "1 sent" are fixed | Real counts |
| Content rows, Opportunities rows, facts | The mock's sample brand (Dermasuri) and sample publications | Real rows. The pointers pick "the first row with status Create content" and "the first Reach out button": both need a fallback when there is none (the mock passes over a missing element after 2.5s) |
| Brand Guidelines one-time screen | Shown between step 5's pointers 5 and 6 when the brand has none | Same behaviour in the app if that screen exists there |
| Resume point of a run left midway | Kept in memory only | Owner to decide whether it should survive a reload |

## 6. The `?walkthrough=` demo switches: do not port as they are

These exist only so states can be looked at and tested. Each one overwrites saved progress when the page loads. In the
app they would let anyone reset or fake progress from a link.

| Switch | What it does in the mock |
|---|---|
| `?walkthrough=new` | First time: Welcome up, nothing done |
| `?walkthrough=slow` | The same, with every animation four times slower (`motion.js`) |
| `?walkthrough=reset` | Clears everything; the sidebar card is hidden |
| `?walkthrough=progress` | 2 of 6 done |
| `?walkthrough=midway` | 3 of 6 done |
| `?walkthrough=scanning` | 2 of 6 done, a first scan running |
| `?walkthrough=done` | 6 of 6, the board open on the last screen |

Also mock only: `window.__walkthrough` (dev console helper in `store.js`), and the rule that the page a switch lands on
doesn't tick a step as it draws (`landing` in `store.js`). If the app wants slow motion for review, put it behind a
dev-only flag.

## 7. Known gaps

- Once all six steps are done, the summary's frames can't be clicked, so there is no Replay of a single step; the
  Settings card replays everything.
- Step 5's brief said "Create content" for the prompt page's button; the real label is "Add brand guidelines" (no
  guidelines yet) or "Add your data". The draft button is "Write the draft". "Download" is inside "More", so pointer 10
  lights "Copy content" and "More".
- The five Content browser tests that were failing (`saved-draft`, `search-match`, `two-spots`, `your-data`,
  `search-queries-table`) were updated to the current layout on 2026-11-16. Not part of the walkthrough, but one
  mock-only switch came with it: `?co=searches` shows the Google searches section the app hides, so its tests still run.
  Don't port that switch.

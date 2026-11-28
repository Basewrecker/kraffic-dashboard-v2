# Billing: the design round (mock)

Date: 2026-11-28. Built from `docs/design-handoff/BILLING-BRIEF.md` (app repo, branch `docs/design-handoff`).
Everything here is in the mock only. Nothing was changed in the app repo.

The eight screens were designed on the brief's **recommended defaults**. Every element that depends on an open decision
or an open conflict is wrapped in `<Pending n="…">`; add `&notes=1` to any address to see them outlined and tagged.

## How to look at it

Run the mock (`npm run dev`) and open any address below. The full list of states, one address each, is
`src/billing/checklist.js` (167 states), and `/billing-states` in the mock lists them as links.
Screenshots of every state at 1440 and 390 wide, light and dark, are in
`~/Documents/kraffic-worktrees/billing-screenshots/` (not in git: about 650 images).

The switches (they stick for the browser tab until `?billing=off`):

| Switch | Values |
|---|---|
| `billing` | `live` (prices and card payments) · `off` (default: today's page, no prices) |
| `sub` | `none` · `demo` · `pending` · `active` · `scheduled` · `cancelling` · `pastdue` · `ended` · `demo-ended` |
| `ended` / `kept` | `nonpay` · `cancel` · `refund` / `past` |
| `who` / `userId` | `member` (a team member) / any value (an admin's View as) |
| `seller` | `paused` (can't take payments) · `test` (with `as=admin`: the admin sees prices) |
| `days` | 14 … 0, for past due |
| `tab` | `plans` · `billing` |
| `notes` | `1` outlines every pending-decision element |

## The screens and their files

| # | Screen | Address | Files |
|---|---|---|---|
| 1 | Plans with prices | `/plans?billing=live&sub=…` | `src/pages/plans/PlansPage.jsx`, `src/plan/catalog.js` |
| 2 | The review step | `…&review=<plan>` (dialog), `/plans/review?plan=<plan>` (page) | `src/pages/plans/ReviewModal.jsx` |
| – | Stripe's pages (placeholder, not a design) | `/plans/pay?kind=checkout|invoice|card` | `src/pages/plans/PayPlaceholder.jsx` |
| 3 | The return page | `/plans/return?show=…` | `src/pages/plans/ReturnPage.jsx` |
| 4 | The Billing tab | `/plans?billing=live&tab=billing&sub=…` | `src/pages/plans/BillingTab.jsx` |
| 5 | Past-due banner, demo notice, paused controls | any page with `?billing=live&sub=pastdue` | `src/billing/Shell.jsx` (`ShellNotices`), `src/plan/LimitTip.jsx` |
| 6 | Ended | `/plans?billing=live&sub=ended` | `src/billing/Shell.jsx` (`ReducedShell`, `AccessEnded`), `BillingTab.jsx` (`EndedCard`) |
| 7 | Workspace Payments | `/console/white-label/acme/payments?st=…` | `src/pages/console/PaymentsPage.jsx` |
| 8 | Superadmin billing | `/console/billing?tab=…` | `src/pages/console/BillingAdminPage.jsx` |

Shared: `src/billing/format.js` (money and dates, tested), `src/billing/state.js` (the sample states),
`src/billing/ui.jsx` (pills, tabs, banner, buttons, split button, renewal terms), `src/billing/consoleData.js`,
`src/billing/checklist.js`.

The click-through: Plans (`/plans?billing=live&sub=none`) → Subscribe → Review → Continue to payment → the placeholder
("Payment succeeds") → Return (paid) → Manage subscription → the Billing tab. Branches: the placeholder's "Card
declined" → Return (declined) → Try again; the past-due banner's Pay now → the placeholder → back with "Payment
received. Thank you."

## New components proposed

None of the brief's listed components was missing a fit. Three small things were added, each built from existing ones:

| Added | Why |
|---|---|
| `SplitBtn` (`billing/ui.jsx`) | The brief names the split button from Connect your data; the mock's main branch didn't have a shared one yet. It is the ink button plus `ActionMenu` (portal). When the Connect and Research dialog's split button lands from the sync, the two should become one component. |
| `StatusPill` with three tones | One component for the neutral pill, the green Connected / Active pill and the neutral pill with a red dot. The mock had the looks, not a shared component. |
| `Pending` + `?notes=1` | Review tooling only: marks pending-decision elements. Not for the app. |

## Elements that follow a pending decision

| Decision | Default designed | Where it shows |
|---|---|---|
| 6 When clients see prices | Only where billing is live | The plan card's big number (`$3,500 /mo`); the review step's Price row; the Billing tab's price line |
| 7 Currency, tax | USD, no tax line | "Charged in US dollars." in the review step |
| 9 When a change starts | At the next renewal, no part charge | "Starts Dec 27. No charge today." under Switch at renewal; the scheduled row; step 2 of Change plan |
| 10 What's paused | Dashboard readable; no scans, Sync, new prompts or brands | The banner's "Until then…" line; the disabled controls on Prompt Hub and Brand Setup |
| 11 Grace length | 14 days | "11 days left to pay" in the banner; "Pay by Dec 8" on the Billing tab |
| 12 What Ended keeps | Data 90 days, invoices for good | The ended card's "kept until" line; the cancel dialogs; the demo-ended card |
| 13 How long a checkout is held | 24 hours | "It's held until Nov 28, 2:14 PM"; the return page's Expired state |
| 14 The demo | Stays, leads into checkout | "See plans" on the demo notice where billing is live |
| 17 Public plans page | Not drawn | See "Not done" |
| C Refund / lost dispute | Ends access | The ended card's refund wording and "Talk to us" |
| Q6 Late payment moves the renewal | Yes | "Your plan now renews Dec 27." after paying |
| Q7 Downgrade over the limits | Keep everything, block adding | The notice in Change plan, step 2 |
| Harsh: does the seller see the minimum | No | The price editor leaves room for one helper line (visible with `?notes=1`) |

## The 9 open conflicts: what was designed

1. **Console style.** Screens 7 and 8 are in the locked design system, inside a plain stand-in frame. The old console wasn't touched or imitated.
2. **Demo banner.** Built on the plain sentence in a graphite card.
3. **Expired page.** An ended account signs in to the Plans page in a reduced shell (logo, Sign out). Today's "Account access ended" card is kept only for a demo that expired where billing isn't live, restyled on tokens.
4. **Support address.** The renewal terms use the workspace's address (`WORKSPACE.support`).
5. **Used above the limit vs the downgrade warning.** The warning is a sentence about the new plan ("You're using more than Visibility includes: 152 prompts (Visibility has 100)"), not a "used of limit" pair.
6. **Checklist.** Four lines: connected, verified, a priced plan shown, and the self-confirmed "Stripe's own failed-payment emails are off" with a tick box and "Show me where".
7. **Site Audit's "API access" dialog.** Not touched. No billing screen mentions a key.
8. **The mock's old Billing page.** It had two pages, now unrouted (`src/pages/billing/*`; `/billing` redirects to `/plans`): a Billing page (plan, usage rows, invoices, payment method, a switch-plan drawer) and "Choose a plan" (prices, a Monthly / Yearly switch, "We prorate the difference"). Yearly billing and proration contradict the brief, so the Billing tab was designed fresh. The old files can be deleted once this round is accepted.
9. **Who uses the Payments page.** Whoever opens it acts for the workspace. Nothing in the page depends on the console frame.

## Open questions back to the owner

- Does "Paid" on an invoice count as an active state (green)? Drawn neutral.
- Where billing is live the card's big number is the price and the prompt count leads "This includes:". The compare table's header still says "200 prompts". Is that the wanted place for the prompts?
- Does the seller see the minimum price? (Harsh.)
- The wording for a cancellation asked for while payments are disconnected ("We've received your cancellation. We'll confirm it by email as soon as it's in place."): shown in the cancel dialog, marked "owner sign-off".
- **New: the renewal terms on the Plans page.** They sit under the plan cards before any plan is picked, so there is no single price to name. The page says "renews automatically for your plan's price every month"; the review step names the amount. OK?
- **New: the overdue invoice's amount.** On the Billing tab in past due, the amount is in the plan card's sentence and also in the overdue invoice's row. The row keeps it (a table row without its amount reads as missing data). The banner stays hidden there, as the brief says.
- **New: the pending card.** While a payment is pending, the other cards' buttons read "Subscribe" and are off. The brief says "others disabled" without a label.
- **New: "Card on file" for a team member** has no Update card button and no helper line.

## Notes for the port

New mock files: everything under `src/billing/`, `src/pages/plans/` (`PlansRouter`, `PlansPage`, `BillingTab`,
`ReviewModal`, `ReturnPage`), `src/pages/console/`, `src/plan/` (from the sync).

What the mock fakes and the app must supply:

- The account's state, plan, price, dates, invoices and card: all from `billing/state.js` (URL switches). The card's brand and last four must be read live when the Billing tab opens.
- Every action is a URL change with a short timer ("Opening…" 700 to 900ms). The app waits for its server.
- "Opening…" then `/plans/pay`: a placeholder for the provider's pages. Not to be ported.
- The price editor's refusal compares with a made-up floor in `consoleData.js`. In the app the server refuses; the page never knows the minimum.
- Workspace name, legal name, support address and owner email: `WORKSPACE` in `billing/state.js`.
- The console frame (`ConsoleShell.jsx`) is a stand-in.
- Plan names, counts, feature rows and prices are data (`plan/catalog.js`, `PRICES`); the three Self-serve plans are the mock's own samples.

## Not done, or not checked

- **A signed-out visitor on a public plans page** (decision 17) isn't drawn.
- **Reduced motion** was coded (fades only, final states) but not looked at in a browser.
- **Keyboard**: focus rings, tab order, Esc and focus return come from the shared Modal, drawer, menu and popover; not walked through screen by screen.
- **1024 and 1600 wide** weren't checked; 1440 and 390 were.
- The "Would block" and "Reason / Workspace" filters on screen 8 are drawn but don't filter the sample rows.
- Screens 7 and 8 weren't tuned for 390 beyond not breaking (they're staff pages).

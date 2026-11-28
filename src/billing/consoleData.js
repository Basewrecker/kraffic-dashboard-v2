// Sample data for billing's two console pages (screens 7 and 8). Samples only: no real workspace, client or price.
export const SELLER = { name: 'Acme Agency', host: 'app.acme.com', legalName: 'Acme Agency LLC', connectedBy: 'dana@acme.com', connectedOn: '2026-11-27', liveSince: '2026-11-27', subscribers: 14 }
// one row per package: the limits are the product's (fixed), the price is the workspace's; floor: superadmin view only
export const PRICE_ROWS = [
  { id: 'visibility', name: 'Visibility', prompts: 100, competitors: 3, logins: 2, price: 2000, shown: true, subscribers: 2, floor: 1500 },
  { id: 'growth', name: 'Growth', prompts: 200, competitors: 5, logins: 3, price: 3500, shown: true, subscribers: 12, floor: 2500 },
  { id: 'authority', name: 'Authority', prompts: 300, competitors: 10, logins: 5, price: 6000, shown: true, subscribers: 0, floor: 4500 },
  { id: 'enterprise', name: 'Enterprise', prompts: 500, competitors: null, logins: null, price: null, shown: false, subscribers: 0, floor: null },
]
export const PAYMENTS = [
  ['2026-11-27', 'Acme Skincare', 'Growth', 3500, 'Paid'], ['2026-11-27', 'Northwind Dental', 'Growth', 3500, 'Paid'], ['2026-11-26', 'Lumen Skin', 'Visibility', 2000, 'Paid'],
  ['2026-11-25', 'Harbor Mortgage', 'Growth', 3500, 'Failed'], ['2026-11-24', 'Pine & Oak Homes', 'Growth', 3500, 'Paid'], ['2026-11-22', 'Skylux Travel', 'Visibility', 2000, 'Paid'],
  ['2026-11-21', 'Eco Pet Kind', 'Growth', 3500, 'Refunded'], ['2026-11-20', 'ASAP Tickets', 'Growth', 3500, 'Paid'], ['2026-11-18', 'Blue Kettle Tea', 'Growth', 3500, 'Paid'], ['2026-11-17', 'Verde Juice', 'Growth', 3500, 'Paid'],
].map(([date, client, plan, amount, result]) => ({ date, client, plan, amount, result }))

// ---- screen 8
export const SELLERS = [
  { id: 'meridian', name: 'Meridian Growth', host: 'app.meridiangrowth.com', connection: 'Disconnected', mode: 'Live', active: 6, overdue: 2, live: '2026-10-02', problem: 'We can no longer reach the Stripe account.' },
  { id: 'acme', name: 'Acme Agency', host: 'app.acme.com', connection: 'Connected', mode: 'Live', active: 12, overdue: 1, live: '2026-11-27', problem: null },
  { id: 'house', name: 'Auden AI', host: 'app.auden.ai', connection: 'Connected', mode: 'Live', active: 31, overdue: 0, live: '2026-09-15', problem: null },
  { id: 'brightside', name: 'Brightside Digital', host: 'geo.brightside.co', connection: 'Restricted', mode: 'Live', active: 4, overdue: 0, live: '2026-10-20', problem: 'Stripe needs a document to verify the business.' },
  { id: 'fernhill', name: 'Fernhill Media', host: 'app.fernhill.media', connection: 'Not verified', mode: 'Test mode', active: 0, overdue: 0, live: null, problem: 'Stripe still needs details.' },
  { id: 'koto', name: 'Koto Studio', host: 'ai.koto.studio', connection: 'Not connected', mode: 'Off', active: 0, overdue: 0, live: null, problem: null },
]
const S = (client, email, seller, plan, price, state, date, flags = []) => ({ id: email, client, email, seller, plan, price, state, date, flags })
export const SUBS = [
  S('Acme Skincare', 'owner@acmeskincare.com', 'Acme Agency', 'Growth', 3500, 'Active', '2026-12-27'),
  S('Northwind Dental', 'ops@northwinddental.com', 'Acme Agency', 'Growth', 3500, 'Active', '2026-12-27', ['Scheduled: Visibility']),
  S('Harbor Mortgage', 'lee@harbormortgage.com', 'Acme Agency', 'Growth', 3500, 'Overdue', '2026-12-09'),
  S('Lumen Skin', 'hi@lumenskin.co', 'Auden AI', 'Visibility', 2000, 'Cancelling', '2026-12-26'),
  S('Pine & Oak Homes', 'sam@pineandoak.com', 'Meridian Growth', 'Growth', 3200, 'Active', '2026-12-02', ['Renewal owed']),
  S('Skylux Travel', 'ana@skyluxtravel.com', 'Auden AI', 'Authority', 6000, 'Active', '2026-12-22', ['Override']),
  S('Blue Kettle Tea', 'team@bluekettle.com', 'Brightside Digital', 'Growth', 3400, 'Pending', '2026-11-28'),
  S('Verde Juice', 'maria@verdejuice.com', 'Auden AI', '—', null, 'Demo', '2026-12-18'),
  S('Eco Pet Kind', 'jo@ecopetkind.com', 'Meridian Growth', 'Growth', 3200, 'Ended', '2026-11-21'),
  S('ASAP Tickets', 'billing@asaptickets.com', 'Auden AI', 'Authority', null, 'Set by hand', '2027-01-31'),
]
export const JOBS = [
  ['Webhook catch-up', 'every 5 min', '3 min ago', '3 min ago', 'OK', null], ['Pending expiry', 'every 5 min', '3 min ago', '3 min ago', 'OK', null],
  ['Grace and ended', 'hourly', '41 min ago', '41 min ago', 'OK', null], ['Reminders', 'daily', '6 h ago', '6 h ago', 'OK', null],
  ['Email outbox', 'every 5 min', 'now', '8 min ago', 'Running', null], ['Seller account health', 'daily', '2 days ago', '2 days ago', 'Late', 'Did not run when due'],
  ['Reconcile', 'daily', '5 h ago', '5 h ago', 'OK', null], ['Drift check', 'daily', '5 h ago', '1 day ago', 'Failed', 'Timed out after 120 s'],
].map(([name, every, ran, ok, state, error]) => ({ name, every, ran, ok, state, error }))
export const FAILED_EVENTS = [
  { type: 'invoice.paid', seller: 'Acme Agency', object: 'in_1Q…f3', received: 'Nov 27 14:02', attempts: 3, error: 'timeout' },
  { type: 'customer.subscription.updated', seller: 'Meridian Growth', object: 'sub_1P…9a', received: 'Nov 27 09:40', attempts: 5, error: 'account disconnected' },
]
export const RECONCILE = [{ what: 'Pine & Oak Homes', ours: 'Active, renews Dec 2', theirs: 'Past due since Nov 25' }, { what: 'Eco Pet Kind', ours: 'Ended Nov 21', theirs: 'Refund Nov 21, subscription cancelled' }]
export const MANUAL_QUEUE = [{ what: 'Eco Pet Kind', note: 'A payment of $3,200 arrived on Nov 23, after the plan ended.' }]
export const WOULD_BLOCK = [
  { account: 'Verde Juice', seller: 'Auden AI', what: 'Sync now', why: 'Access date passed on Nov 12', times: 4, seen: 'Nov 27 09:14' },
  { account: 'Blue Kettle Tea', seller: 'Brightside Digital', what: 'Sign-in', why: 'No access date', times: 11, seen: 'Nov 27 08:02' },
  { account: 'Harbor Mortgage', seller: 'Acme Agency', what: 'Add prompt', why: 'Team member with an old date', times: 2, seen: 'Nov 26 17:45' },
  { account: 'Koto Studio (demo)', seller: 'Koto Studio', what: 'Sync now', why: 'Access date passed on Nov 20', times: 1, seen: 'Nov 25 11:30' },
]

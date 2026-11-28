// Product updates: the one list we maintain (newest first). title, body, date (ISO), href. Notifications reads it;
// nothing about an update is written into a component.
export const PRODUCT_UPDATES = [
  { id: 'what-changed', title: 'Summary', body: 'See what moved since the last scan, from the page header', date: '2026-11-03', href: '/overview?changes=scan' },
  { id: 'benchmarking', title: 'Benchmarking', body: 'Your rank and score against your competitors.', date: '2026-10-30', href: '/benchmarking' },
  { id: 'trends', title: 'Trends', body: 'What people search on Google, and whether AI names you for it.', date: '2026-10-14', href: '/trends' },
  { id: 'getting-started', title: 'Getting started', body: 'A short guided setup, from the sidebar.', date: '2026-10-01', href: '/overview' },
]

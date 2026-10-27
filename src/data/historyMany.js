// Visibility history for a brand with 6 competitors with long names (preview: /overview?history=many). Fake data.
// The scoring change on Oct 21: syncs up to Oct 19 (weekly) / Sep 2026 (monthly) were scored the old way.
const KEYS = ['foa', 'rocket', 'omaha', 'aag', 'longbridge', 'liberty', 'guild']
const rows = (list) => list.map(([date, ...v]) => ({ date, ...Object.fromEntries(KEYS.map((k, i) => [k, v[i]])) }))

export const historyMany = {
  focal: { key: 'foa', domain: 'financeofamerica.com', name: 'Finance of America' },
  // share = the latest sync's share of prompts (the legend's order and the top 3)
  series: [
    { key: 'foa', label: 'financeofamerica.com', share: 31 },
    { key: 'rocket', label: 'rocketmortgage.com', share: 27 },
    { key: 'omaha', label: 'mutualofomahamortgage.com', share: 19 },
    { key: 'aag', label: 'aag.com', share: 14 },
    { key: 'longbridge', label: 'longbridge-financial.com', share: 9 },
    { key: 'liberty', label: 'libertyreverse.com', share: 6 },
    { key: 'guild', label: 'guildmortgage.com', share: 4 },
  ],
  scoring: {
    label: 'Scoring updated Oct 21',
    weekly: { after: 'Oct 19', frac: 2 / 7 },
    monthly: { after: 'Sep 2026', frac: 20 / 31 },
  },
  //             foa rocket omaha aag longbridge liberty guild
  weekly: rows([
    ['Jul 27', 24, 29, 18, 15, 10, 7, 5],
    ['Aug 3', 25, 28, 19, 14, 10, 6, 5],
    ['Aug 10', 24, 29, 18, 15, 9, 7, 4],
    ['Aug 17', 26, 28, 19, 14, 10, 6, 5],
    ['Aug 24', 25, 27, 20, 15, 9, 7, 4],
    ['Aug 31', 26, 28, 19, 14, 10, 6, 5],
    ['Sep 7', 27, 27, 18, 15, 9, 7, 4],
    ['Sep 14', 26, 28, 19, 13, 10, 6, 5],
    ['Sep 21', 27, 27, 20, 14, 9, 6, 4],
    ['Sep 28', 28, 26, 19, 15, 10, 7, 4],
    ['Oct 5', 27, 27, 18, 14, 9, 6, 5],
    ['Oct 12', 29, 26, 19, 15, 10, 6, 4],
    ['Oct 19', 28, 27, 20, 14, 9, 7, 4],
    ['Oct 26', 31, 27, 19, 14, 9, 6, 4],
  ]),
  monthly: rows([
    ['Nov 2025', 19, 31, 17, 16, 11, 7, 5],
    ['Dec 2025', 20, 30, 17, 16, 11, 7, 5],
    ['Jan 2026', 21, 30, 18, 15, 10, 7, 5],
    ['Feb 2026', 21, 29, 18, 15, 10, 6, 5],
    ['Mar 2026', 22, 30, 17, 16, 10, 7, 4],
    ['Apr 2026', 23, 29, 18, 15, 10, 7, 5],
    ['May 2026', 23, 29, 19, 15, 10, 6, 5],
    ['Jun 2026', 24, 28, 18, 15, 9, 7, 4],
    ['Jul 2026', 25, 29, 18, 14, 10, 6, 5],
    ['Aug 2026', 25, 28, 19, 14, 9, 6, 4],
    ['Sep 2026', 27, 27, 19, 14, 10, 7, 4],
    ['Oct 2026', 30, 27, 19, 14, 9, 6, 4],
  ]),
}

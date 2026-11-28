// Summary panel → "View in Prompt Hub →": where a prompt section's link lands, built from the URL params the Prompt
// Hub already reads (components/prompts/PromptsPage.jsx):
//   ?sync=oct-5&change=gained|lost   the prompts one scan won / lost (the exact list, when the section covers one scan)
//   ?visibility=visible|lost         the hub's status tab (a longer period spans several scans: the closest view)
// hubLink({ kind: 'won' | 'lost', iso }): iso = that one scan's day ("2026-10-05"), left out for a longer period.
// No kind: the hub as it is.
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
// "2026-10-05" → "oct-5" (the hub's sync slug, as data/syncChanges slugOf makes it from "Oct 5, 2026")
export function syncSlug(iso) {
  const m = /^\d{4}-(\d{2})-(\d{2})/.exec(iso ?? '')
  const month = m && MONTHS[Number(m[1]) - 1]
  return month ? `${month}-${Number(m[2])}` : null
}

export function hubLink({ kind = null, iso = null } = {}) {
  if (kind !== 'won' && kind !== 'lost') return '/tracker'
  const slug = syncSlug(iso)
  if (slug) return `/tracker?sync=${slug}&change=${kind === 'won' ? 'gained' : 'lost'}`
  return `/tracker?visibility=${kind === 'won' ? 'visible' : 'lost'}`
}
